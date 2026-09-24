# ⚡ Nexus CRM - Gestão Inteligente com Google Cloud Firestore

O **Nexus CRM** é um sistema completo de gestão de relacionamento com clientes e funil de vendas, construído com arquitetura moderna e integração nativa em tempo real com o banco de dados NoSQL do Google: **Cloud Firestore (Firebase)**.

---

## 🌟 Principais Funcionalidades

- **Funil de Vendas (Kanban)**: Pipeline visual dividido em 6 etapas: *Novo Lead*, *Primeiro Contato*, *Proposta Enviada*, *Em Negociação*, *Fechado Ganho* e *Perdido*. Suporte a arrastar e soltar (drag & drop) e seletor rápido.
- **Google Cloud Firestore (Tempo Real)**: Conexão direta com o Firestore via Firebase Modular SDK v11+. Qualquer dado criado, alterado ou excluído atualiza todos os navegadores simultaneamente com `onSnapshot`.
- **Modo Híbrido Sem Travamento**: O app inicia instantaneamente em modo demonstração local com dados realistas pré-carregados. Ao inserir suas credenciais do Firebase, ele migra e sincroniza na nuvem automaticamente.
- **Painel de KPIs & Métricas**: Cálculo em tempo real do Total em Pipeline (R$), Negócios Ganhos, Taxa de Conversão (%) e Ticket Médio.
- **Tabela Completa de Clientes**: Visão detalhada com avatares, filtros por busca dinâmica (nome, empresa, tags) e filtros por prioridade (Alta, Média, Baixa).
- **Design de Alto Padrão**: Dark mode refinado com efeito de vidro (glassmorphism), paleta de cores HSL, tipografia Google Fonts (Inter e Outfit) e micro-animações fluidas.

---

## 🚀 Como Executar Localmente

Você pode rodar a aplicação usando qualquer servidor estático local ou o Node.js:

### Opção 1: Com Node.js (Recomendado)
```bash
npx serve .
# ou
npx http-server -p 3000
```

### Opção 2: Com Python
```bash
python -m http.server 3000
```
Em seguida, abra `http://localhost:3000` no seu navegador!

---

## ☁️ Como Conectar ao seu Projeto do Firebase

1. Acesse o [Console do Firebase](https://console.firebase.google.com/) e crie ou selecione seu projeto.
2. No menu lateral, acesse **Build > Firestore Database** e clique em **Criar banco de dados** (escolha o modo de teste para começar).
3. Vá em **Configurações do Projeto** (ícone de engrenagem no topo esquerdo) e role até **Seus Aplicativos**.
4. Se ainda não tiver um app web, clique em **Adicionar aplicativo (ícone `</>`)**.
5. No **Nexus CRM**, clique no botão **"Google Cloud Config"** no menu lateral ou na pílula de status no topo direito.
6. Cole seu `projectId` e sua `apiKey` e clique em **"Conectar e Sincronizar"**.
7. Pronto! A pílula mudará para **"Google Cloud Firestore"** e todos os seus leads serão gravados diretamente na nuvem do Google.
