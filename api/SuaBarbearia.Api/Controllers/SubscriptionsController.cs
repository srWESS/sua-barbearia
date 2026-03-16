using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuaBarbearia.Api.Data;
using SuaBarbearia.Api.Models;

namespace SuaBarbearia.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class SubscriptionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public SubscriptionsController(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }

    // Usa sempre o AccessToken único (barbearia-checkout) definido nas variáveis de ambiente do Railway
    private string AccessToken => _configuration["MercadoPago:AccessToken"] ?? "";
    private string BaseUrl => "https://api.mercadopago.com";

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        throw new UnauthorizedAccessException("Invalid user ID in token");
    }

    public class CreatePlanRequest
    {
        public long PlanId { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public string BackUrl { get; set; } = string.Empty;
    }

    public class CreatePlanResponse
    {
        public string PreapprovalPlanId { get; set; } = string.Empty;
        /// <summary>URL do Mercado Pago para redirecionar o usuário e completar a assinatura</summary>
        public string InitPoint { get; set; } = string.Empty;
    }

    public class SubscriptionStatusResponse
    {
        [JsonPropertyName("subscriptionStatus")]
        public string? SubscriptionStatus { get; set; }

        [JsonPropertyName("subscriptionEndDate")]
        public DateTime? SubscriptionEndDate { get; set; }

        [JsonPropertyName("planId")]
        public long? PlanId { get; set; }
    }

    // POST /api/subscriptions/create-plan
    // Cria (ou reutiliza) um preapproval_plan no MP e retorna o init_point para redirecionar o cliente.
    [HttpPost("create-plan")]
    public async Task<ActionResult<CreatePlanResponse>> CreatePlan([FromBody] CreatePlanRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
                return NotFound(new { error = "User not found" });

            Console.WriteLine($"[INFO] CreatePlan: userId={userId}, planId={request.PlanId}");

            // Verifica se já existe um preapproval_plan criado no MP para este planId local.
            // O mapeamento é salvo na tabela Settings com a chave "preapproval_plan_{planId}".
            var settingKey = $"preapproval_plan_{request.PlanId}";
            var existingSetting = await _context.Settings
                .FirstOrDefaultAsync(s => s.SettingKey == settingKey);

            string? preapprovalPlanId = existingSetting?.Value;
            string? initPoint = null;

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);

            if (string.IsNullOrEmpty(preapprovalPlanId))
            {
                // Plano ainda não existe no MP — criar agora.
                Console.WriteLine($"[INFO] Criando novo preapproval_plan no MP para planId={request.PlanId}");

                var planPayload = new
                {
                    reason = request.Name,
                    auto_recurring = new
                    {
                        frequency = 1,
                        frequency_type = "months",
                        transaction_amount = Math.Round((double)request.Price, 2),
                        currency_id = "BRL"
                    },
                    payment_methods_allowed = new
                    {
                        payment_types = new[] { new { id = "credit_card" } },
                        payment_methods = new object[] { }
                    },
                    back_url = request.BackUrl
                };

                var jsonContent = new StringContent(
                    JsonSerializer.Serialize(planPayload),
                    Encoding.UTF8,
                    "application/json"
                );

                var response = await _httpClient.PostAsync($"{BaseUrl}/preapproval_plan", jsonContent);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[ERROR] Falha ao criar preapproval_plan no MP: {response.StatusCode} — {errorBody}");
                    return StatusCode(500, new { error = "Falha ao criar plano de assinatura no Mercado Pago.", details = errorBody });
                }

                var responseJson = await response.Content.ReadFromJsonAsync<JsonElement>();
                preapprovalPlanId = responseJson.GetProperty("id").GetString();
                initPoint = responseJson.TryGetProperty("init_point", out var ipEl) ? ipEl.GetString() : null;

                Console.WriteLine($"[INFO] preapproval_plan criado: {preapprovalPlanId}, init_point: {initPoint}");

                // Persistir mapeamento planId -> preapproval_plan_id
                _context.Settings.Add(new Setting
                {
                    SettingKey = settingKey,
                    Value = preapprovalPlanId!
                });
                await _context.SaveChangesAsync();
            }
            else
            {
                // Plano já existe — buscar init_point via GET.
                Console.WriteLine($"[INFO] preapproval_plan já existe: {preapprovalPlanId}");

                var getResp = await _httpClient.GetAsync($"{BaseUrl}/preapproval_plan/{preapprovalPlanId}");
                if (getResp.IsSuccessStatusCode)
                {
                    var planData = await getResp.Content.ReadFromJsonAsync<JsonElement>();
                    initPoint = planData.TryGetProperty("init_point", out var ipEl2) ? ipEl2.GetString() : null;
                    Console.WriteLine($"[INFO] init_point obtido do MP: {initPoint}");
                }

                // CORREÇÃO: Se o GET não retornar init_point, construir a URL padrão manualmente.
                // O MP sempre aceita este formato para redirecionar ao checkout de assinatura.
                if (string.IsNullOrEmpty(initPoint))
                {
                    initPoint = $"https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id={preapprovalPlanId}";
                    Console.WriteLine($"[INFO] init_point construído manualmente: {initPoint}");
                }
            }

            // IMPORTANTE: NÃO salvar o preapproval_plan_id no MpPreapprovalId do usuário.
            // O preapproval_plan_id é o ID do plano/template no MP, não da assinatura individual.
            // O preapproval_id real (ID da assinatura do cliente) só chega via webhook após o checkout.
            // Salvar o plan_id aqui causava o bug onde o webhook não encontrava o usuário pelo ID correto.
            // O webhook usa payer_email como fallback para vincular o usuário à assinatura.

            return Ok(new CreatePlanResponse
            {
                PreapprovalPlanId = preapprovalPlanId ?? string.Empty,
                InitPoint = initPoint ?? string.Empty
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] CreatePlan: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // POST /api/subscriptions/cancel
    [HttpPost("cancel")]
    public async Task<IActionResult> CancelSubscription()
    {
        try
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
                return NotFound(new { error = "User not found" });

            Console.WriteLine($"[INFO] Cancelando assinatura do usuário {userId}");

            // Cancelar no MP se houver ID de assinatura ativa
            if (!string.IsNullOrEmpty(user.MpSubscriptionId))
            {
                Console.WriteLine($"[INFO] Cancelando preapproval no MP: {user.MpSubscriptionId}");

                var updatePayload = new { status = "cancelled" };
                var jsonContent = new StringContent(
                    JsonSerializer.Serialize(updatePayload),
                    Encoding.UTF8,
                    "application/json"
                );

                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
                var response = await _httpClient.PutAsync($"{BaseUrl}/preapproval/{user.MpSubscriptionId}", jsonContent);

                if (response.IsSuccessStatusCode)
                    Console.WriteLine("[INFO] Assinatura cancelada no MP com sucesso");
                else
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[WARN] Falha ao cancelar no MP (continuando com cancelamento local): {errorBody}");
                }
            }

            // Atualizar status local independente do resultado do MP
            user.SubscriptionStatus = "cancelled";
            user.PlanId = null;
            user.MpSubscriptionId = null;
            user.SubscriptionEndDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            Console.WriteLine($"[INFO] Assinatura do usuário {userId} cancelada localmente");
            return Ok(new { message = "Assinatura cancelada com sucesso" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] CancelSubscription: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/subscriptions/status
    [HttpGet("status")]
    public async Task<ActionResult<SubscriptionStatusResponse>> GetSubscriptionStatus()
    {
        try
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FindAsync(userId);

            if (user == null)
            {
                return NotFound(new { error = "User not found" });
            }

            return Ok(new SubscriptionStatusResponse
            {
                SubscriptionStatus = user.SubscriptionStatus,
                SubscriptionEndDate = user.SubscriptionEndDate,
                PlanId = user.PlanId
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] GetSubscriptionStatus: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

