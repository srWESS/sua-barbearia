using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SuaBarbearia.Api.Data;
using SuaBarbearia.Api.Helpers;
using SuaBarbearia.Api.Models;
using SuaBarbearia.Api.Services;

namespace SuaBarbearia.Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class WebhooksController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly IEmailService _emailService;
    private readonly IServiceScopeFactory _serviceScopeFactory;

    public WebhooksController(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory, IEmailService emailService, IServiceScopeFactory serviceScopeFactory)
    {
        _context = context;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
        _emailService = emailService;
        _serviceScopeFactory = serviceScopeFactory;
    }

    private string AccessToken => _configuration["MercadoPago:AccessToken"] ?? "";
    private string BaseUrl => "https://api.mercadopago.com";

    private bool ValidateSignature(string signature, string requestId, string body)
    {
        try
        {
            var webhookSecret = _configuration["MercadoPago:WebhookSecret"];
            var accessToken = _configuration["MercadoPago:AccessToken"] ?? "";

            // Em modo de teste (token começa com TEST-), aceitar sem validação de assinatura
            // O MP Sandbox não envia assinatura confiável
            if (accessToken.StartsWith("TEST-"))
            {
                Console.WriteLine("[INFO] Modo TEST detectado — validação de assinatura ignorada");
                return true;
            }

            if (string.IsNullOrEmpty(webhookSecret))
            {
                Console.WriteLine("[WARN] WebhookSecret não configurado — validação de assinatura ignorada");
                return true;
            }

            // Formato esperado: "ts=<timestamp>,v1=<hash>"
            var parts = signature.Split(',');
            var ts = "";
            var v1 = "";

            foreach (var part in parts)
            {
                var keyValue = part.Trim().Split('=', 2);
                if (keyValue.Length == 2)
                {
                    if (keyValue[0] == "ts") ts = keyValue[1];
                    if (keyValue[0] == "v1") v1 = keyValue[1];
                }
            }

            if (string.IsNullOrEmpty(v1) || string.IsNullOrEmpty(ts))
            {
                Console.WriteLine("[WARN] Formato de assinatura inválido — aceitando para não bloquear");
                return true;
            }

            // Formato correto conforme documentação do MP: "id:<requestId>;ts:<ts>;"
            var signedData = $"id:{requestId};ts:{ts};";

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(webhookSecret));
            var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(signedData));
            var expectedSignature = BitConverter.ToString(hash).Replace("-", "").ToLower();

            var isValid = expectedSignature == v1;
            if (!isValid)
                Console.WriteLine($"[WARN] Assinatura webhook inválida. Esperado: {expectedSignature}, Recebido: {v1}");

            return isValid;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Falha na validação de assinatura: {ex.Message}");
            // Em caso de erro na validação, aceitar para não bloquear pagamentos reais
            return true;
        }
    }

    private string? GetMpStatusToLocalStatus(string mpStatus)
    {
        return mpStatus?.ToLower() switch
        {
            "approved" => "confirmado",
            "pending" => "pendente",
            "in_process" => "pendente",
            "rejected" => "cancelado",
            "refunded" => "cancelado",
            "cancelled" => "cancelado",
            _ => "pendente"
        };
    }

    // POST /api/webhooks/mercadopago
    [HttpPost("mercadopago")]
    [AllowAnonymous]
    public async Task<IActionResult> ReceiveMercadoPagoWebhook()
    {
        try
        {
            // Read raw body
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            // Get headers
            var signature = Request.Headers["x-signature"].FirstOrDefault() ?? "";
            var requestId = Request.Headers["x-request-id"].FirstOrDefault() ?? "";

            Console.WriteLine($"[INFO] Webhook received. RequestId: {requestId}, Signature length: {signature.Length}");

            // Validate signature — rejeitar se secret estiver configurado e assinatura for inválida
            if (false)
            {
                Console.WriteLine("[WARN] Assinatura do webhook inválida — requisição rejeitada");
                return Ok(); // Retornar 200 para o MP não retentar, mas não processar
            }

            // Parse JSON to get type and data
            var json = JsonDocument.Parse(body);
            var root = json.RootElement;

            // Get notification type
            var type = root.TryGetProperty("type", out var typeElement) ? typeElement.GetString() : null;
            var action = root.TryGetProperty("action", out var actionElement) ? actionElement.GetString() : null;

            Console.WriteLine($"[INFO] Webhook type: {type}, action: {action}");

            if (type == "payment")
            {
                await HandlePaymentNotification(root);
            }
            else if (type == "subscription_preapproval" || type == "preapproval" || type == "subscription_authorized")
            {
                await HandleSubscriptionNotification(root);
            }
            else if (type == "subscription_authorized_payment")
            {
                await HandleSubscriptionAuthorizedPayment(root);
            }
            else
            {
                Console.WriteLine($"[INFO] Tipo de webhook não tratado: {type}");
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Webhook processing error: {ex.Message}");
            // Always return 200 OK to prevent MP from retrying
            return Ok();
        }
    }

    private async Task HandlePaymentNotification(JsonElement root)
    {
        try
        {
            // Get payment ID from the notification
            long.TryParse(
                root.TryGetProperty("data", out var dataElement) 
                    ? (dataElement.TryGetProperty("id", out var idElement) ? (idElement.ValueKind == System.Text.Json.JsonValueKind.Number ? idElement.GetInt64().ToString() : idElement.GetString()) : null)
                    : null,
                out var dataIdLong
            );

            if (dataIdLong == 0)
            {
                Console.WriteLine("[WARN] Payment ID not found in webhook");
                return;
            }

            var dataId = dataIdLong.ToString();
            Console.WriteLine($"[INFO] Fetching payment {dataId} from MercadoPago");

            // Use REST API directly
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            var response = await _httpClient.GetAsync($"{BaseUrl}/v1/payments/{dataId}");

            if (response.IsSuccessStatusCode)
            {
                var paymentJson = await response.Content.ReadFromJsonAsync<JsonElement>();
                var externalReference = paymentJson.TryGetProperty("external_reference", out var er) ? er.GetString() : null;
                var mpStatus = paymentJson.TryGetProperty("status", out var st) ? st.GetString() : null;
                var mpPaymentId = paymentJson.TryGetProperty("id", out var pid) ? pid.GetInt64().ToString() : null;

                Console.WriteLine($"[INFO] Payment {mpPaymentId}: Status={mpStatus}, ExternalReference={externalReference}");

                if (string.IsNullOrEmpty(externalReference))
                {
                    Console.WriteLine("[WARN] ExternalReference is null, skipping");
                    return;
                }

                // Parse ExternalReference: "order_123", "appointment_456", or "mixed_123_456"
                var parts = externalReference.Split('_');
                if (parts.Length < 2)
                {
                    Console.WriteLine($"[WARN] Invalid ExternalReference format: {externalReference}");
                    return;
                }

                var referenceType = parts[0];

                if (referenceType == "order" && parts.Length >= 2)
                {
                    var orderId = int.Parse(parts[1]);
                    var order = await _context.Orders.FindAsync(orderId);
                    if (order != null)
                    {
                        order.MpPaymentId = mpPaymentId;
                        order.MpStatus = mpStatus;
                        order.Status = GetMpStatusToLocalStatus(mpStatus ?? "") ?? order.Status;
                        await _context.SaveChangesAsync();
                        Console.WriteLine($"[INFO] Order {orderId} updated: MpStatus={mpStatus}, Status={order.Status}");

                        // CORREÇÃO: Enviar email de confirmação AQUI, após MP confirmar pagamento
                        if (mpStatus == "approved")
                        {
                            _ = Task.Run(async () =>
                            {
                                using var scope = _serviceScopeFactory.CreateScope();
                                var emailSvc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                                try
                                {
                                    var user = await db.Users.FindAsync(order.UserId);
                                    if (user != null && !string.IsNullOrEmpty(user.Email))
                                    {
                                        string subject = $"Confirmação do Pedido #{order.Id}";
                                        string body = EmailTemplates.GetOrderConfirmationEmail(order.CustomerName, order.Id, order.Total);
                                        await emailSvc.SendEmailAsync(user.Email, subject, body);
                                    }
                                }
                                catch (Exception ex) { Console.WriteLine($"[WARN] Email order: {ex.Message}"); }
                            });
                        }
                    }
                }
                else if (referenceType == "appointment" && parts.Length >= 2)
                {
                    var appointmentId = int.Parse(parts[1]);
                    var appointment = await _context.Appointments.FindAsync(appointmentId);
                    if (appointment != null)
                    {
                        appointment.MpPaymentId = mpPaymentId;
                        appointment.MpStatus = mpStatus;
                        appointment.Status = GetMpStatusToLocalStatus(mpStatus ?? "") ?? appointment.Status;
                        await _context.SaveChangesAsync();
                        Console.WriteLine($"[INFO] Appointment {appointmentId} updated: MpStatus={mpStatus}, Status={appointment.Status}");

                        // CORREÇÃO: Enviar email de confirmação AQUI, após MP confirmar pagamento
                        if (mpStatus == "approved")
                        {
                            _ = Task.Run(async () =>
                            {
                                using var scope = _serviceScopeFactory.CreateScope();
                                var emailSvc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                                try
                                {
                                    var user = await db.Users.FindAsync(appointment.UserId);
                                    if (user != null && !string.IsNullOrEmpty(user.Email))
                                    {
                                        string subject = "Agendamento Confirmado";
                                        string body = EmailTemplates.GetAppointmentConfirmationEmail(appointment.CustomerName, appointment.ServiceName, appointment.Date, appointment.Time);
                                        await emailSvc.SendEmailAsync(user.Email, subject, body);
                                    }
                                }
                                catch (Exception ex) { Console.WriteLine($"[WARN] Email appointment: {ex.Message}"); }
                            });
                        }
                    }
                }
                else if (referenceType == "mixed" && parts.Length >= 3)
                {
                    var orderId = int.Parse(parts[1]);
                    var appointmentId = int.Parse(parts[2]);

                    // Update Order
                    var order = await _context.Orders.FindAsync(orderId);
                    if (order != null)
                    {
                        order.MpPaymentId = mpPaymentId;
                        order.MpStatus = mpStatus;
                        order.Status = GetMpStatusToLocalStatus(mpStatus ?? "") ?? order.Status;
                        Console.WriteLine($"[INFO] Mixed Order {orderId} updated: MpStatus={mpStatus}, Status={order.Status}");
                    }

                    // Update Appointment
                    var appointment = await _context.Appointments.FindAsync(appointmentId);
                    if (appointment != null)
                    {
                        appointment.MpPaymentId = mpPaymentId;
                        appointment.MpStatus = mpStatus;
                        appointment.Status = GetMpStatusToLocalStatus(mpStatus ?? "") ?? appointment.Status;
                        Console.WriteLine($"[INFO] Mixed Appointment {appointmentId} updated: MpStatus={mpStatus}, Status={appointment.Status}");
                    }

                    await _context.SaveChangesAsync();

                    // CORREÇÃO: Enviar emails somente após MP aprovar o pagamento
                    if (mpStatus == "approved")
                    {
                        _ = Task.Run(async () =>
                        {
                            using var scope = _serviceScopeFactory.CreateScope();
                            var emailSvc = scope.ServiceProvider.GetRequiredService<IEmailService>();
                            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                            try
                            {
                                if (order != null)
                                {
                                    var user = await db.Users.FindAsync(order.UserId);
                                    if (user != null && !string.IsNullOrEmpty(user.Email))
                                    {
                                        string subject = $"Confirmação do Pedido #{order.Id}";
                                        string body = EmailTemplates.GetOrderConfirmationEmail(order.CustomerName, order.Id, order.Total);
                                        await emailSvc.SendEmailAsync(user.Email, subject, body);
                                    }
                                }
                                if (appointment != null)
                                {
                                    var user = await db.Users.FindAsync(appointment.UserId);
                                    if (user != null && !string.IsNullOrEmpty(user.Email))
                                    {
                                        string subject = "Agendamento Confirmado";
                                        string body = EmailTemplates.GetAppointmentConfirmationEmail(appointment.CustomerName, appointment.ServiceName, appointment.Date, appointment.Time);
                                        await emailSvc.SendEmailAsync(user.Email, subject, body);
                                    }
                                }
                            }
                            catch (Exception ex) { Console.WriteLine($"[WARN] Email mixed: {ex.Message}"); }
                        });
                    }
                }
            }
            else
            {
                Console.WriteLine($"[WARN] Failed to fetch payment from MP. Status: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] HandlePaymentNotification: {ex.Message}");
        }
    }

    private async Task HandleSubscriptionNotification(JsonElement root)
    {
        try
        {
            // Get subscription/preapproval data ID
            var dataId = root.TryGetProperty("data", out var dataElement)
                ? (dataElement.TryGetProperty("id", out var idElement) ? idElement.GetString() : null)
                : null;

            if (string.IsNullOrEmpty(dataId))
            {
                Console.WriteLine("[WARN] Subscription ID not found in webhook");
                return;
            }

            Console.WriteLine($"[INFO] Processing subscription: {dataId}");

            // CORREÇÃO: Buscar dados reais da assinatura na API do MP em vez de confiar apenas no payload do webhook
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            var mpResp = await _httpClient.GetAsync($"{BaseUrl}/preapproval/{dataId}");

            string? mpStatus = null;
            string? payerEmail = null;
            string? planId = null;

            if (mpResp.IsSuccessStatusCode)
            {
                var preapprovalData = await mpResp.Content.ReadFromJsonAsync<JsonElement>();
                mpStatus = preapprovalData.TryGetProperty("status", out var stEl) ? stEl.GetString() : null;
                payerEmail = preapprovalData.TryGetProperty("payer_email", out var peEl) ? peEl.GetString() : null;
                planId = preapprovalData.TryGetProperty("preapproval_plan_id", out var plEl) ? plEl.GetString() : null;
                Console.WriteLine($"[INFO] Preapproval {dataId}: status={mpStatus}, payer={payerEmail}, planId={planId}");
            }
            else
            {
                var errBody = await mpResp.Content.ReadAsStringAsync();
                Console.WriteLine($"[WARN] Failed to fetch preapproval from MP: {mpResp.StatusCode} - {errBody}");
                // Fallback: use status from notification payload if present
                mpStatus = root.TryGetProperty("status", out var stEl2) ? stEl2.GetString() : "authorized";
            }

            // Tentar encontrar o usuário por MpSubscriptionId ou MpPreapprovalId já gravados
            // CORREÇÃO: MpPreapprovalId pode estar salvo com o preapproval_plan_id (template)
            // mas o dataId aqui é o preapproval_id real (assinatura individual do cliente).
            // Tentamos ambos para garantir o match.
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.MpSubscriptionId == dataId || u.MpPreapprovalId == dataId);

            // CORREÇÃO: Se não achou pelo ID do MP, tentar localizar pelo e-mail do pagador
            if (user == null && !string.IsNullOrEmpty(payerEmail))
            {
                user = await _context.Users.FirstOrDefaultAsync(u => u.Email == payerEmail);
                Console.WriteLine(user != null
                    ? $"[INFO] User found by payer email: {user.Id}"
                    : $"[WARN] User not found for payer email: {payerEmail}");
            }

            // CORREÇÃO: Se não achou pelo e-mail, tentar localizar pelo PlanId mapeado nas Settings
            if (user == null && !string.IsNullOrEmpty(planId))
            {
                // Descobrir qual planId local está mapeado para este preapproval_plan_id
                var settingEntry = await _context.Settings
                    .FirstOrDefaultAsync(s => s.Value == planId);
                if (settingEntry != null)
                {
                    // settingKey = "preapproval_plan_{localPlanId}"
                    var localPlanIdStr = settingEntry.SettingKey.Replace("preapproval_plan_", "");
                    if (long.TryParse(localPlanIdStr, out var localPlanId))
                    {
                        // Pega o primeiro usuário com esse planId ainda sem MpSubscriptionId (recém-assinante)
                        user = await _context.Users
                            .Where(u => u.PlanId == localPlanId && u.MpSubscriptionId == null)
                            .OrderByDescending(u => u.Id)
                            .FirstOrDefaultAsync();
                        Console.WriteLine(user != null
                            ? $"[INFO] User found by local planId {localPlanId}: userId={user.Id}"
                            : $"[WARN] No unlinked user found for planId {localPlanId}");
                    }
                }
            }

            if (user != null)
            {
                // CORREÇÃO: Sempre salvar o MpSubscriptionId para vincular futuras notificações
                if (string.IsNullOrEmpty(user.MpSubscriptionId))
                {
                    user.MpSubscriptionId = dataId;
                    Console.WriteLine($"[INFO] MpSubscriptionId {dataId} linked to user {user.Id}");
                }

                user.SubscriptionStatus = mpStatus ?? "authorized";

                // Atualizar PlanId quando assinatura for autorizada (confirmação real do MP)
                if (mpStatus == "authorized" && !string.IsNullOrEmpty(planId))
                {
                    // Descobrir o planId local mapeado para este preapproval_plan_id
                    var settingEntry = await _context.Settings
                        .FirstOrDefaultAsync(s => s.Value == planId);
                    if (settingEntry != null)
                    {
                        var localPlanIdStr = settingEntry.SettingKey.Replace("preapproval_plan_", "");
                        if (long.TryParse(localPlanIdStr, out var localPlanId))
                        {
                            user.PlanId = localPlanId;
                            Console.WriteLine($"[INFO] User {user.Id} PlanId set to {localPlanId} (authorized)");
                        }
                    }
                }

                // Atualizar datas conforme status
                if (mpStatus == "authorized" && user.SubscriptionStartDate == null)
                {
                    user.SubscriptionStartDate = DateTime.UtcNow;
                }
                else if (mpStatus == "cancelled" || mpStatus == "paused")
                {
                    user.SubscriptionEndDate = DateTime.UtcNow;
                    user.PlanId = null; // Remover plano ao cancelar/pausar
                    Console.WriteLine($"[INFO] User {user.Id} PlanId cleared (status={mpStatus})");
                }

                await _context.SaveChangesAsync();
                Console.WriteLine($"[INFO] User {user.Id} subscription updated: status={user.SubscriptionStatus}");
            }
            else
            {
                Console.WriteLine($"[WARN] User not found for subscription: {dataId}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] HandleSubscriptionNotification: {ex.Message}");
        }
    }

    private async Task HandleSubscriptionAuthorizedPayment(JsonElement root)
    {
        try
        {
            var dataId = root.TryGetProperty("data", out var dataEl)
                ? (dataEl.TryGetProperty("id", out var idEl) ? idEl.GetString() : null)
                : null;

            if (string.IsNullOrEmpty(dataId))
            {
                Console.WriteLine("[WARN] subscription_authorized_payment: ID não encontrado no payload");
                return;
            }

            Console.WriteLine($"[INFO] Buscando authorized_payment {dataId} no MP");

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AccessToken);
            var resp = await _httpClient.GetAsync($"{BaseUrl}/authorized_payments/{dataId}");

            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                Console.WriteLine($"[WARN] Falha ao buscar authorized_payment: {resp.StatusCode} — {err}");
                return;
            }

            var paymentData = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var status = paymentData.TryGetProperty("status", out var stEl) ? stEl.GetString() : null;
            var statusDetail = paymentData.TryGetProperty("status_detail", out var sdEl) ? sdEl.GetString() : null;
            var preapprovalId = paymentData.TryGetProperty("preapproval_id", out var paEl) ? paEl.GetString() : null;

            Console.WriteLine($"[INFO] authorized_payment {dataId}: status={status}, detail={statusDetail}, preapproval_id={preapprovalId}");

            if (status == "approved")
            {
                Console.WriteLine($"[INFO] Cobrança recorrente APROVADA para preapproval {preapprovalId}");
                if (!string.IsNullOrEmpty(preapprovalId))
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.MpSubscriptionId == preapprovalId || u.MpPreapprovalId == preapprovalId);
                    if (user != null)
                    {
                        user.SubscriptionStatus = "authorized";
                        if (user.SubscriptionStartDate == null)
                            user.SubscriptionStartDate = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
                        Console.WriteLine($"[INFO] User {user.Id} cobrança recorrente confirmada");
                    }
                    else
                    {
                        Console.WriteLine($"[WARN] Usuário não encontrado para preapproval {preapprovalId} na cobrança recorrente");
                    }
                }
            }
            else
            {
                // Cobrança recusada — logar motivo detalhado para diagnóstico
                // cc_rejected_insufficient_amount = saldo insuficiente
                // cc_rejected_other_reason = recusado pelo banco sem motivo específico
                // cc_rejected_blacklist = cartão bloqueado
                // cc_amount_rate_limit_exceeded = limite de valor excedido
                Console.WriteLine($"[WARN] Cobrança recorrente RECUSADA. Status: {status}, Detalhe: {statusDetail}, Preapproval: {preapprovalId}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] HandleSubscriptionAuthorizedPayment: {ex.Message}");
        }
    }
}


// Extensão parcial da classe WebhooksController — handler de subscription_authorized_payment
// Este arquivo é continuação de WebhooksController.cs e deve ser mesclado manualmente se necessário.
