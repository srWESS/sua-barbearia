let cart = [];
const RESTAURANT_ADDRESS = "Rua da Barbearia, Centro, São Paulo - SP, 123";
let currentShippingCost = 0;

// Coordenadas da loja (aproximadas para Suzano - SP)
const RESTAURANT_LAT = -23.535;
const RESTAURANT_LNG = -46.31;

// Função para calcular distância usando fórmula de Haversine
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Função para geocodificar endereço usando Nominatim (OpenStreetMap)
async function geocodeAddress(address) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
        const data = await response.json();
        if (data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        throw new Error('Endereço não encontrado');
    } catch (error) {
        throw new Error('Erro ao geocodificar endereço: ' + error.message);
    }
}

// Função para estimar distância baseada na cidade do endereço
function estimateDistanceByCity(address) {
    const lowerAddress = address.toLowerCase();
    if (lowerAddress.includes('suzano')) {
        return 5; // km
    } else if (lowerAddress.includes('são paulo') || lowerAddress.includes('sao paulo')) {
        return 30; // km
    } else if (lowerAddress.includes('mogi das cruzes') || lowerAddress.includes('poá') || lowerAddress.includes('ferraz de vasconcelos')) {
        return 20; // km
    } else {
        return 50; // km para outras cidades
    }
}

// Função para calcular o frete
async function calculateShippingCost(destination) {
    // Estimar distância baseada na cidade
    const distanceKm = estimateDistanceByCity(destination);

    // Verificar se atende a região
    if (distanceKm > 30) {
        return { cost: null, distance: distanceKm };
    }

    // Cálculo do frete: R$ 7,00 para até 5 km, + R$ 1,00 por km adicional
    let shippingCost = 7.00; // mínimo
    if (distanceKm > 5) {
        shippingCost += (distanceKm - 5) * 1.00; // R$ 1 por km adicional
    }

    return { cost: shippingCost, distance: distanceKm };
}

// Traduções para checkout
const checkoutTranslations = {
    pt: {
        back: 'VOLTAR',
        title: 'Detalhes da Compra',
        subtitle: 'Preencha suas informações para finalizar o pedido',
        orderSummary: 'Resumo do Pedido',
        customerData: 'Dados do Cliente',
        fullName: 'Nome Completo *',
        phone: 'Telefone *',
        deliveryMethod: 'Método de Entrega *',
        select: 'Selecione...',
        delivery: 'Entrega',
        pickup: 'Retirar na Loja',
        cep: 'CEP *',
        cepLink: 'Não sei meu CEP',
        address: 'Endereço *',
        addressPlaceholder: 'Rua, bairro',
        number: 'Número *',
        numberPlaceholder: 'Número da residência',
        paymentMethod: 'Forma de Pagamento *',
        cash: 'Dinheiro',
        pix: 'PIX',
        card: 'Cartão de Crédito/Débito',
        notes: 'Observações',
        notesPlaceholder: 'Instruções especiais para entrega...',
        finalizeOrder: 'Finalizar Pedido no WhatsApp',
        total: 'Total:',
        emptyCart: 'Carrinho vazio',
        quantity: 'Quantidade:',
        cepNotFound: 'CEP não encontrado!',
        cepError: 'Erro ao buscar endereço. Tente novamente.',
        fillFields: 'Por favor, preencha todos os campos obrigatórios.',
        confirmDelivery: '_Por favor, confirme a entrega!_',
        confirmPickup: '_Por favor, avise quando estiver pronto para retirada!_',
        newOrder: '*NOVO PEDIDO - SUA BARBEARIA*',
        client: '*Cliente:*',
        deliveryMethodLabel: '*Método de Entrega:*',
        cepLabel: '*CEP:*',
        addressLabel: '*Endereço:*',
        paymentLabel: '*Pagamento:*',
        notesLabel: '*Observações:*',
        orderLabel: '*PEDIDO:*',
        minimumOrderWarning: 'Compre mais R${value} para completar o pedido mínimo.'
    },
    en: {
        back: 'BACK',
        title: 'Purchase Details',
        subtitle: 'Fill in your information to complete the order',
        orderSummary: 'Order Summary',
        customerData: 'Customer Data',
        fullName: 'Full Name *',
        phone: 'Phone *',
        deliveryMethod: 'Delivery Method *',
        select: 'Select...',
        delivery: 'Delivery',
        pickup: 'Pickup at Store',
        cep: 'ZIP Code *',
        cepLink: 'I don\'t know my ZIP Code',
        address: 'Address *',
        addressPlaceholder: 'Street, neighborhood',
        number: 'Number *',
        numberPlaceholder: 'House number',
        paymentMethod: 'Payment Method *',
        cash: 'Cash',
        pix: 'PIX',
        card: 'Credit/Debit Card',
        notes: 'Notes',
        notesPlaceholder: 'Special delivery instructions...',
        finalizeOrder: 'Complete Order on WhatsApp',
        total: 'Total:',
        emptyCart: 'Empty cart',
        quantity: 'Quantity:',
        cepNotFound: 'ZIP Code not found!',
        cepError: 'Error fetching address. Please try again.',
        fillFields: 'Please fill in all required fields.',
        confirmDelivery: '_Please confirm delivery!_',
        confirmPickup: '_Please let us know when ready for pickup!_',
        newOrder: '*NEW ORDER - YOUR BARBERSHOP*',
        client: '*Client:*',
        deliveryMethodLabel: '*Delivery Method:*',
        cepLabel: '*ZIP Code:*',
        addressLabel: '*Address:*',
        paymentLabel: '*Payment:*',
        notesLabel: '*Notes:*',
        orderLabel: '*ORDER:*',
        minimumOrderWarning: 'Buy R${value} more to complete the minimum order.'
    }
};

// Idioma atual
let currentLanguage = localStorage.getItem('language') || 'pt';

// Funções utilitárias para cookies
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;';
}

function updateCheckoutLanguage() {
    const t = checkoutTranslations[currentLanguage];

    // Page title
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = currentLanguage === 'en' ? 'Purchase Details - Your Barbershop' : 'Detalhes da Compra - Sua Barbearia';

    // Header
    const backBtn = document.querySelector('header button');
    if (backBtn) backBtn.textContent = t.back;

    const title = document.querySelector('header h1');
    if (title) title.textContent = t.title;

    const subtitle = document.querySelector('header p');
    if (subtitle) subtitle.textContent = t.subtitle;

    // Order Summary
    const orderSummaryTitle = document.querySelector('#order-summary').previousElementSibling;
    if (orderSummaryTitle) orderSummaryTitle.textContent = t.orderSummary;

    // Customer Data
    const customerDataTitle = document.querySelector('#checkout-form h2');
    if (customerDataTitle) customerDataTitle.textContent = t.customerData;

    // Form labels
    const labels = document.querySelectorAll('#checkout-form label');
    labels.forEach(label => {
        const text = label.textContent.trim();
        if (text.includes('Nome Completo') || text.includes('Full Name')) label.textContent = t.fullName;
        else if (text.includes('Telefone') || text.includes('Phone')) label.textContent = t.phone;
        else if (text.includes('Método de Entrega') || text.includes('Delivery Method')) label.textContent = t.deliveryMethod;
        else if (text.includes('CEP') || text.includes('ZIP Code')) label.textContent = t.cep;
        else if (text.includes('Endereço') || text.includes('Address')) label.textContent = t.address;
        else if (text.includes('Número') || text.includes('Number')) label.textContent = t.number;
        else if (text.includes('Forma de Pagamento') || text.includes('Payment Method')) label.textContent = t.paymentMethod;
        else if (text.includes('Observações') || text.includes('Notes')) label.textContent = t.notes;
    });

    // Select options
    const deliverySelect = document.getElementById('delivery-method');
    if (deliverySelect) {
        deliverySelect.options[0].text = t.select;
        deliverySelect.options[1].text = t.delivery;
        deliverySelect.options[2].text = t.pickup;
    }

    const paymentSelect = document.getElementById('payment-method');
    if (paymentSelect) {
        paymentSelect.options[0].text = t.select;
        paymentSelect.options[1].text = t.cash;
        paymentSelect.options[2].text = t.pix;
        paymentSelect.options[3].text = t.card;
    }

    // Placeholders
    const addressInput = document.getElementById('customer-address');
    if (addressInput) addressInput.placeholder = t.addressPlaceholder;

    const numberInput = document.getElementById('customer-number');
    if (numberInput) numberInput.placeholder = t.numberPlaceholder;

    const notesTextarea = document.getElementById('customer-notes');
    if (notesTextarea) notesTextarea.placeholder = t.notesPlaceholder;

    // CEP link
    const cepLink = document.querySelector('#checkout-form a');
    if (cepLink) cepLink.textContent = t.cepLink;

    // Button
    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) submitBtn.textContent = t.finalizeOrder;

    // Total label
    const totalLabel = document.querySelector('#order-total').previousElementSibling;
    if (totalLabel) totalLabel.textContent = t.total;
}

function saveFormData() {
    const formData = {
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        deliveryMethod: document.getElementById('delivery-method').value,
        cep: document.getElementById('customer-cep').value,
        address: document.getElementById('customer-address').value,
        number: document.getElementById('customer-number').value,
        paymentMethod: document.getElementById('payment-method').value,
        notes: document.getElementById('customer-notes').value
    };
    localStorage.setItem('checkoutFormData', JSON.stringify(formData));
}

function loadFormData() {
    const savedData = localStorage.getItem('checkoutFormData');
    if (savedData) {
        const formData = JSON.parse(savedData);
        document.getElementById('customer-name').value = formData.name || '';
        document.getElementById('customer-phone').value = formData.phone || '';
        document.getElementById('delivery-method').value = formData.deliveryMethod || 'entrega';
        document.getElementById('customer-cep').value = formData.cep || '';
        document.getElementById('customer-address').value = formData.address || '';
        document.getElementById('customer-number').value = formData.number || '';
        document.getElementById('payment-method').value = formData.paymentMethod || '';
        document.getElementById('customer-notes').value = formData.notes || '';
    }
}

function clearFormData() {
    localStorage.removeItem('checkoutFormData');
}

function loadCart() {
    let savedCart = localStorage.getItem('cart');
    if (!savedCart) {
        // Migrate from cookies if not in localStorage
        savedCart = getCookie('cart');
        if (savedCart) {
            localStorage.setItem('cart', savedCart);
            deleteCookie('cart');
        }
    }
    if (savedCart) {
        try {
            cart = JSON.parse(savedCart);
        } catch (e) {
            console.error('Erro ao carregar carrinho:', e);
            cart = [];
        }
    } else {
        cart = [];
    }
    renderOrderSummary();
    updateCheckoutLanguage();
    loadFormData();
    // Set initial state for delivery method
    toggleAddressFields();
}

function renderOrderSummary() {
    const summary = document.getElementById('order-summary');
    const total = document.getElementById('order-total');
    const t = checkoutTranslations[currentLanguage];

    if (cart.length === 0) {
        summary.innerHTML = `<p class="text-gray-500">${t.emptyCart}</p>`;
        total.textContent = 'R$ 0,00';
        return;
    }

    // Separar serviços e produtos
    const services = cart.filter(item => ['cortes', 'barba', 'combos'].includes(item.category));
    const products = cart.filter(item => item.category === 'produtos');

    let summaryHTML = '';

    // Serviços (Cortes, Barba, Combos)
    if (services.length > 0) {
        summaryHTML += `<div class="mb-6">
            <h4 class="font-bold text-lg text-gray-800 mb-3 border-b border-gray-200 pb-2">🪒 Serviços</h4>`;
        services.forEach(item => {
            summaryHTML += `
                <div class="flex items-center gap-4 bg-blue-50 p-4 rounded-lg mb-3 border border-blue-100">
                    <img src="${item.image}" class="w-16 h-16 object-cover rounded-lg">
                    <div class="flex-grow">
                        <h4 class="font-bold text-sm text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-600">${t.quantity} ${item.quantity}</p>
                        <p class="font-brand font-bold text-zinc-900">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            `;
        });
        summaryHTML += `</div>`;
    }

    // Produtos
    if (products.length > 0) {
        summaryHTML += `<div class="mb-6">
            <h4 class="font-bold text-lg text-gray-800 mb-3 border-b border-gray-200 pb-2">🛍️ Produtos</h4>`;
        products.forEach(item => {
            summaryHTML += `
                <div class="flex items-center gap-4 bg-green-50 p-4 rounded-lg mb-3 border border-green-100">
                    <img src="${item.image}" class="w-16 h-16 object-cover rounded-lg">
                    <div class="flex-grow">
                        <h4 class="font-bold text-sm text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-600">${t.quantity} ${item.quantity}</p>
                        <p class="font-brand font-bold text-zinc-900">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            `;
        });
        summaryHTML += `</div>`;
    }

    const servicesTotal = services.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const productsTotal = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemsTotal = servicesTotal + productsTotal;

    // Mostrar subtotais se houver ambos
    if (services.length > 0 && products.length > 0) {
        summaryHTML += `
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold text-gray-600">Subtotal Serviços:</span>
                    <span class="font-brand font-bold text-zinc-900">R$ ${servicesTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold text-gray-600">Subtotal Produtos:</span>
                    <span class="font-brand font-bold text-zinc-900">R$ ${productsTotal.toFixed(2).replace('.', ',')}</span>
                </div>
            </div>
        `;
    }

    // Removido pedido mínimo

    // Adicionar endereço se for entrega
    const deliveryMethod = document.getElementById('delivery-method').value;
    if (deliveryMethod === 'entrega') {
        const cep = document.getElementById('customer-cep').value;
        const address = document.getElementById('customer-address').value;
        const number = document.getElementById('customer-number').value;
        if (cep || address || number) {
            summaryHTML += `
                <div class="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 class="font-bold text-sm text-gray-800 mb-2">Endereço de Entrega</h4>
                    <p class="text-sm text-gray-600">CEP: ${cep}</p>
                    <p class="text-sm text-gray-600">Endereço: ${address}, ${number}</p>
                </div>
            `;
        }
    }

    // Adicionar frete apenas se houver produtos
    if (products.length > 0) {
        summaryHTML += `
            <div class="mb-4">
                <p class="font-bold text-sm text-gray-800">Valor do Frete: R$ ${(deliveryMethod === 'entrega' ? currentShippingCost : 0).toFixed(2).replace('.', ',')}</p>
            </div>
        `;
    }

    summary.innerHTML = summaryHTML;

    const totalValue = itemsTotal + (products.length > 0 && deliveryMethod === 'entrega' ? currentShippingCost : 0);
    total.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;

    // Removido pedido mínimo - botão sempre habilitado
    const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t.finalizeOrder;
    }
}

async function fetchAddressByCEP(cep) {
    const t = checkoutTranslations[currentLanguage];
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            alert(t.cepNotFound);
            return;
        }

        const address = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        document.getElementById('customer-address').value = address;
        // Calcular frete automaticamente se entrega selecionada
        const deliveryMethod = document.getElementById('delivery-method').value;
        if (deliveryMethod === 'entrega') {
            updateShippingCost();
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        alert(t.cepError);
    }
}



async function updateShippingCost() {
    const deliveryMethod = document.getElementById('delivery-method').value;
    if (deliveryMethod !== 'entrega') {
        currentShippingCost = 0;
        renderOrderSummary();
        return;
    }

    const address = document.getElementById('customer-address').value;

    if (!address) {
        // Manter o valor padrão até o endereço ser preenchido
        return;
    }

    const fullAddress = address; // Usar apenas o endereço para estimativa

    try {
        const result = await calculateShippingCost(fullAddress);
        if (result.cost === null) {
            // Distância > 30km, não atende
            const confirmPickup = confirm("Nossos entregadores não atendem essa região no momento. Deseja retirar na loja?");
            if (confirmPickup) {
                document.getElementById('delivery-method').value = 'retirar';
                // Limpar campos de localização
                document.getElementById('customer-cep').value = '';
                document.getElementById('customer-address').value = '';
                document.getElementById('customer-number').value = '';
                toggleAddressFields();
            } else {
                alert("Atendimento encerrado.");
                window.location.href = 'index.html';
            }
        } else {
            currentShippingCost = result.cost;
            renderOrderSummary();
        }
    } catch (error) {
        console.error('Erro ao calcular frete:', error);
        // Em caso de erro, manter o valor padrão
        alert('Erro ao calcular frete. Usando valor estimado.');
    }
}

function handleCEPInput(event) {
    const cep = event.target.value.replace(/\D/g, ''); // Remove non-digits

    if (cep.length === 8) {
        fetchAddressByCEP(cep);
    }
}

function toggleAddressFields() {
    const deliveryMethod = document.getElementById('delivery-method').value;
    const addressFields = document.getElementById('address-fields');
    const cep = document.getElementById('customer-cep');
    const address = document.getElementById('customer-address');
    const number = document.getElementById('customer-number');

    if (deliveryMethod === 'retirar') {
        addressFields.style.display = 'none';
        cep.required = false;
        address.required = false;
        number.required = false;
        currentShippingCost = 0;
        renderOrderSummary();
    } else {
        addressFields.style.display = 'block';
        cep.required = true;
        address.required = true;
        number.required = true;
        // Iniciar frete com R$ 0,00
        currentShippingCost = 0.00;
        renderOrderSummary();
        // Calcular frete se endereço já preenchido
        if (address.value && number.value) {
            updateShippingCost();
        }
    }
}

function handleCheckout(event) {
    event.preventDefault();
    const t = checkoutTranslations[currentLanguage];

    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const notes = document.getElementById('customer-notes').value;

    // Separar serviços e produtos
    const services = cart.filter(item => ['cortes', 'barba', 'combos'].includes(item.category));
    const products = cart.filter(item => item.category === 'produtos');

    const isServicesOnly = services.length > 0 && products.length === 0;
    const isProductsOnly = products.length > 0 && services.length === 0;
    const isMixed = services.length > 0 && products.length > 0;

    // Validações básicas
    if (!name || !phone) {
        alert(t.fillFields);
        return;
    }

    let msg = '';

    if (isServicesOnly) {
        // Apenas agendamento de serviços
        msg = `*AGENDAMENTO DE SERVIÇOS - SUA BARBEARIA*\n\n` +
              `*Cliente:* ${name}\n` +
              `*Telefone:* ${phone}\n\n` +
              `*SERVIÇOS SOLICITADOS:*\n` +
              services.map(i => `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2).replace('.', ',')}`).join('\n') +
              `\n\n*Total Serviços: R$ ${services.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2).replace('.', ',')}*\n` +
              (notes ? `\n*Observações:* ${notes}\n\n` : '\n') +
              `_Por favor, confirme a disponibilidade e agende o melhor horário!_`;

    } else {
        // Vendas (produtos apenas ou mistos)
        const deliveryMethod = document.getElementById('delivery-method').value;
        const cep = document.getElementById('customer-cep').value;
        const address = document.getElementById('customer-address').value;
        const number = document.getElementById('customer-number').value;
        const payment = document.getElementById('payment-method').value;

        if (!deliveryMethod || !payment) {
            alert(t.fillFields);
            return;
        }

        if (deliveryMethod === 'entrega' && (!cep || !address || !number)) {
            alert(t.fillFields);
            return;
        }

        const servicesTotal = services.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const productsTotal = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const itemsTotal = servicesTotal + productsTotal;
        const total = itemsTotal + (products.length > 0 && deliveryMethod === 'entrega' ? currentShippingCost : 0);

        let addressInfo = '';
        if (deliveryMethod === 'entrega') {
            addressInfo = `${t.cepLabel} ${cep}\n${t.addressLabel} ${address}, ${number}\n`;
        }

        const confirmationMsg = deliveryMethod === 'entrega' ? t.confirmDelivery : t.confirmPickup;
        const shippingText = (products.length > 0 && deliveryMethod === 'entrega') ? `*Frete: R$ ${currentShippingCost.toFixed(2).replace('.', ',')}*\n` : '';

        // Construir mensagem organizada
        let orderDetails = `${t.orderLabel}\n`;

        // Serviços
        if (services.length > 0) {
            orderDetails += `*SERVIÇOS:*\n`;
            services.forEach(item => {
                orderDetails += `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}\n`;
            });
            if (products.length > 0) orderDetails += '\n';
        }

        // Produtos
        if (products.length > 0) {
            orderDetails += `*PRODUTOS:*\n`;
            products.forEach(item => {
                orderDetails += `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}\n`;
            });
        }

        // Subtotais se houver ambos
        if (services.length > 0 && products.length > 0) {
            orderDetails += `\n*Subtotal Serviços: R$ ${servicesTotal.toFixed(2).replace('.', ',')}*\n`;
            orderDetails += `*Subtotal Produtos: R$ ${productsTotal.toFixed(2).replace('.', ',')}*\n`;
        }

        msg = `${t.newOrder}\n\n` +
              `${t.client} ${name}\n` +
              `*Telefone:* ${phone}\n` +
              `${t.deliveryMethodLabel} ${deliveryMethod === 'entrega' ? t.delivery : t.pickup}\n` +
              addressInfo +
              `${t.paymentLabel} ${payment}\n` +
              (notes ? `${t.notesLabel} ${notes}\n\n` : '\n') +
              orderDetails +
              `\n\n${shippingText}*Total: R$ ${total.toFixed(2).replace('.', ',')}*\n\n${confirmationMsg}`;
    }

    // Clear cart and form data after order
    localStorage.removeItem('cart');
    clearFormData();

    // Open WhatsApp in new tab
    window.open(`https://wa.me/5511991854713?text=${encodeURIComponent(msg)}`, '_blank');
    // Redirect to main page
    window.location.href = 'index.html';
}

document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
document.getElementById('customer-cep').addEventListener('input', handleCEPInput);
document.getElementById('customer-address').addEventListener('input', () => {
    const deliveryMethod = document.getElementById('delivery-method').value;
    if (deliveryMethod === 'entrega') {
        updateShippingCost();
    }
    saveFormData();
});
document.getElementById('customer-number').addEventListener('input', () => {
    const deliveryMethod = document.getElementById('delivery-method').value;
    if (deliveryMethod === 'entrega') {
        updateShippingCost();
    }
    saveFormData();
});

// Add event listeners to save form data on input changes
document.getElementById('customer-name').addEventListener('input', saveFormData);
document.getElementById('customer-phone').addEventListener('input', saveFormData);
document.getElementById('delivery-method').addEventListener('change', () => {
    toggleAddressFields();
    saveFormData();
});
document.getElementById('customer-cep').addEventListener('input', saveFormData);
document.getElementById('customer-address').addEventListener('input', saveFormData);
document.getElementById('customer-number').addEventListener('input', saveFormData);
document.getElementById('payment-method').addEventListener('change', saveFormData);
document.getElementById('customer-notes').addEventListener('input', saveFormData);

function detectOrderType() {
    // Separar serviços e produtos
    const services = cart.filter(item => ['cortes', 'barba', 'combos'].includes(item.category));
    const products = cart.filter(item => item.category === 'produtos');

    const isServicesOnly = services.length > 0 && products.length === 0;
    const isProductsOnly = products.length > 0 && services.length === 0;
    const isMixed = services.length > 0 && products.length > 0;

    // Ajustar título e subtítulo
    const titleElement = document.getElementById('page-title-text');
    const subtitleElement = document.getElementById('page-subtitle');

    if (isServicesOnly) {
        titleElement.textContent = 'Agendamento de Serviços';
        subtitleElement.textContent = 'Preencha suas informações para agendar seus serviços';
        document.title = 'Agendamento - Sua Barbearia';
    } else if (isProductsOnly) {
        titleElement.textContent = 'Detalhes da Compra';
        subtitleElement.textContent = 'Preencha suas informações para finalizar o pedido';
        document.title = 'Detalhes da Compra - Sua Barbearia';
    } else if (isMixed) {
        titleElement.textContent = 'Agendamento + Produtos';
        subtitleElement.textContent = 'Agende seus serviços e compre produtos';
        document.title = 'Agendamento + Produtos - Sua Barbearia';
    }

    // Ocultar campos desnecessários para agendamento apenas
    const deliveryMethodField = document.querySelector('label[for="delivery-method"]').parentElement;
    const addressFields = document.getElementById('address-fields');
    const paymentMethodField = document.querySelector('label[for="payment-method"]').parentElement;

    if (isServicesOnly) {
        // Para agendamento apenas, ocultar entrega e pagamento
        deliveryMethodField.style.display = 'none';
        addressFields.style.display = 'none';
        paymentMethodField.style.display = 'none';

        // Ajustar placeholder das observações
        const notesTextarea = document.getElementById('customer-notes');
        notesTextarea.placeholder = 'Preferências de horário, estilo desejado, etc...';

        // Alterar texto do botão
        const submitBtn = document.querySelector('#checkout-form button[type="submit"]');
        submitBtn.textContent = 'Agendar no WhatsApp';
    } else {
        // Para vendas, mostrar todos os campos
        deliveryMethodField.style.display = 'block';
        paymentMethodField.style.display = 'block';
        toggleAddressFields(); // Ajustar campos de endereço baseado na seleção atual
    }
}

window.onload = function() {
    loadCart();
    detectOrderType();
};
