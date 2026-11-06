/**
 * FeiraFinance — Dashboard Engine
 * Cálculo de KPIs, metas de arrecadação, ponto de equilíbrio, sparklines e visão geral
 */

import { Storage } from './storage.js';
import { formatBRL, formatDate, escapeHTML, openReceiptModal } from './ui.js';
import {
  renderBalanceEvolutionChart,
  renderMonthlyBarsChart,
  renderCategoryDonutChart,
  renderSparkline
} from './charts.js';

export function updateDashboard() {
  const transactions = Storage.getTransactions();
  const settings = Storage.getSettings();
  const booths = Storage.getBooths();

  // 1. Atualiza Informações do Evento no Banner e Sidebar
  const fairTitleEl = document.getElementById('dashboard-fair-title');
  const sidebarFairName = document.getElementById('sidebar-fair-name');
  const fairDatesEl = document.getElementById('dashboard-fair-dates');
  const totalCountEl = document.getElementById('dashboard-total-transactions-count');
  const navBadgeEl = document.getElementById('nav-count-badge');
  const boothsBadgeEl = document.getElementById('nav-booths-badge');

  if (fairTitleEl) fairTitleEl.textContent = settings.fairName || 'Feira do Bairro';
  if (sidebarFairName) sidebarFairName.textContent = settings.fairName || 'Feira do Bairro';
  if (totalCountEl) totalCountEl.textContent = transactions.length;
  if (navBadgeEl) navBadgeEl.textContent = transactions.length;
  if (boothsBadgeEl) boothsBadgeEl.textContent = booths.length;

  if (fairDatesEl) {
    if (settings.dateStart && settings.dateEnd) {
      fairDatesEl.textContent = `${formatDate(settings.dateStart)} até ${formatDate(settings.dateEnd)} • ${settings.location || 'Local do Evento'} • ${settings.edition || '12ª Edição'}`;
    } else {
      fairDatesEl.textContent = `Edição Ativa • ${settings.location || 'Praça de Eventos'} • Fluxo Operacional`;
    }
  }

  // 2. Calcula Totais Gerais e Histórico para Sparklines
  let totalIncome = 0;
  let totalExpense = 0;

  // Separação por forma de pagamento
  let incomePix = 0;
  let incomeCash = 0;
  let incomeCard = 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  let prevMonthIncome = 0;
  let prevMonthExpense = 0;

  // Vetores de valores diários para sparklines (últimos 10 registros ordenados)
  const sortedChron = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const incomeSparkVals = [];
  const expenseSparkVals = [];
  const balanceSparkVals = [];
  let runningBal = 0;

  sortedChron.forEach(tx => {
    const amt = tx.amount;
    if (tx.type === 'income') {
      totalIncome += amt;
      runningBal += amt;
      incomeSparkVals.push(amt);
      if (tx.paymentMethod === 'PIX') incomePix += amt;
      else if (tx.paymentMethod === 'Dinheiro') incomeCash += amt;
      else incomeCard += amt;
    } else {
      totalExpense += amt;
      runningBal -= amt;
      expenseSparkVals.push(amt);
    }
    balanceSparkVals.push(runningBal);

    const txDate = new Date(tx.date + 'T00:00:00');
    const m = txDate.getMonth();
    const y = txDate.getFullYear();

    if (y === currentYear && m === currentMonth) {
      if (tx.type === 'income') currentMonthIncome += amt;
      else currentMonthExpense += amt;
    } else if (
      (y === currentYear && m === currentMonth - 1) ||
      (currentMonth === 0 && y === currentYear - 1 && m === 11)
    ) {
      if (tx.type === 'income') prevMonthIncome += amt;
      else prevMonthExpense += amt;
    }
  });

  const netBalance = totalIncome - totalExpense;
  const marginRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

  // 3. Atualiza os 4 Cards de KPI
  // Card 1: Total Recebido
  const kpiIncomeEl = document.getElementById('kpi-total-income');
  const kpiIncomeTrend = document.getElementById('kpi-income-trend');
  if (kpiIncomeEl) kpiIncomeEl.textContent = formatBRL(totalIncome);

  if (kpiIncomeTrend) {
    let incPct = 0;
    if (prevMonthIncome > 0) {
      incPct = ((currentMonthIncome - prevMonthIncome) / prevMonthIncome) * 100;
    } else if (currentMonthIncome > 0) {
      incPct = 100;
    }
    const isPos = incPct >= 0;
    kpiIncomeTrend.className = `badge-trend ${isPos ? 'positive' : 'negative'}`;
    kpiIncomeTrend.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="${isPos ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
      </svg>
      <span>${isPos ? '+' : ''}${incPct.toFixed(0)}%</span>
    `;
  }
  renderSparkline('sparkline-income', incomeSparkVals.slice(-10), '#10b981');

  // Card 2: Total Pago
  const kpiExpenseEl = document.getElementById('kpi-total-expense');
  const kpiExpenseTrend = document.getElementById('kpi-expense-trend');
  if (kpiExpenseEl) kpiExpenseEl.textContent = formatBRL(totalExpense);

  if (kpiExpenseTrend) {
    let expPct = 0;
    if (prevMonthExpense > 0) {
      expPct = ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100;
    } else if (currentMonthExpense > 0) {
      expPct = 100;
    }
    const isHigherExpense = expPct > 0;
    kpiExpenseTrend.className = `badge-trend ${isHigherExpense ? 'negative' : 'positive'}`;
    kpiExpenseTrend.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="${isHigherExpense ? '6 9 12 15 18 9' : '18 15 12 9 6 15'}"></polyline>
      </svg>
      <span>${isHigherExpense ? '+' : ''}${expPct.toFixed(0)}%</span>
    `;
  }
  renderSparkline('sparkline-expense', expenseSparkVals.slice(-10), '#ef4444');

  // Card 3: Saldo Atual
  const kpiBalanceEl = document.getElementById('kpi-net-balance');
  const kpiBalanceStatus = document.getElementById('kpi-balance-status');
  if (kpiBalanceEl) {
    kpiBalanceEl.textContent = formatBRL(netBalance);
    kpiBalanceEl.style.color = netBalance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }

  if (kpiBalanceStatus) {
    if (netBalance >= 0) {
      kpiBalanceStatus.className = 'badge-status positive';
      kpiBalanceStatus.textContent = 'Superávit';
    } else {
      kpiBalanceStatus.className = 'badge-status negative';
      kpiBalanceStatus.textContent = 'Déficit';
    }
  }
  renderSparkline('sparkline-balance', balanceSparkVals.slice(-10), '#6366f1');

  // Card 4: Margem de Lucro
  const kpiMarginEl = document.getElementById('kpi-margin-rate');
  const kpiMarginBar = document.getElementById('kpi-margin-bar');
  const kpiMarginEval = document.getElementById('kpi-margin-eval');

  if (kpiMarginEl) kpiMarginEl.textContent = `${marginRate.toFixed(1)}%`;
  if (kpiMarginBar) {
    const clampedProgress = Math.min(100, Math.max(0, marginRate));
    kpiMarginBar.style.width = `${clampedProgress}%`;
  }
  if (kpiMarginEval) {
    if (marginRate >= 40) kpiMarginEval.textContent = 'Excelente';
    else if (marginRate >= 20) kpiMarginEval.textContent = 'Saudável';
    else if (marginRate >= 0) kpiMarginEval.textContent = 'Ajustada';
    else kpiMarginEval.textContent = 'Negativa';
  }

  // 4. Meta do Evento e Ponto de Equilíbrio (Break-Even)
  const targetGoal = Number(settings.targetGoal) || 35000;
  const goalPercent = Math.min(100, Math.round((totalIncome / targetGoal) * 100));
  const costCoverage = totalExpense > 0 ? Math.round((totalIncome / totalExpense) * 100) : 100;

  const targetAmountEl = document.getElementById('stat-target-goal');
  const targetPercentEl = document.getElementById('stat-target-percent');
  const targetProgressBar = document.getElementById('target-progress-bar');
  const breakEvenStatusEl = document.getElementById('stat-break-even-status');
  const remainingGoalEl = document.getElementById('stat-remaining-goal');

  if (targetAmountEl) targetAmountEl.textContent = formatBRL(targetGoal);
  if (targetPercentEl) targetPercentEl.textContent = `${goalPercent}% da Meta Atingida`;
  if (targetProgressBar) targetProgressBar.style.width = `${goalPercent}%`;

  if (breakEvenStatusEl) {
    if (totalIncome >= totalExpense) {
      breakEvenStatusEl.textContent = `${costCoverage}% dos custos cobertos (Ponto de Equilíbrio Superado 🎉)`;
      breakEvenStatusEl.className = 'text-income font-medium';
    } else {
      const faltaCobrir = totalExpense - totalIncome;
      breakEvenStatusEl.textContent = `Faltam ${formatBRL(faltaCobrir)} para cobrir os custos operacionais da feira`;
      breakEvenStatusEl.className = 'text-expense font-medium';
    }
  }

  if (remainingGoalEl) {
    const diff = targetGoal - totalIncome;
    remainingGoalEl.textContent = diff > 0 ? formatBRL(diff) : 'Meta Superada!';
  }

  // 5. Posição de Caixa por Liquidez (PIX, Espécie, Cartões)
  const cashPixEl = document.getElementById('cash-liquidity-pix');
  const cashMoneyEl = document.getElementById('cash-liquidity-cash');
  const cashCardEl = document.getElementById('cash-liquidity-card');
  if (cashPixEl) cashPixEl.textContent = formatBRL(incomePix);
  if (cashMoneyEl) cashMoneyEl.textContent = formatBRL(incomeCash);
  if (cashCardEl) cashCardEl.textContent = formatBRL(incomeCard);

  // 6. Estandes Status Resumo
  const paidBooths = booths.filter(b => b.status === 'paid').length;
  const partialBooths = booths.filter(b => b.status === 'partial').length;
  const pendingBooths = booths.filter(b => b.status === 'pending').length;

  const boothsSummaryEl = document.getElementById('dashboard-booths-status-summary');
  if (boothsSummaryEl) {
    boothsSummaryEl.textContent = `${paidBooths} quitados • ${partialBooths} parciais • ${pendingBooths} pendentes`;
  }

  // 7. Renderiza Gráficos em Canvas Puro
  renderBalanceEvolutionChart(transactions);
  renderMonthlyBarsChart(transactions);

  const donutSelect = document.getElementById('chart-category-type-select');
  const donutType = donutSelect ? donutSelect.value : 'expense';
  renderCategoryDonutChart(transactions, donutType);

  // 8. Renderiza a lista dos Últimos 5 Lançamentos com botão de Recibo Oficial
  renderRecentTransactions(transactions);
}

function renderRecentTransactions(transactions) {
  const container = document.getElementById('recent-transactions-list');
  if (!container) return;

  const sorted = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.82rem;">
        Nenhum lançamento cadastrado.
      </div>
    `;
    return;
  }

  container.innerHTML = sorted.map(tx => {
    const isIncome = tx.type === 'income';
    return `
      <div class="recent-item">
        <div class="recent-left">
          <div class="recent-icon-dot ${isIncome ? 'income' : 'expense'}">
            ${isIncome
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
              : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`
            }
          </div>
          <div class="recent-details">
            <span class="recent-desc" title="${escapeHTML(tx.description)}">${escapeHTML(tx.description)}</span>
            <span class="recent-meta">${formatDate(tx.date)} • ${escapeHTML(tx.category)} • ${escapeHTML(tx.paymentMethod || 'PIX')}</span>
          </div>
        </div>
        <div class="recent-right-actions">
          <span class="recent-amount ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? '+' : '-'}${formatBRL(tx.amount)}
          </span>
          <button class="btn-icon btn-sm btn-recent-receipt" data-recent-tx-id="${tx.id}" title="Ver Comprovante Oficial" aria-label="Ver Comprovante Oficial">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-recent-receipt').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-recent-tx-id');
      const tx = transactions.find(t => t.id === id);
      if (tx) openReceiptModal(tx);
    });
  });
}
