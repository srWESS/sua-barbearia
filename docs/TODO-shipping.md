# TODO: Implementar Cálculo de Frete

## 1. Implementar cálculo sem API
- [x] Usar Nominatim (OpenStreetMap) para geocodificação gratuita
- [x] Calcular distância com fórmula de Haversine
- [x] Aplicar fórmula de frete: R$ 7,00 até 5km + R$ 1,00 por km adicional

## 2. Definir Localização da Loja
- [x] Adicionar constante com endereço da loja em checkout.js: "Avenida Atlântica, Jardim Revista, Suzano - SP, 519"

## 3. Função de Cálculo de Frete
- [x] Criar função calculateShippingCost(destination) que usa DirectionsService para obter distância e verificar pedágios
- [x] Calcular frete: mínimo R$7 para até 5km, +R$1 por km adicional
- [x] Somar valor do pedágio se houver na rota

## 4. Integração no Checkout
- [x] Modificar renderOrderSummary para mostrar frete quando entrega selecionada
- [x] Adicionar botão "Calcular Frete" na seção de dados do cliente
- [x] Mostrar valor do frete na seção de dados do cliente
- [x] Atualizar total incluindo frete
- [x] Atualizar mensagem do WhatsApp com frete

## 5. Tratamento de Erros
- [x] Adicionar tratamento para falha na API (ex: endereço inválido)
- [ ] Mostrar loading durante cálculo (opcional)

## 6. Testes
- [ ] Testar cálculo com endereços próximos e distantes (requer chave da API)
- [x] Verificar se frete é adicionado corretamente ao total
