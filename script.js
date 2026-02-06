    /**
 * CookieManager - Sistema robusto de gerenciamento de cookies
 * Seguindo boas práticas de programação e conformidade LGPD
 */
class CookieManager {
    constructor() {
        this.consentGiven = this.getCookie('cookieConsent') === 'accepted';
        this.essentialCookies = ['cart', 'checkoutFormData', 'cookieConsent'];
        this.preferenceCookies = ['language', 'theme'];
        this.marketingCookies = ['analytics', 'marketing'];
    }

    /**
     * Define um cookie com validação e sanitização
     * @param {string} name - Nome do cookie
     * @param {string} value - Valor do cookie
     * @param {number} days - Dias para expiração (opcional)
     * @param {boolean} sessionOnly - Se deve ser cookie de sessão
     * @param {boolean} httpOnly - Se deve ser HttpOnly (não implementável via JS)
     * @param {boolean} secure - Se deve ser seguro (HTTPS)
     */
    setCookie(name, value, days = null, sessionOnly = false, httpOnly = false, secure = false) {
        try {
            // Validação de entrada
            if (!name || typeof name !== 'string') {
                throw new Error('Nome do cookie inválido');
            }

            // Sanitização do valor
            const sanitizedValue = this.sanitizeValue(value);

            let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(sanitizedValue)}; path=/; SameSite=Lax`;

            // Expiração
            if (sessionOnly) {
                // Cookie de sessão - expira ao fechar navegador
            } else if (days && typeof days === 'number' && days > 0) {
                const expiryDate = new Date();
                expiryDate.setTime(expiryDate.getTime() + (days * 24 * 60 * 60 * 1000));
                cookieString += `; expires=${expiryDate.toUTCString()}`;
            }

            // Segurança
            if (secure && window.location.protocol === 'https:') {
                cookieString += '; Secure';
            }

            // Nota: HttpOnly não pode ser definido via JavaScript por segurança

            document.cookie = cookieString;
            return true;
        } catch (error) {
            console.error('Erro ao definir cookie:', error);
            return false;
        }
    }

    /**
     * Obtém o valor de um cookie
     * @param {string} name - Nome do cookie
     * @returns {string|null} Valor do cookie ou null se não encontrado
     */
    getCookie(name) {
        try {
            if (!name || typeof name !== 'string') {
                return null;
            }

            const nameEQ = encodeURIComponent(name) + "=";
            const ca = document.cookie.split(';');

            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(c.substring(nameEQ.length, c.length));
                }
            }
            return null;
        } catch (error) {
            console.error('Erro ao obter cookie:', error);
            return null;
        }
    }

    /**
     * Remove um cookie
     * @param {string} name - Nome do cookie
     */
    deleteCookie(name) {
        try {
            if (!name || typeof name !== 'string') {
                return;
            }

            // Remove definindo data de expiração no passado
            document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
        } catch (error) {
            console.error('Erro ao remover cookie:', error);
        }
    }

    /**
     * Verifica se um tipo de cookie pode ser usado
     * @param {string} cookieName - Nome do cookie
     * @returns {boolean} Se o cookie pode ser usado
     */
    canUseCookie(cookieName) {
        // Cookies essenciais sempre permitidos
        if (this.essentialCookies.includes(cookieName)) {
            return true;
        }

        // Outros cookies só com consentimento
        return this.consentGiven;
    }

    /**
     * Define consentimento para cookies
     * @param {boolean} accepted - Se o usuário aceitou
     */
    setConsent(accepted) {
        this.consentGiven = accepted;
        this.setCookie('cookieConsent', accepted ? 'accepted' : 'rejected', 365);
    }

    /**
     * Verifica se o consentimento foi dado
     * @returns {boolean} Se o consentimento foi dado
     */
    hasConsent() {
        return this.consentGiven;
    }

    /**
     * Remove todos os cookies não essenciais
     */
    removeNonEssentialCookies() {
        [...this.preferenceCookies, ...this.marketingCookies].forEach(cookieName => {
            this.deleteCookie(cookieName);
        });
    }

    /**
     * Sanitiza o valor do cookie
     * @param {*} value - Valor a ser sanitizado
     * @returns {string} Valor sanitizado
     */
    sanitizeValue(value) {
        if (value === null || value === undefined) {
            return '';
        }

        // Converte para string e remove caracteres potencialmente perigosos
        const stringValue = String(value);
        return stringValue.replace(/[<>\"'&]/g, '');
    }

    /**
     * Lista todos os cookies atuais
     * @returns {Object} Objeto com todos os cookies
     */
    listAllCookies() {
        const cookies = {};
        const ca = document.cookie.split(';');

        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            const eqPos = c.indexOf("=");
            if (eqPos > -1) {
                const name = decodeURIComponent(c.substr(0, eqPos));
                const value = decodeURIComponent(c.substr(eqPos + 1));
                cookies[name] = value;
            }
        }

        return cookies;
    }

    /**
     * Verifica se os cookies estão habilitados no navegador
     * @returns {boolean} Se os cookies estão habilitados
     */
    areCookiesEnabled() {
        try {
            this.setCookie('testCookie', 'test', 1);
            const testResult = this.getCookie('testCookie') === 'test';
            this.deleteCookie('testCookie');
            return testResult;
        } catch (error) {
            return false;
        }
    }
}

// Instância global do gerenciador de cookies
const cookieManager = new CookieManager();

const products = [
    { id: 1, name: "Corte Masculino Clássico", price: 25.00, category: "cortes", image: "corte-tradicional.png", description: "Corte masculino tradicional com acabamento perfeito. Inclui lavagem e finalização." },
    { id: 2, name: "Barba Completa", price: 20.00, category: "barba", image: "barba-completa.jpg", description: "Aparação e modelagem da barba com toalha quente e produtos premium." },
    { id: 3, name: "Corte + Barba", price: 40.00, category: "combos", image: "corte-mais-barba.jpg", description: "Combo completo: corte de cabelo + barba. Melhor preço!" },
    { id: 4, name: "Shampoo Profissional 250ml", price: 35.00, category: "produtos", image: "shampoo-masculino.jpg", description: "Shampoo profissional para cabelos masculinos. Hidratação intensa." },
    { id: 5, name: "Óleo para Barba 50ml", price: 28.00, category: "produtos", image: "oleo-para-barba.jpg", description: "Óleo natural para barba. Hidrata e dá brilho aos pelos." },
    { id: 6, name: "Corte Moderno", price: 30.00, category: "cortes", image: "corte-moderno.jpg", description: "Corte moderno com técnicas atuais. Para quem quer estar na moda." },
    { id: 7, name: "Bigode", price: 15.00, category: "barba", image: "barba-bigode.jpg", description: "Aparação e modelagem do bigode. Detalhes perfeitos." },
    { id: 8, name: "Kit Barbearia Completo", price: 120.00, category: "combos", image: "kit-barbearia-completo.jpg", description: "Kit com tesoura, máquina, pentes e produtos. Para profissionais." },
    { id: 9, name: "Condicionador 250ml", price: 32.00, category: "produtos", image: "consicionador-masculino.jpg", description: "Condicionador premium para cabelos masculinos." },
    { id: 10, name: "Creme para Barba 100ml", price: 25.00, category: "produtos", image: "creme-para-barba.jpg", description: "Creme hidratante para barba. Previne irritações." },
    { id: 11, name: "Corte Militar", price: 22.00, category: "cortes", image: "corte-militar.jpg", description: "Corte curto e limpo. Ideal para dias quentes." },
    { id: 12, name: "Sobrancelha", price: 12.00, category: "barba", image: "sobrancelha.jpg", description: "Aparação das sobrancelhas. Define o olhar." },
    { id: 13, name: "Gel Fixador 200ml", price: 18.00, category: "produtos", image: "gel-medio.jpg", description: "Gel para fixação forte. Segura o penteado o dia todo." },
    { id: 14, name: "Máquina de Cortar Cabelo", price: 89.00, category: "produtos", image: "maquina-de-cortar-cabelo.jpg", description: "Máquina profissional para cortes em casa." },
    { id: 15, name: "Corte + Sobrancelha", price: 35.00, category: "combos", image: "corte-mais-barba.jpg", description: "Corte de cabelo + aparação de sobrancelhas." },
    { id: 16, name: "Pomada Modeladora 100ml", price: 22.00, category: "produtos", image: "pasta-modeladora.jpg", description: "Pomada para modelar cabelos. Acabamento natural." },
    { id: 17, name: "Barba + Bigode", price: 25.00, category: "barba", image: "barba-bigode.jpg", description: "Combo barba completa + modelagem do bigode." },
    { id: 18, name: "Tesoura Profissional", price: 45.00, category: "produtos", image: "tesoura-profissional.jpg", description: "Tesoura de corte profissional. Afiada e precisa." },
    { id: 19, name: "Corte Degradê", price: 35.00, category: "cortes", image: "corte-moderno.jpg", description: "Corte degradê moderno. Tendência atual." },
    { id: 20, name: "Kit Higiene Pessoal", price: 55.00, category: "combos", image: "kit-higiene-pessoal.jpg", description: "Kit com shampoo, condicionador e óleo para barba." }
];

let cart = [];

function saveCartToStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    let saved = localStorage.getItem('cart');
    if (!saved) {
        // Migrate from cookies if not in localStorage
        saved = cookieManager.getCookie('cart');
        if (saved) {
            localStorage.setItem('cart', saved);
            cookieManager.deleteCookie('cart');
        }
    }
    if (saved) {
        try {
            cart = JSON.parse(saved);
            updateUI();
        } catch (error) {
            console.error('Erro ao carregar carrinho:', error);
            cart = [];
        }
    }
}

function renderProducts(items) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = items.map(product => `
        <div class="product-card bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div class="relative overflow-hidden">
                 <img src="${product.image}" onclick="showProductDetail(${product.id})" class="w-full h-40 object-cover hover:scale-110 transition-transform duration-300 cursor-pointer">
                 <div class="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-lg font-bold">
                    ${product.category.toUpperCase()}
                 </div>
            </div>
            <div class="p-4">
                <h4 class="font-bold text-sm text-gray-800 line-clamp-2 h-10 mb-1">${product.name}</h4>
                <span class="block text-xl font-brand font-bold text-zinc-900 mb-3">R$ ${product.price.toFixed(2).replace('.', ',')}</span>

                <!-- SELETOR DE QUANTIDADE NO CARD -->
                <div class="flex items-center justify-between bg-gray-50 rounded-xl p-1 mb-3 border border-gray-100">
                    <button onclick="adjustQty(${product.id}, -1)" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-zinc-900 hover:bg-gray-100 transition-colors">-</button>
                    <input type="number" id="qty-${product.id}" value="1" min="1" class="w-10 bg-transparent text-center font-bold text-sm outline-none" readonly>
                    <button onclick="adjustQty(${product.id}, 1)" class="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-zinc-900 hover:bg-gray-100 transition-colors">+</button>
                </div>

                <button onclick="${product.category === 'produtos' ? `addToCart(${product.id})` : `showScheduleModal(${product.id})`}" class="w-full bg-zinc-900 text-white py-2.5 rounded-xl text-[11px] font-bold uppercase hover:bg-yellow-400 hover:text-black transition-all active:scale-95 shadow-sm">${product.category === 'produtos' ? translations[currentLanguage].addButton : translations[currentLanguage].scheduleButton}</button>
            </div>
        </div>
    `).join('');
}

function adjustQty(id, delta) {
    const input = document.getElementById(`qty-${id}`);
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
}

// Nova função para ajustar quantidade dentro do carrinho
function adjustCartQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity < 1) {
            remove(id);
        } else {
            updateUI();
            saveCartToStorage();
        }
    }
}

function addToCart(id, customQty = null) {
    const product = products.find(p => p.id === id);
    const qtyInput = document.getElementById(`qty-${id}`);
    const quantity = customQty !== null ? customQty : parseInt(qtyInput.value);

    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({ ...product, quantity: quantity });
    }

    if (qtyInput) qtyInput.value = 1;
    updateUI();
    saveCartToStorage();

    const btn = event.target;
    if (btn && btn.tagName === 'BUTTON') {
        const originalText = btn.innerText;
        btn.innerText = "ADICIONADO! ✓";
        btn.classList.replace('bg-zinc-900', 'bg-green-500');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.replace('bg-green-500', 'bg-zinc-900');
        }, 800);
    }
}

function updateUI() {
    document.getElementById('cart-count').innerText = cart.reduce((s, i) => s + i.quantity, 0);
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    document.getElementById('cart-total').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

    const cartContainer = document.getElementById('cart-items');
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-gray-400">
                <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                </div>
                <p class="text-xs uppercase font-bold tracking-widest">Carrinho vazio</p>
            </div>
        `;
        return;
    }

    // Separar serviços e produtos
    const services = cart.filter(item => ['cortes', 'barba', 'combos'].includes(item.category));
    const products = cart.filter(item => item.category === 'produtos');

    let cartHTML = '';

    // Serviços (Cortes, Barba, Combos)
    if (services.length > 0) {
        cartHTML += `<div class="mb-4">
            <h4 class="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">🪒 Serviços</h4>`;
        services.forEach(item => {
            cartHTML += `
                <div class="flex items-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm relative animate-in fade-in slide-in-from-right-4 duration-300 mb-2">
                    <img src="${item.image}" class="w-12 h-12 object-cover rounded-lg shadow-sm">
                    <div class="flex-grow">
                        <h5 class="text-[10px] font-bold text-gray-800 uppercase tracking-tight leading-tight mb-1">${item.name}</h5>
                        <div class="flex items-center justify-between">
                            <p class="text-xs font-brand font-bold text-zinc-900">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                            <div class="flex items-center gap-1 bg-gray-50 rounded-md p-0.5 border border-gray-100">
                                <button onclick="adjustCartQty(${item.id}, -1)" class="w-4 h-4 flex items-center justify-center bg-white rounded shadow-sm text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors">-</button>
                                <span class="text-xs font-bold w-3 text-center">${item.quantity}</span>
                                <button onclick="adjustCartQty(${item.id}, 1)" class="w-4 h-4 flex items-center justify-center bg-white rounded shadow-sm text-xs font-bold hover:bg-green-50 hover:text-green-500 transition-colors">+</button>
                            </div>
                        </div>
                    </div>
                    <button onclick="remove(${item.id})" class="text-gray-300 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            `;
        });
        cartHTML += `</div>`;
    }

    // Produtos
    if (products.length > 0) {
        cartHTML += `<div class="mb-4">
            <h4 class="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">🛍️ Produtos</h4>`;
        products.forEach(item => {
            cartHTML += `
                <div class="flex items-center gap-3 bg-green-50 p-3 rounded-xl border border-green-100 shadow-sm relative animate-in fade-in slide-in-from-right-4 duration-300 mb-2">
                    <img src="${item.image}" class="w-12 h-12 object-cover rounded-lg shadow-sm">
                    <div class="flex-grow">
                        <h5 class="text-[10px] font-bold text-gray-800 uppercase tracking-tight leading-tight mb-1">${item.name}</h5>
                        <div class="flex items-center justify-between">
                            <p class="text-xs font-brand font-bold text-zinc-900">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                            <div class="flex items-center gap-1 bg-gray-50 rounded-md p-0.5 border border-gray-100">
                                <button onclick="adjustCartQty(${item.id}, -1)" class="w-4 h-4 flex items-center justify-center bg-white rounded shadow-sm text-xs font-bold hover:bg-red-50 hover:text-red-500 transition-colors">-</button>
                                <span class="text-xs font-bold w-3 text-center">${item.quantity}</span>
                                <button onclick="adjustCartQty(${item.id}, 1)" class="w-4 h-4 flex items-center justify-center bg-white rounded shadow-sm text-xs font-bold hover:bg-green-50 hover:text-green-500 transition-colors">+</button>
                            </div>
                        </div>
                    </div>
                    <button onclick="remove(${item.id})" class="text-gray-300 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            `;
        });
        cartHTML += `</div>`;
    }

    cartContainer.innerHTML = cartHTML;
}

function remove(id) {
    cart = cart.filter(i => i.id !== id);
    updateUI();
    saveCartToStorage();
}

function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('translate-x-full');
    document.getElementById('cart-overlay').classList.toggle('hidden');
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    menu.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function filterCategory(cat) {
    if (cat === 'todos') renderProducts(products);
    else renderProducts(products.filter(p => p.category === cat));
    const t = translations[currentLanguage];
    document.getElementById('category-title').innerText = t.categories[cat] || cat;
    window.scrollTo({ top: 400, behavior: 'smooth' });
}

function searchProducts() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = products.filter(p => p.name.toLowerCase().includes(query));
    renderProducts(filtered);
}

function checkout() {
    if (cart.length === 0) return;

    // Sempre ir para checkout, que lida com serviços, produtos ou ambos
    window.location.href = 'checkout.html';
}

// Traduções
const translations = {
    pt: {
        title: 'Cortes Perfeitos & Estilo Impecável!',
        searchPlaceholder: 'O que você procura?',
        categoryTitle: 'Destaques',
        categories: {
            todos: 'Todos',
            cortes: 'Cortes',
            barba: 'Barba',
            produtos: 'Produtos',
            combos: 'Combos'
        },
        cartTitle: 'Meu Carrinho',
        close: 'Fechar',
        emptyCart: 'Carrinho vazio',
        total: 'Total:',
        purchaseDetails: 'Voltar',
        addToCart: 'Adicionar ao Carrinho',
        addButton: 'Adicionar',
        scheduleButton: 'Agendar',
        scheduleService: 'Agendar Serviço',
        contact: 'Contato',
        footerButtons: {
            whatsapp: 'WhatsApp',
            location: 'Localização',
            instagram: 'Instagram'
        },
        categoriesTitle: 'Categorias',
        scheduleModal: {
            title: 'Agendar Serviço',
            name: 'Nome Completo *',
            phone: 'Telefone *',
            service: 'Serviço *',
            select: 'Selecione...',
            date: 'Data *',
            time: 'Horário *',
            notes: 'Observações',
            notesPlaceholder: 'Instruções especiais...',
            button: 'Agendar no WhatsApp'
        },
        copyright: '&copy; 2023 Sua Barbearia. Todos os direitos reservados.',
        cookieText: 'Este site usa cookies para melhorar sua experiência. Cookies essenciais são sempre permitidos. Aceite para cookies não essenciais (preferências, marketing).',
        accept: 'Aceitar',
        reject: 'Rejeitar'
    },
    en: {
        title: 'Perfect Cuts & Impeccable Style!',
        searchPlaceholder: 'What are you looking for?',
        categoryTitle: 'Highlights',
        categories: {
            todos: 'All',
            cortes: 'Cuts',
            barba: 'Beard',
            produtos: 'Products',
            combos: 'Combos'
        },
        cartTitle: 'My Cart',
        close: 'Close',
        emptyCart: 'Empty cart',
        total: 'Total:',
        purchaseDetails: 'BACK',
        addToCart: 'Add to Cart',
        addButton: 'Add',
        scheduleButton: 'Schedule',
        scheduleService: 'Schedule Service',
        contact: 'Contact',
        footerButtons: {
            whatsapp: 'WhatsApp',
            location: 'Location',
            instagram: 'Instagram'
        },
        categoriesTitle: 'Categories',
        scheduleModal: {
            title: 'Schedule Service',
            name: 'Full Name *',
            phone: 'Phone *',
            service: 'Service *',
            select: 'Select...',
            date: 'Date *',
            time: 'Time *',
            notes: 'Notes',
            notesPlaceholder: 'Special instructions...',
            button: 'Schedule on WhatsApp'
        },
        copyright: '&copy; 2023 Your Barbershop. All rights reserved.',
        cookieText: 'This site uses cookies to improve your experience. Essential cookies are always allowed. Accept for non-essential cookies (preferences, marketing).',
        accept: 'Accept',
        reject: 'Reject'
    }
};

// Preferências persistentes com localStorage
let currentLanguage = localStorage.getItem('language') || 'pt';

function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updateLanguage();
}

function updateLanguage() {
    const t = translations[currentLanguage];

    // Título da página (browser tab)
    document.title = t.title + ' - Sua Barbearia';

    // Título principal
    const title = document.querySelector('h2');
    if (title) {
        title.textContent = t.title;
    }

    // Placeholder da busca
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = t.searchPlaceholder;
    }

    // Título da categoria
    const categoryTitle = document.getElementById('category-title');
    if (categoryTitle) {
        categoryTitle.textContent = t.categoryTitle;
    }

    // Botões de categoria desktop
    const desktopCategoryButtons = document.querySelectorAll('nav button[onclick*="filterCategory"]');
    desktopCategoryButtons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        const match = onclick.match(/filterCategory\('(\w+)'\)/);
        if (match) {
            const cat = match[1];
            btn.textContent = t.categories[cat] || cat;
        }
    });

    // Botões de categoria mobile
    const mobileCategoryButtons = document.querySelectorAll('#mobile-menu button[onclick*="filterCategory"]');
    mobileCategoryButtons.forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        const match = onclick.match(/filterCategory\('([^']+)'\)/);
        if (match) {
            const cat = match[1];
            btn.textContent = t.categories[cat] || cat;
        }
    });

    // Carrinho
    const cartTitle = document.querySelector('#cart-sidebar h3');
    if (cartTitle) {
        cartTitle.textContent = t.cartTitle;
    }

    const closeBtn = document.querySelector('#cart-sidebar button');
    if (closeBtn) {
        closeBtn.textContent = t.close;
    }

    const emptyCartText = document.querySelector('#cart-items p');
    if (emptyCartText) {
        emptyCartText.textContent = t.emptyCart;
    }

    const totalLabel = document.querySelector('#cart-sidebar span:first-child');
    if (totalLabel) {
        totalLabel.textContent = t.total;
    }

    const purchaseBtn = document.querySelector('#cart-sidebar button:last-child');
    if (purchaseBtn) {
        purchaseBtn.textContent = t.purchaseDetails;
    }



    // Botões de adicionar produto
    const addButtons = document.querySelectorAll('.product-card button');
    addButtons.forEach(btn => {
        if (btn.textContent.toLowerCase() === 'adicionar' || btn.textContent.toLowerCase() === 'add') {
            btn.textContent = t.addButton;
        } else if (btn.textContent.toLowerCase() === 'agendar' || btn.textContent.toLowerCase() === 'schedule') {
            btn.textContent = t.scheduleButton;
        }
    });

    // Footer
    const contactTitle = document.querySelector('footer h3');
    if (contactTitle) {
        contactTitle.textContent = t.contact;
    }

    const footerLinks = document.querySelectorAll('footer a');
    footerLinks.forEach(link => {
        if (link.textContent === 'WhatsApp' || link.textContent === 'Localização' || link.textContent === 'Instagram') {
            if (link.textContent === 'WhatsApp') link.textContent = t.footerButtons.whatsapp;
            else if (link.textContent === 'Localização') link.textContent = t.footerButtons.location;
            else if (link.textContent === 'Instagram') link.textContent = t.footerButtons.instagram;
        }
    });

    // Age warning removed as we have cookie verification

    // Removed to allow HTML copyright text

    // Cookie banner
    const cookieText = document.querySelector('#cookie-banner p');
    if (cookieText) {
        cookieText.textContent = t.cookieText;
    }

    const acceptBtn = document.getElementById('accept-cookies');
    if (acceptBtn) {
        acceptBtn.textContent = t.accept;
    }

    const rejectBtn = document.getElementById('reject-cookies');
    if (rejectBtn) {
        rejectBtn.textContent = t.reject;
    }

    // Botão de idioma
    const langBtn = document.getElementById('lang-text');
    if (langBtn) {
        langBtn.textContent = currentLanguage.toUpperCase();
    }

    // Atualizar botão do modal de produto se estiver aberto
    const modalBtn = document.querySelector('#product-modal button:last-child');
    if (modalBtn && currentModalProductId) {
        const product = products.find(p => p.id === currentModalProductId);
        if (product) {
            if (product.category === 'produtos') {
                modalBtn.textContent = t.addToCart;
            } else {
                modalBtn.textContent = t.scheduleService;
            }
        }
    }

    // Atualizar título e botão do menu mobile
    const mobileTitle = document.querySelector('#mobile-menu h3');
    if (mobileTitle) {
        mobileTitle.textContent = t.categoriesTitle;
    }

    const mobileCloseBtn = document.querySelector('#mobile-menu button[onclick*="toggleMobileMenu"]');
    if (mobileCloseBtn) {
        mobileCloseBtn.textContent = t.close;
    }

    // Atualizar modal de agendamento
    const scheduleTitle = document.querySelector('#schedule-modal h3');
    if (scheduleTitle) {
        scheduleTitle.textContent = t.scheduleModal.title;
    }

    const nameLabel = document.querySelector('#schedule-modal label[for="schedule-name"]');
    if (nameLabel) {
        nameLabel.textContent = t.scheduleModal.name;
    }

    const phoneLabel = document.querySelector('#schedule-modal label[for="schedule-phone"]');
    if (phoneLabel) {
        phoneLabel.textContent = t.scheduleModal.phone;
    }

    const serviceLabel = document.querySelector('#schedule-modal label[for="schedule-service"]');
    if (serviceLabel) {
        serviceLabel.textContent = t.scheduleModal.service;
    }

    const dateLabel = document.querySelector('#schedule-modal label[for="schedule-date"]');
    if (dateLabel) {
        dateLabel.textContent = t.scheduleModal.date;
    }

    const timeLabel = document.querySelector('#schedule-modal label[for="schedule-time"]');
    if (timeLabel) {
        timeLabel.textContent = t.scheduleModal.time;
    }

    const notesLabel = document.querySelector('#schedule-modal label[for="schedule-notes"]');
    if (notesLabel) {
        notesLabel.textContent = t.scheduleModal.notes;
    }

    const notesTextarea = document.getElementById('schedule-notes');
    if (notesTextarea) {
        notesTextarea.placeholder = t.scheduleModal.notesPlaceholder;
    }

    const scheduleBtn = document.querySelector('#schedule-modal button[type="submit"]');
    if (scheduleBtn) {
        scheduleBtn.textContent = t.scheduleModal.button;
    }

    const serviceSelect = document.getElementById('schedule-service');
    if (serviceSelect && serviceSelect.options[0]) {
        serviceSelect.options[0].text = t.scheduleModal.select;
    }

    const timeSelect = document.getElementById('schedule-time');
    if (timeSelect && timeSelect.options[0]) {
        timeSelect.options[0].text = t.scheduleModal.select;
    }
}



window.onload = () => {
    renderProducts(products);
    loadCartFromStorage();
    updateLanguage();
};

// Funções do modal de detalhes do produto
let currentModalProductId = null;

function showProductDetail(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;

    currentModalProductId = id;

    document.getElementById('modal-image').src = product.image;
    document.getElementById('modal-name').textContent = product.name;
    document.getElementById('modal-description').textContent = product.description;
    document.getElementById('modal-price').textContent = `R$ ${product.price.toFixed(2).replace('.', ',')}`;
    document.getElementById('modal-category').textContent = product.category.toUpperCase();
    document.getElementById('modal-qty').value = 1;

    const modalBtn = document.querySelector('#product-modal button:last-child');
    if (product.category === 'produtos') {
        modalBtn.textContent = translations[currentLanguage].addToCart;
        modalBtn.onclick = () => addToCartFromModal();
    } else {
        modalBtn.textContent = translations[currentLanguage].scheduleService;
        modalBtn.onclick = () => { closeProductModal(); showScheduleModal(currentModalProductId); };
    }

    document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
    currentModalProductId = null;
}

function adjustQtyModal(delta) {
    const input = document.getElementById('modal-qty');
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    input.value = val;
}

function addToCartFromModal() {
    if (!currentModalProductId) return;

    const qty = parseInt(document.getElementById('modal-qty').value);
    addToCart(currentModalProductId, qty);
    closeProductModal();
}

// Funções do modal de agendamento
function showScheduleModal(serviceId = null) {
    document.getElementById('schedule-modal').classList.remove('hidden');
    if (serviceId) {
        const product = products.find(p => p.id === serviceId);
        if (product) {
            document.getElementById('schedule-service').value = product.name;
        }
    }
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
}

function handleScheduleSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('schedule-name').value;
    const phone = document.getElementById('schedule-phone').value;
    const service = document.getElementById('schedule-service').value;
    const date = document.getElementById('schedule-date').value;
    const time = document.getElementById('schedule-time').value;
    const notes = document.getElementById('schedule-notes').value;

    const msg = `Olá! Gostaria de agendar um serviço:\n\n` +
                `Nome: ${name}\n` +
                `Telefone: ${phone}\n` +
                `Serviço: ${service}\n` +
                `Data: ${date}\n` +
                `Horário: ${time}\n` +
                (notes ? `Observações: ${notes}\n\n` : '\n') +
                `Aguardo confirmação!`;

    // Clear form
    document.getElementById('schedule-form').reset();
    closeScheduleModal();

    // Open WhatsApp
    window.open(`https://wa.me/5511991854713?text=${encodeURIComponent(msg)}`, '_blank');
}

// Funções de gerenciamento do banner de cookies
function showCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner && !cookieManager.hasConsent()) {
        banner.classList.remove('translate-y-full');
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.add('translate-y-full');
    }
}

function acceptCookies() {
    cookieManager.setConsent(true);
    hideCookieBanner();
    console.log('Cookies aceitos. Cookies funcionais ativados.');
}

function rejectCookies() {
    cookieManager.setConsent(false);
    cookieManager.removeNonEssentialCookies();
    hideCookieBanner();
    console.log('Cookies rejeitados. Apenas cookies essenciais serão usados.');
}

// Inicialização do banner de cookies
function initializeCookieBanner() {
    // Verificar se cookies estão habilitados
    if (!cookieManager.areCookiesEnabled()) {
        console.warn('Cookies estão desabilitados no navegador. Algumas funcionalidades podem não funcionar corretamente.');
        return;
    }

    // Mostrar banner se não houver consentimento
    if (!cookieManager.hasConsent()) {
        // Pequeno delay para garantir que o DOM esteja carregado
        setTimeout(() => {
            showCookieBanner();
            // Aceitar automaticamente após 5 segundos
            setTimeout(() => {
                acceptCookies();
            }, 5000);
        }, 1000);
    }

    // Adicionar event listeners aos botões
    const acceptBtn = document.getElementById('accept-cookies');
    const rejectBtn = document.getElementById('reject-cookies');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptCookies);
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', rejectCookies);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar banner de cookies
    initializeCookieBanner();

    // Outros event listeners existentes
    const scheduleForm = document.getElementById('schedule-form');
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleScheduleSubmit);
    }
});
