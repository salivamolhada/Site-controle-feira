# FeiraFinance Pro — Sistema de Gestão Financeira para Feiras e Eventos

Plataforma profissional de alta fidelidade para gestão financeira e operacional de feiras, exposições comerciais e eventos de negócios. Desenvolvida em **Vanilla JavaScript, HTML5 e CSS3 puro**, com padrão estético e de usabilidade de SaaS moderno (nível Linear, Stripe, Vercel e Notion).

---

## 🏗️ Estrutura de Arquivos

```text
/
├── index.html          → SPA principal com navegação modular por abas, launchpad e modais
├── README.md           → Documentação técnica e guia de execução
├── css/
│   ├── styles.css      → Variáveis CSS (design tokens), tema claro/escuro, layout base
│   └── components.css  → Componentes de UI (KPIs com sparklines, estandes, recibo oficial, print)
└── js/
    ├── storage.js      → Persistência abstrata (localStorage + demo data de transações e estandes)
    ├── ui.js           → Máscaras monetárias (R$), modal de recibo oficial, sintetizador de áudio Web Audio
    ├── charts.js       → Gráficos em HTML5 Canvas puro (evolução com curva suave, barras duplas e donut)
    ├── dashboard.js    → Cálculo de KPIs, sparklines, meta de arrecadação, ponto de equilíbrio e liquidez
    ├── transactions.js → CRUD completo de lançamentos, validações inline, ordenação e ações em lote
    ├── booths.js       → Módulo completo de Estandes & Expositores (locação, adimplência e pagamento rápido)
    ├── filters.js      → Filtros por tipo, categoria, busca textual, intervalos de data e paginação
    ├── export.js       → Exportação formatada para CSV (com BOM UTF-8 para Excel), JSON e impressão de balanço
    └── app.js          → Ponto de entrada, roteamento SPA, atalhos rápidos e controle de tema
```

---

## 🚀 Funcionalidades Principais

1. **Dashboard Executivo & KPIs:**
   - 4 Cartões de KPI: Total Recebido, Total Pago, Saldo Atual e Margem Líquida (%), com comparativo vs. período anterior e **sparklines em Canvas puro**.
   - **Meta de Arrecadação & Ponto de Equilíbrio (Break-Even):** Barra de progresso com meta financeira configurável e cálculo em tempo real do ponto de equilíbrio operacional.
   - **Fechamento de Caixa por Liquidez:** Decomposição instantânea entre PIX, Dinheiro em Espécie e Cartões.
   - **Gráficos em Canvas Retina Puro:**
     - Gráfico de Linha com gradiente suave e crosshair interativo com tooltip monetário.
     - Gráfico de Barras duplas com cantos arredondados (Receitas vs. Despesas).
     - Gráfico de Donut com recorte central, valor consolidado e legenda interativa.

2. **Gestão de Estandes & Expositores (Booths):**
   - Controle de ocupação por setor (Gastronomia, Artesanato, Moda, Agro, Tecnologia).
   - Status de adimplência (Quitado, Parcial, Pendente) com indicação de saldo a receber.
   - Ação rápida **"Registrar Pagamento"**: pré-preenche automaticamente o modal de receita com o valor restante e os dados do expositor.
   - Exportação dedicada da listagem de estandes em CSV.

3. **Recibo Oficial com Impressão:**
   - Geração de recibo formal para qualquer lançamento com número serial, código hash de autenticação e valor por extenso em reais.
   - Layout pronto para impressão (`@media print`) e assinatura.

4. **Gestão de Lançamentos (CRUD):**
   - Lançamento ágil de Receitas e Despesas com abas no modal e máscara monetária em tempo real (`R$ 0,00`).
   - Tabela interativa com ordenação por qualquer coluna, seleção individual e exclusão em lote.
   - Paginação configurável (5, 10, 20 ou 50 registros por página).

5. **Filtros e Busca Inteligente:**
   - Filtros por Tipo (Todos, Receitas, Despesas), Categoria, Busca Textual e Intervalos de Datas (Hoje, Últimos 7 dias, Este mês, Este ano).
   - Chips de filtros ativos com remoção em 1 clique.

6. **Relatórios e Análises:**
   - Demonstrativo consolidado por categoria e por meio de pagamento.
   - Exportação em CSV com delimitador `;` e BOM UTF-8 compatível com Microsoft Excel.
   - Exportação de backup completo em JSON e impressão formatada do balanço do evento.

7. **Configurações & Experiência de Uso:**
   - Personalização do nome da feira, edição, localização, datas e meta financeira.
   - Gerenciamento de categorias customizadas.
   - Alternância entre tema claro e escuro persistida no navegador e respeitando `prefers-color-scheme`.
   - Feedback acústico opcional (Web Audio API) com botão de ativar/desativar som.
   - Restauração instantânea de dados de demonstração com um clique.

---

## 💻 Como Executar

1. Clone ou extraia os arquivos do projeto.
2. Inicie o servidor Vite (`npm run dev`) e acesse `http://localhost:3000`.
3. Todos os dados permanecem salvos localmente via `localStorage`.

