# Sua Barbearia 🪒

E-commerce para barbearia com sistema de agendamento e delivery.

## Estrutura do Projeto

```
sua-barbearia/
├── pages/              # Páginas HTML
│   ├── index.html      # Página principal (loja)
│   └── checkout.html   # Página de checkout
├── js/                 # JavaScript
│   ├── script.js       # Lógica principal (produtos, carrinho, UI)
│   └── checkout.js     # Lógica de checkout e entrega
├── css/
│   └── styles.css      # Estilos personalizados
├── images/             # Imagens de produtos e assets
│   ├── produtos/       # Imagens dos produtos
│   └── logo.png       # Logo da barbearia
├── docs/               # Documentação
└── vercel.json         # Configuração de deploy
```

## Funcionalidades

- **Catálogo de Produtos**: Cortes, barbas, produtos masculinos
- **Carrinho de Compras**: Adicionar/remover itens
- **Agendamento**:选择日期和时间预约服务
- **Checkout**: Formulário com cálculo de frete
- **Integração WhatsApp**: Envio de pedidos via WhatsApp
- **Banner de Cookies**: Conformidade LGPD

## Tecnologias

- HTML5, CSS3, JavaScript
- Tailwind CSS (CDN)
- Vercel (deploy)

## Deploy

O projeto está configurado para deploy automático no Vercel. O arquivo `vercel.json` redireciona as requisições para a pasta `pages/`.
