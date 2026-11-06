/**
 * FeiraFinance — Main Application Entry Point
 * Roteamento SPA, Gerenciamento de Tema, Relatórios e Configurações
 */

import { Storage, DEFAULT_CATEGORIES } from './storage.js';
import { formatBRL, showToast, openModal, closeModal, escapeHTML, openReceiptModal } from './ui.js';
import { updateDashboard } from './dashboard.js';
import {
  initTransactionsModule,
  renderTransactionsTable,
  openNewTransactionModal
} from './transactions.js';
import {
  FilterState,
  renderActiveFilterChips,
  updateCategoryFilterOptions
} from './filters.js';
import {
  exportTransactionsToCSV,
  exportDataToJSON,
  exportCategoriesSummaryCSV,
  exportBoothsToCSV,
  printFinancialReport
} from './export.js';
import {
  initBoothsModule,
  renderBoothsView,
  openBoothModal
} from './booths.js';

// Estado global da aplicação
let currentTab = 'dashboard';

/**
 * Inicialização ao carregar o DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAudioControls();
  initNavigation();
  initQuickLaunchpad();
  initTransactionsModule();
  initBoothsModule();
  initFilterControls();
  initReportsModule();
  initSettingsModule();
  initGlobalShortcuts();

  // Carrega opções de categorias nos filtros
  updateCategoryFilterOptions();

  // Renderização inicial
  updateDashboard();
  renderTransactionsTable();

  // Registra ouvinte nos filtros para atualizar tabela e chips
  FilterState.subscribe(() => {
    renderTransactionsTable();
    renderActiveFilterChips();
  });

  // Reajuste de gráficos ao redimensionar a janela
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (currentTab === 'dashboard') {
        updateDashboard();
      }
    }, 150);
  });
});

/* --------------------------------------------------------
   1. GERENCIAMENTO DE TEMA (CLARO / ESCURO)
   -------------------------------------------------------- */
function initTheme() {
  const savedTheme = Storage.getTheme();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

  applyTheme(initialTheme);

  // Botão no Header
  const btnToggleTheme = document.getElementById('btn-theme-toggle');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      Storage.saveTheme(nextTheme);
    });
  }

  // Radios na tela de Configurações
  document.querySelectorAll('input[name="app-theme-choice"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      applyTheme(e.target.value);
      Storage.saveTheme(e.target.value);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  const iconMoon = document.getElementById('icon-theme-moon');
  const iconSun = document.getElementById('icon-theme-sun');

  if (theme === 'light') {
    if (iconMoon) iconMoon.classList.remove('hidden');
    if (iconSun) iconSun.classList.add('hidden');
  } else {
    if (iconMoon) iconMoon.classList.add('hidden');
    if (iconSun) iconSun.classList.remove('hidden');
  }

  // Atualiza radio buttons nas configurações
  const matchingRadio = document.querySelector(`input[name="app-theme-choice"][value="${theme}"]`);
  if (matchingRadio) matchingRadio.checked = true;

  // Redesenha gráficos para atualizar cores de grid/texto
  if (currentTab === 'dashboard') {
    setTimeout(updateDashboard, 50);
  }
}

/* --------------------------------------------------------
   2. CONTROLE DE ÁUDIO & FEEDBACK TÁTIL
   -------------------------------------------------------- */
function initAudioControls() {
  const btnAudio = document.getElementById('btn-audio-toggle');
  const iconOn = document.getElementById('icon-audio-on');
  const iconOff = document.getElementById('icon-audio-off');

  const updateAudioUI = (enabled) => {
    if (iconOn) iconOn.classList.toggle('hidden', !enabled);
    if (iconOff) iconOff.classList.toggle('hidden', enabled);
    if (btnAudio) btnAudio.setAttribute('title', enabled ? 'Desativar Sons' : 'Ativar Sons');
  };

  const settings = Storage.getSettings();
  const soundEnabled = settings.soundEnabled !== false;
  updateAudioUI(soundEnabled);

  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      const currentSettings = Storage.getSettings();
      const next = !(currentSettings.soundEnabled !== false);
      Storage.saveSettings({ ...currentSettings, soundEnabled: next });
      updateAudioUI(next);
      showToast('Áudio', next ? 'Feedback sonoro ativado.' : 'Feedback sonoro desativado.', 'info');
    });
  }
}

/* --------------------------------------------------------
   3. BARRA DE ATALHOS RÁPIDOS (QUICK LAUNCHPAD)
   -------------------------------------------------------- */
function initQuickLaunchpad() {
  const quickIncome = document.getElementById('quick-btn-income');
  const quickExpense = document.getElementById('quick-btn-expense');
  const quickBooth = document.getElementById('quick-btn-booth');
  const quickReceipt = document.getElementById('quick-btn-receipt');

  if (quickIncome) {
    quickIncome.addEventListener('click', () => openNewTransactionModal('income'));
  }

  if (quickExpense) {
    quickExpense.addEventListener('click', () => openNewTransactionModal('expense'));
  }

  if (quickBooth) {
    quickBooth.addEventListener('click', () => {
      openBoothModal();
    });
  }

  if (quickReceipt) {
    quickReceipt.addEventListener('click', () => {
      const txs = Storage.getTransactions();
      if (txs.length > 0) {
        openReceiptModal(txs[0]);
      } else {
        showToast('Nenhum Lançamento', 'Cadastre ao menos um lançamento para emitir recibo.', 'info');
      }
    });
  }
}

/* --------------------------------------------------------
   4. ROTEAMENTO ENTRE ABAS (SPA)
   -------------------------------------------------------- */
function initNavigation() {
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
  const views = document.querySelectorAll('.app-view');

  const pageTitleEl = document.getElementById('page-title');
  const pageSubtitleEl = document.getElementById('page-subtitle');

  const viewMetadata = {
    dashboard: {
      title: 'Dashboard Financeiro',
      subtitle: 'Acompanhe receitas, custos operacionais e margem do evento'
    },
    transactions: {
      title: 'Todos os Lançamentos',
      subtitle: 'Controle detalhado de entradas e saídas da feira'
    },
    booths: {
      title: 'Estandes & Expositores',
      subtitle: 'Locação comercial, adimplência e arrecadação setorial da feira'
    },
    reports: {
      title: 'Relatórios e Análise Financeira',
      subtitle: 'Demonstrativo consolidado, distribuição orçamentária e exportações'
    },
    settings: {
      title: 'Configurações do Evento',
      subtitle: 'Personalize a identidade da feira, categorias e parâmetros locais'
    }
  };

  const switchTab = (tabName) => {
    currentTab = tabName;

    navButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    views.forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    if (viewMetadata[tabName]) {
      if (pageTitleEl) pageTitleEl.textContent = viewMetadata[tabName].title;
      if (pageSubtitleEl) pageSubtitleEl.textContent = viewMetadata[tabName].subtitle;
    }

    // Fecha o menu lateral no mobile após trocar de aba
    closeMobileSidebar();

    // Dispara atualizações específicas por tela
    if (tabName === 'dashboard') {
      updateDashboard();
    } else if (tabName === 'transactions') {
      renderTransactionsTable();
      renderActiveFilterChips();
    } else if (tabName === 'booths') {
      renderBoothsView();
    } else if (tabName === 'reports') {
      renderReportsView();
    } else if (tabName === 'settings') {
      loadSettingsView();
    }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Link rápido "Ver Todos" no Dashboard
  const btnViewAll = document.getElementById('btn-view-all-transactions');
  if (btnViewAll) {
    btnViewAll.addEventListener('click', () => switchTab('transactions'));
  }

  // Botão no Empty State da tabela
  const btnEmptyStateCreate = document.getElementById('btn-empty-state-create');
  if (btnEmptyStateCreate) {
    btnEmptyStateCreate.addEventListener('click', () => openNewTransactionModal('income'));
  }

  // Controle do Sidebar Mobile
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');

  const openMobileSidebar = () => {
    if (sidebar) sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
  };

  const closeMobileSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  };

  if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', openMobileSidebar);
  if (btnCloseSidebar) btnCloseSidebar.addEventListener('click', closeMobileSidebar);
  if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

  // Botão Global "+ Novo Lançamento" no Header
  const btnNewTx = document.getElementById('btn-open-new-transaction');
  if (btnNewTx) {
    btnNewTx.addEventListener('click', () => openNewTransactionModal('income'));
  }
}

/* --------------------------------------------------------
   3. BARRA DE FILTROS E PESQUISA (LANÇAMENTOS)
   -------------------------------------------------------- */
function initFilterControls() {
  const searchInput = document.getElementById('filter-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const catSelect = document.getElementById('filter-category-select');
  const periodPreset = document.getElementById('filter-period-preset');
  const customDateRow = document.getElementById('custom-date-range-row');
  const startDateInput = document.getElementById('filter-date-start');
  const endDateInput = document.getElementById('filter-date-end');
  const btnApplyDates = document.getElementById('btn-apply-custom-dates');
  const btnReset = document.getElementById('btn-reset-filters');

  // Busca textual com debounce
  let searchTimer;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const val = e.target.value.trim();
      if (btnClearSearch) btnClearSearch.classList.toggle('hidden', !val);

      searchTimer = setTimeout(() => {
        FilterState.searchQuery = val;
        FilterState.currentPage = 1;
        FilterState.notify();
      }, 200);
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      FilterState.searchQuery = '';
      FilterState.currentPage = 1;
      FilterState.notify();
      searchInput.focus();
    });
  }

  // Segmented Buttons de Tipo (Todos / Receitas / Despesas)
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-type-filter]').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');

      FilterState.typeFilter = btn.getAttribute('data-type-filter');
      FilterState.currentPage = 1;
      FilterState.notify();
    });
  });

  // Select de Categoria
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      FilterState.categoryFilter = e.target.value;
      FilterState.currentPage = 1;
      FilterState.notify();
    });
  }

  // Presets de Período
  if (periodPreset) {
    periodPreset.addEventListener('change', (e) => {
      const val = e.target.value;
      FilterState.periodPreset = val;

      if (val === 'custom') {
        if (customDateRow) customDateRow.classList.remove('hidden');
      } else {
        if (customDateRow) customDateRow.classList.add('hidden');
        FilterState.calculatePresetDates(val);
        FilterState.currentPage = 1;
        FilterState.notify();
      }
    });
  }

  if (btnApplyDates) {
    btnApplyDates.addEventListener('click', () => {
      FilterState.startDate = startDateInput.value;
      FilterState.endDate = endDateInput.value;
      FilterState.currentPage = 1;
      FilterState.notify();
    });
  }

  // Limpar Todos os Filtros
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      if (btnClearSearch) btnClearSearch.classList.add('hidden');
      if (catSelect) catSelect.value = 'all';
      if (periodPreset) periodPreset.value = 'thisMonth';
      if (customDateRow) customDateRow.classList.add('hidden');

      document.querySelectorAll('[data-type-filter]').forEach(b => {
        const isAll = b.getAttribute('data-type-filter') === 'all';
        b.classList.toggle('active', isAll);
        b.setAttribute('aria-checked', isAll ? 'true' : 'false');
      });

      FilterState.reset();
      showToast('Filtros Limpos', 'Exibindo lançamentos do mês atual.', 'info');
    });
  }

  // Select de Categoria no Donut Chart (Dashboard)
  const donutTypeSelect = document.getElementById('chart-category-type-select');
  if (donutTypeSelect) {
    donutTypeSelect.addEventListener('change', () => {
      const txs = Storage.getTransactions();
      import('./charts.js').then(m => m.renderCategoryDonutChart(txs, donutTypeSelect.value));
    });
  }
}

/* --------------------------------------------------------
   5. RELATÓRIOS E ANALYTICS
   -------------------------------------------------------- */
function initReportsModule() {
  const btnCsv = document.getElementById('btn-export-csv');
  const btnJson = document.getElementById('btn-export-json');
  const btnCatCsv = document.getElementById('btn-export-categories-csv');
  const btnBoothsCsv = document.getElementById('btn-export-booths-csv');
  const btnPrintReport = document.getElementById('btn-print-report');

  if (btnCsv) {
    btnCsv.addEventListener('click', () => {
      exportTransactionsToCSV();
      showToast('Exportação Concluída', 'Arquivo CSV gerado com sucesso.');
    });
  }

  if (btnJson) {
    btnJson.addEventListener('click', () => {
      exportDataToJSON();
      showToast('Backup Exportado', 'Arquivo JSON baixado com sucesso.');
    });
  }

  if (btnCatCsv) {
    btnCatCsv.addEventListener('click', () => {
      exportCategoriesSummaryCSV();
      showToast('Resumo Exportado', 'CSV de categorias gerado com sucesso.');
    });
  }

  if (btnBoothsCsv) {
    btnBoothsCsv.addEventListener('click', () => {
      exportBoothsToCSV();
      showToast('Exportação Concluída', 'Estandes exportados em CSV com sucesso.');
    });
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', () => {
      printFinancialReport();
    });
  }
}

function renderReportsView() {
  const transactions = Storage.getTransactions();

  let incomeTotal = 0;
  let expenseTotal = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  const catMap = new Map();
  const payMap = new Map();

  transactions.forEach(tx => {
    const isIncome = tx.type === 'income';
    if (isIncome) {
      incomeTotal += tx.amount;
      incomeCount++;
    } else {
      expenseTotal += tx.amount;
      expenseCount++;
    }

    // Categorias
    const catKey = `${tx.type}__${tx.category}`;
    if (!catMap.has(catKey)) {
      catMap.set(catKey, { type: tx.type, category: tx.category, count: 0, total: 0 });
    }
    const cObj = catMap.get(catKey);
    cObj.count++;
    cObj.total += tx.amount;

    // Formas de Pagamento
    const pm = tx.paymentMethod || 'Outros';
    if (!payMap.has(pm)) {
      payMap.set(pm, { method: pm, count: 0, income: 0, expense: 0, total: 0 });
    }
    const pObj = payMap.get(pm);
    pObj.count++;
    pObj.total += tx.amount;
    if (isIncome) pObj.income += tx.amount;
    else pObj.expense += tx.amount;
  });

  const netBalance = incomeTotal - expenseTotal;
  const marginPct = incomeTotal > 0 ? (netBalance / incomeTotal) * 100 : 0;
  const avgTicket = incomeCount > 0 ? incomeTotal / incomeCount : 0;

  // Atualiza destaques
  const elIncome = document.getElementById('report-stat-income');
  const elIncomeCount = document.getElementById('report-stat-income-count');
  const elExpense = document.getElementById('report-stat-expense');
  const elExpenseCount = document.getElementById('report-stat-expense-count');
  const elBalance = document.getElementById('report-stat-balance');
  const elBalanceRate = document.getElementById('report-stat-balance-rate');
  const elAvg = document.getElementById('report-stat-avg-ticket');

  if (elIncome) elIncome.textContent = formatBRL(incomeTotal);
  if (elIncomeCount) elIncomeCount.textContent = `${incomeCount} lançamentos`;
  if (elExpense) elExpense.textContent = formatBRL(expenseTotal);
  if (elExpenseCount) elExpenseCount.textContent = `${expenseCount} lançamentos`;
  if (elBalance) {
    elBalance.textContent = formatBRL(netBalance);
    elBalance.style.color = netBalance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }
  if (elBalanceRate) elBalanceRate.textContent = `${marginPct.toFixed(1)}% de margem líquida`;
  if (elAvg) elAvg.textContent = formatBRL(avgTicket);

  // Tabela por Categoria
  const catTbody = document.getElementById('report-categories-tbody');
  if (catTbody) {
    const sortedCats = Array.from(catMap.values()).sort((a, b) => b.total - a.total);
    catTbody.innerHTML = sortedCats.map(c => {
      const isInc = c.type === 'income';
      const baseTotal = isInc ? incomeTotal : expenseTotal;
      const pct = baseTotal > 0 ? (c.total / baseTotal) * 100 : 0;

      return `
        <tr>
          <td><strong>${escapeHTML(c.category)}</strong></td>
          <td><span class="badge-type ${isInc ? 'income' : 'expense'}">${isInc ? 'Receita' : 'Despesa'}</span></td>
          <td class="text-center">${c.count}</td>
          <td class="text-right ${isInc ? 'text-income' : 'text-expense'} font-display font-semibold">${formatBRL(c.total)}</td>
          <td class="text-right font-display">${pct.toFixed(1)}%</td>
          <td>
            <div class="progress-bar-sm">
              <div class="progress-fill" style="width: ${Math.min(100, pct)}%; background: ${isInc ? 'var(--color-income)' : 'var(--color-expense)'};"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Tabela por Forma de Pagamento
  const payTbody = document.getElementById('report-payments-tbody');
  if (payTbody) {
    const sortedPays = Array.from(payMap.values()).sort((a, b) => b.total - a.total);
    payTbody.innerHTML = sortedPays.map(p => `
      <tr>
        <td><strong>${escapeHTML(p.method)}</strong></td>
        <td class="text-center">${p.count}</td>
        <td class="text-right font-display text-income">${formatBRL(p.income)}</td>
        <td class="text-right font-display text-expense">${formatBRL(p.expense)}</td>
        <td class="text-right font-display font-semibold">${formatBRL(p.total)}</td>
      </tr>
    `).join('');
  }
}

/* --------------------------------------------------------
   6. CONFIGURAÇÕES & CATEGORIAS
   -------------------------------------------------------- */
function initSettingsModule() {
  const formFair = document.getElementById('form-fair-settings');

  // Salvar Informações da Feira
  if (formFair) {
    formFair.addEventListener('submit', (e) => {
      e.preventDefault();
      const fairName = document.getElementById('setting-fair-name').value.trim();
      const edition = document.getElementById('setting-fair-edition')?.value.trim() || '';
      const targetVal = document.getElementById('setting-target-goal')?.value;
      const dateStart = document.getElementById('setting-fair-date-start').value;
      const dateEnd = document.getElementById('setting-fair-date-end').value;
      const location = document.getElementById('setting-fair-location').value.trim();

      if (!fairName) {
        showToast('Erro', 'O nome da feira é obrigatório.', 'error');
        return;
      }

      const revenueTarget = targetVal && !isNaN(Number(targetVal)) ? Number(targetVal) : 35000;

      Storage.saveSettings({ fairName, edition, revenueTarget, dateStart, dateEnd, location });
      showToast('Configurações Salvas', 'Informações e metas da feira atualizadas com sucesso.');
      updateDashboard();
    });
  }

  // Adicionar Categorias
  const btnAddInc = document.getElementById('btn-add-income-category');
  const inputInc = document.getElementById('input-new-income-category');
  const btnAddExp = document.getElementById('btn-add-expense-category');
  const inputExp = document.getElementById('input-new-expense-category');

  if (btnAddInc && inputInc) {
    btnAddInc.addEventListener('click', () => {
      const name = inputInc.value.trim();
      if (!name) return;
      addCategory('income', name);
      inputInc.value = '';
    });
  }

  if (btnAddExp && inputExp) {
    btnAddExp.addEventListener('click', () => {
      const name = inputExp.value.trim();
      if (!name) return;
      addCategory('expense', name);
      inputExp.value = '';
    });
  }

  // Botão Restaurar Demonstração
  const btnRestore = document.getElementById('btn-restore-demo-data');
  if (btnRestore) {
    btnRestore.addEventListener('click', () => {
      Storage.resetToDemoData();
      showToast('Dados Restaurados', 'Lançamentos e estandes de demonstração recarregados.');
      updateDashboard();
      renderTransactionsTable();
      loadSettingsView();
      updateCategoryFilterOptions();
    });
  }

  // Modal de Apagar Tudo
  const btnOpenClearModal = document.getElementById('btn-open-clear-all-modal');
  const btnCancelReset = document.getElementById('btn-cancel-reset');
  const btnCloseResetModal = document.getElementById('btn-close-reset-modal');
  const inputKeyword = document.getElementById('input-confirm-reset-keyword');
  const btnConfirmReset = document.getElementById('btn-confirm-reset-all');

  if (btnOpenClearModal) {
    btnOpenClearModal.addEventListener('click', () => {
      if (inputKeyword) inputKeyword.value = '';
      if (btnConfirmReset) btnConfirmReset.disabled = true;
      openModal('modal-reset-all-confirm');
    });
  }

  if (btnCancelReset) btnCancelReset.addEventListener('click', () => closeModal('modal-reset-all-confirm'));
  if (btnCloseResetModal) btnCloseResetModal.addEventListener('click', () => closeModal('modal-reset-all-confirm'));

  if (inputKeyword && btnConfirmReset) {
    inputKeyword.addEventListener('input', (e) => {
      btnConfirmReset.disabled = e.target.value.trim().toUpperCase() !== 'APAGAR';
    });

    btnConfirmReset.addEventListener('click', () => {
      Storage.clearAllData();
      closeModal('modal-reset-all-confirm');
      showToast('Dados Apagados', 'Todas as transações foram removidas com sucesso.', 'info');
      updateDashboard();
      renderTransactionsTable();
    });
  }
}

function loadSettingsView() {
  const settings = Storage.getSettings();
  const nameInput = document.getElementById('setting-fair-name');
  const editionInput = document.getElementById('setting-fair-edition');
  const targetInput = document.getElementById('setting-target-goal');
  const startInput = document.getElementById('setting-fair-date-start');
  const endInput = document.getElementById('setting-fair-date-end');
  const locInput = document.getElementById('setting-fair-location');

  if (nameInput) nameInput.value = settings.fairName || '';
  if (editionInput) editionInput.value = settings.edition || '';
  if (targetInput) targetInput.value = settings.revenueTarget || 35000;
  if (startInput) startInput.value = settings.dateStart || '';
  if (endInput) endInput.value = settings.dateEnd || '';
  if (locInput) locInput.value = settings.location || '';

  renderCategoriesList();
}

function renderCategoriesList() {
  const categories = Storage.getCategories();
  const listInc = document.getElementById('list-income-categories');
  const listExp = document.getElementById('list-expense-categories');

  if (listInc) {
    listInc.innerHTML = categories.income.map(c => `
      <li class="category-item">
        <span>${escapeHTML(c)}</span>
        <button class="btn-remove-category" data-cat-type="income" data-cat-name="${escapeHTML(c)}" title="Remover categoria" aria-label="Remover categoria">✕</button>
      </li>
    `).join('');
  }

  if (listExp) {
    listExp.innerHTML = categories.expense.map(c => `
      <li class="category-item">
        <span>${escapeHTML(c)}</span>
        <button class="btn-remove-category" data-cat-type="expense" data-cat-name="${escapeHTML(c)}" title="Remover categoria" aria-label="Remover categoria">✕</button>
      </li>
    `).join('');
  }

  // Listeners de remoção
  document.querySelectorAll('.btn-remove-category').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-cat-type');
      const name = btn.getAttribute('data-cat-name');
      removeCategory(type, name);
    });
  });
}

function addCategory(type, name) {
  const categories = Storage.getCategories();
  if (categories[type].includes(name)) {
    showToast('Aviso', 'Esta categoria já existe.', 'info');
    return;
  }
  categories[type].push(name);
  Storage.saveCategories(categories);
  renderCategoriesList();
  updateCategoryFilterOptions();
  showToast('Categoria Adicionada', `"${name}" incluída nas opções de ${type === 'income' ? 'receita' : 'despesa'}.`);
}

function removeCategory(type, name) {
  const categories = Storage.getCategories();
  if (categories[type].length <= 1) {
    showToast('Atenção', 'É necessário manter pelo menos uma categoria.', 'error');
    return;
  }
  categories[type] = categories[type].filter(c => c !== name);
  Storage.saveCategories(categories);
  renderCategoriesList();
  updateCategoryFilterOptions();
  showToast('Categoria Removida', `"${name}" removida com sucesso.`);
}

/* --------------------------------------------------------
   6. ATALHOS GLOBAIS DE TECLADO
   -------------------------------------------------------- */
function initGlobalShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Se o usuário estiver digitando em input, textarea ou select, ignora atalhos de letra
    const tag = e.target.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Tecla N: Novo Lançamento
    if (!isTyping && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      openNewTransactionModal('income');
    }

    // Tecla /: Foca na busca
    if (!isTyping && e.key === '/') {
      e.preventDefault();
      // Troca para aba de transações se não estiver nela
      const navBtn = document.getElementById('tab-nav-transactions');
      if (navBtn) navBtn.click();
      const search = document.getElementById('filter-search-input');
      if (search) setTimeout(() => search.focus(), 100);
    }
  });
}
