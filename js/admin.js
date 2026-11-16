/**
 * FeiraFinance — Admin Console & Seller Performance Analytics
 * Painel Administrativo: Pessoas Cadastradas, Ranking de Vendas, Auditoria & Permissões
 */

import { Storage } from './storage.js';
import { formatBRL, formatDate, escapeHTML, openModal, openReceiptModal, showToast } from './ui.js';
import { updateUserRole, ADMIN_BOOTSTRAP_EMAIL } from './firebase.js';

let adminContext = {
  user: null,
  profile: null,
  isAdmin: false,
  users: []
};

const adminFilterState = {
  search: '',
  roleFilter: 'all',
  period: 'all',
  selectedSellerKey: 'all',
  txType: 'income'
};

export function setAdminContext(next = {}) {
  adminContext = {
    ...adminContext,
    ...next
  };
}

export function initAdminModule() {
  const searchInput = document.getElementById('admin-search-users');
  const roleSelect = document.getElementById('admin-filter-role');
  const periodSelect = document.getElementById('admin-filter-period');
  const sellerSelect = document.getElementById('admin-filter-seller');
  const txTypeSelect = document.getElementById('admin-filter-tx-type');
  const btnClearSellerFilter = document.getElementById('btn-admin-clear-seller');
  const btnExportCsv = document.getElementById('btn-admin-export-csv');
  const btnOpenAuthFromBanner = document.getElementById('btn-admin-open-auth');
  const usersTbody = document.getElementById('admin-users-tbody');
  const salesTbody = document.getElementById('admin-sales-tbody');

  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      const val = e.target.value.trim();
      debounce = setTimeout(() => {
        adminFilterState.search = val;
        renderAdminView();
      }, 150);
    });
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      adminFilterState.roleFilter = e.target.value;
      renderAdminView();
    });
  }

  if (periodSelect) {
    periodSelect.addEventListener('change', (e) => {
      adminFilterState.period = e.target.value;
      renderAdminView();
    });
  }

  if (sellerSelect) {
    sellerSelect.addEventListener('change', (e) => {
      adminFilterState.selectedSellerKey = e.target.value;
      renderAdminSalesTable();
    });
  }

  if (txTypeSelect) {
    txTypeSelect.addEventListener('change', (e) => {
      adminFilterState.txType = e.target.value;
      renderAdminSalesTable();
    });
  }

  if (btnClearSellerFilter) {
    btnClearSellerFilter.addEventListener('click', () => {
      adminFilterState.selectedSellerKey = 'all';
      if (sellerSelect) sellerSelect.value = 'all';
      renderAdminSalesTable();
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportAdminSellersCSV();
    });
  }

  if (btnOpenAuthFromBanner) {
    btnOpenAuthFromBanner.addEventListener('click', () => {
      openModal('modal-auth');
    });
  }

  // Event delegation on Registered Users & Sellers Leaderboard Table
  if (usersTbody) {
    usersTbody.addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.btn-admin-filter');
      if (filterBtn) {
        const sellerKey = filterBtn.getAttribute('data-seller-key');
        if (sellerKey) {
          adminFilterState.selectedSellerKey = sellerKey;
          if (sellerSelect) sellerSelect.value = sellerKey;
          renderAdminSalesTable();
          const auditCard = document.getElementById('admin-sales-audit-card');
          if (auditCard) {
            auditCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    });

    usersTbody.addEventListener('change', async (e) => {
      const roleDropdown = e.target.closest('.admin-role-select');
      if (!roleDropdown) return;

      const targetUid = roleDropdown.getAttribute('data-uid');
      const newRole = roleDropdown.value;
      const roleTitleMap = {
        admin: 'Administrador Geral',
        manager: 'Coordenador Financeiro',
        staff: 'Expositor / Equipe'
      };
      const newRoleTitle = roleTitleMap[newRole] || 'Coordenador Financeiro';

      roleDropdown.disabled = true;
      const res = await updateUserRole(targetUid, newRole, newRoleTitle);
      roleDropdown.disabled = false;

      if (res.success) {
        showToast('Permissão Atualizada', `Perfil alterado para ${newRoleTitle}.`, 'success');
      } else {
        showToast('Erro ao Atualizar', 'Não foi possível alterar a permissão no Firestore.', 'error');
        renderAdminView();
      }
    });
  }

  // Event delegation on Sales Audit Table (Recibo)
  if (salesTbody) {
    salesTbody.addEventListener('click', (e) => {
      const receiptBtn = e.target.closest('.btn-admin-receipt');
      if (receiptBtn) {
        const txId = receiptBtn.getAttribute('data-tx-id');
        const tx = Storage.getTransactions().find(t => t.id === txId);
        if (tx) openReceiptModal(tx);
      }
    });
  }

  // Live re-render when local/cloud transactions change
  window.addEventListener('feirafinance:tx-updated', () => {
    const adminSection = document.getElementById('view-admin');
    if (adminSection && adminSection.classList.contains('active')) {
      renderAdminView();
    }
  });
}

function normalizeName(str = '') {
  return String(str)
    .replace(/\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getPeriodFilteredTransactions() {
  const allTxs = Storage.getTransactions();
  const period = adminFilterState.period;
  if (period === 'all') return allTxs;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (period === 'today') {
    return allTxs.filter(t => t.date === todayStr);
  }
  if (period === 'last7') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    const startStr = d.toISOString().split('T')[0];
    return allTxs.filter(t => t.date >= startStr && t.date <= todayStr);
  }
  if (period === 'thisMonth') {
    const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return allTxs.filter(t => t.date >= startMonth);
  }
  return allTxs;
}

function buildSellerAggregations() {
  const txs = getPeriodFilteredTransactions();
  const cloudUsers = Array.isArray(adminContext.users) ? adminContext.users : [];

  const entriesMap = new Map();
  const uidLookup = new Map();
  const emailLookup = new Map();
  const nameLookup = new Map();

  // 1. Seed registered cloud accounts
  cloudUsers.forEach(u => {
    const uid = u.uid || u.id;
    const key = `user:${uid}`;
    const displayName = (u.displayName || (u.email ? u.email.split('@')[0] : 'Usuário')).trim();
    const entry = {
      key,
      uid,
      displayName,
      email: u.email || '',
      role: u.role || 'staff',
      roleTitle: u.roleTitle || (u.role === 'admin' ? 'Administrador Geral' : u.role === 'manager' ? 'Coordenador Financeiro' : 'Expositor / Equipe'),
      createdAt: u.createdAt || '',
      isRegistered: true,
      salesCount: 0,
      salesTotal: 0,
      expensesCount: 0,
      expensesTotal: 0,
      netTotal: 0,
      avgTicket: 0,
      sharePct: 0,
      lastSaleDate: '',
      transactions: []
    };

    entriesMap.set(key, entry);
    if (uid) uidLookup.set(uid, key);
    if (u.email) emailLookup.set(u.email.toLowerCase(), key);
    const norm = normalizeName(displayName);
    if (norm && !nameLookup.has(norm)) nameLookup.set(norm, key);
  });

  // 2. Match transactions to registered users or operator entries
  txs.forEach(tx => {
    let matchedKey = null;

    const txUid = tx.createdByUid || tx.uid;
    if (txUid && txUid !== 'anonymous' && uidLookup.has(txUid)) {
      matchedKey = uidLookup.get(txUid);
    }

    if (!matchedKey && tx.createdByEmail) {
      const emailKey = tx.createdByEmail.toLowerCase();
      if (emailLookup.has(emailKey)) {
        matchedKey = emailLookup.get(emailKey);
      }
    }

    const rawLabel = (tx.createdByName || tx.responsible || 'Operador da Feira').trim();
    const normLabel = normalizeName(rawLabel);
    if (!matchedKey && normLabel && nameLookup.has(normLabel)) {
      matchedKey = nameLookup.get(normLabel);
    }

    if (!matchedKey) {
      const fallbackKey = `local:${normLabel || 'sem_responsavel'}`;
      if (!entriesMap.has(fallbackKey)) {
        entriesMap.set(fallbackKey, {
          key: fallbackKey,
          uid: '',
          displayName: rawLabel || 'Sem Responsável',
          email: tx.createdByEmail || '',
          role: 'local',
          roleTitle: 'Responsável / Expositor',
          createdAt: '',
          isRegistered: false,
          salesCount: 0,
          salesTotal: 0,
          expensesCount: 0,
          expensesTotal: 0,
          netTotal: 0,
          avgTicket: 0,
          sharePct: 0,
          lastSaleDate: '',
          transactions: []
        });
      }
      matchedKey = fallbackKey;
    }

    const target = entriesMap.get(matchedKey);
    const amount = Number(tx.amount) || 0;
    target.transactions.push(tx);

    if (tx.type === 'income') {
      target.salesCount += 1;
      target.salesTotal += amount;
      if (!target.lastSaleDate || (tx.date && tx.date > target.lastSaleDate)) {
        target.lastSaleDate = tx.date || '';
      }
    } else {
      target.expensesCount += 1;
      target.expensesTotal += amount;
    }
  });

  // 3. Finalize metrics and shares
  let totalSalesAll = 0;
  let totalSalesCountAll = 0;

  entriesMap.forEach(entry => {
    totalSalesAll += entry.salesTotal;
    totalSalesCountAll += entry.salesCount;
  });

  const rows = Array.from(entriesMap.values()).map(entry => {
    entry.netTotal = entry.salesTotal - entry.expensesTotal;
    entry.avgTicket = entry.salesCount > 0 ? entry.salesTotal / entry.salesCount : 0;
    entry.sharePct = totalSalesAll > 0 ? (entry.salesTotal / totalSalesAll) * 100 : 0;
    return entry;
  });

  rows.sort((a, b) => {
    if (b.salesTotal !== a.salesTotal) return b.salesTotal - a.salesTotal;
    if (b.salesCount !== a.salesCount) return b.salesCount - a.salesCount;
    if (a.isRegistered !== b.isRegistered) return a.isRegistered ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return {
    rows,
    txs,
    totalSalesAll,
    totalSalesCountAll,
    registeredCount: cloudUsers.length
  };
}

export function renderAdminView() {
  const { rows, totalSalesAll, totalSalesCountAll, registeredCount } = buildSellerAggregations();

  renderAdminAccessBanner(registeredCount);
  renderAdminKPIs(rows, totalSalesAll, totalSalesCountAll, registeredCount);
  renderAdminSellerDropdown(rows);
  renderAdminUsersTable(rows);
  renderAdminSalesTable(rows);
}

function renderAdminAccessBanner(registeredCount) {
  const banner = document.getElementById('admin-access-banner');
  const titleEl = document.getElementById('admin-banner-title');
  const descEl = document.getElementById('admin-banner-desc');
  const authBtn = document.getElementById('btn-admin-open-auth');
  if (!banner || !titleEl || !descEl) return;

  banner.classList.remove('is-admin', 'is-warning');

  if (adminContext.isAdmin) {
    banner.classList.add('is-admin');
    titleEl.textContent = 'Modo Administrador Ativo';
    descEl.textContent = `Acesso completo ao diretório de contas (${registeredCount} pessoa(s) cadastrada(s) no Firestore), gestão de permissões e auditoria de vendas.`;
    if (authBtn) authBtn.classList.add('hidden');
  } else if (adminContext.user && !adminContext.user.isAnonymous) {
    banner.classList.add('is-warning');
    titleEl.textContent = 'Acesso Restrito de Equipe';
    descEl.textContent = `Conectado como ${adminContext.user.email}. A lista completa de contas cadastradas e alteração de cargos no Firestore é exclusiva do Administrador (${ADMIN_BOOTSTRAP_EMAIL}). Abaixo você visualiza o ranking local de vendas.`;
    if (authBtn) {
      authBtn.classList.remove('hidden');
      authBtn.textContent = 'Trocar para Conta ADM';
    }
  } else {
    banner.classList.add('is-warning');
    titleEl.textContent = 'Entre como Administrador para Sincronizar Cadastros';
    descEl.textContent = `Entre com a conta ADM (${ADMIN_BOOTSTRAP_EMAIL}) para listar todos os usuários cadastrados na nuvem e gerenciar permissões. As métricas locais dos responsáveis já estão visíveis abaixo.`;
    if (authBtn) {
      authBtn.classList.remove('hidden');
      authBtn.textContent = 'Entrar como ADM';
    }
  }
}

function renderAdminKPIs(rows, totalSalesAll, totalSalesCountAll, registeredCount) {
  const elSalesTotal = document.getElementById('admin-kpi-sales-total');
  const elSalesCount = document.getElementById('admin-kpi-sales-count');
  const elUsersCount = document.getElementById('admin-kpi-users-count');
  const elUsersSub = document.getElementById('admin-kpi-users-sub');
  const elAvgTicket = document.getElementById('admin-kpi-avg-ticket');
  const elAvgSub = document.getElementById('admin-kpi-avg-sub');
  const elTopSeller = document.getElementById('admin-kpi-top-seller');
  const elTopSellerVal = document.getElementById('admin-kpi-top-seller-val');

  const activeSellersCount = rows.filter(r => r.salesCount > 0).length;
  const overallAvgTicket = totalSalesCountAll > 0 ? totalSalesAll / totalSalesCountAll : 0;
  const topSeller = rows.find(r => r.salesTotal > 0) || rows[0] || null;

  if (elSalesTotal) elSalesTotal.textContent = formatBRL(totalSalesAll);
  if (elSalesCount) elSalesCount.textContent = `${totalSalesCountAll} venda(s) no período`;

  if (elUsersCount) {
    elUsersCount.textContent = adminContext.isAdmin ? String(registeredCount) : String(rows.length);
  }
  if (elUsersSub) {
    elUsersSub.textContent = adminContext.isAdmin
      ? `${registeredCount} conta(s) na nuvem • ${activeSellersCount} vendedore(s)`
      : `${activeSellersCount} pessoa(s) com vendas registradas`;
  }

  if (elAvgTicket) elAvgTicket.textContent = formatBRL(overallAvgTicket);
  if (elAvgSub) elAvgSub.textContent = `Média em ${totalSalesCountAll} lançamento(s)`;

  if (elTopSeller) {
    elTopSeller.textContent = topSeller && topSeller.salesTotal > 0 ? topSeller.displayName : 'Sem vendas';
  }
  if (elTopSellerVal) {
    elTopSellerVal.textContent = topSeller && topSeller.salesTotal > 0
      ? `${formatBRL(topSeller.salesTotal)} (${topSeller.salesCount} venda${topSeller.salesCount === 1 ? '' : 's'})`
      : 'R$ 0,00';
  }
}

function renderAdminSellerDropdown(rows) {
  const sellerSelect = document.getElementById('admin-filter-seller');
  if (!sellerSelect) return;

  const currentVal = adminFilterState.selectedSellerKey;
  const optionsHtml = [
    '<option value="all">Todas as Pessoas / Vendedores</option>',
    ...rows.map(r => {
      const suffix = r.isRegistered ? 'Cadastro Nuvem' : 'Operador Local';
      return `<option value="${escapeHTML(r.key)}" ${r.key === currentVal ? 'selected' : ''}>${escapeHTML(r.displayName)} (${suffix} • ${formatBRL(r.salesTotal)})</option>`;
    })
  ].join('');

  sellerSelect.innerHTML = optionsHtml;
  if (!rows.some(r => r.key === currentVal)) {
    adminFilterState.selectedSellerKey = 'all';
    sellerSelect.value = 'all';
  }
}

function renderAdminUsersTable(rows) {
  const tbody = document.getElementById('admin-users-tbody');
  const emptyState = document.getElementById('admin-users-empty');
  const countBadge = document.getElementById('admin-users-visible-count');
  if (!tbody) return;

  const query = normalizeName(adminFilterState.search);
  const roleFilter = adminFilterState.roleFilter;

  const filtered = rows.filter(r => {
    if (roleFilter === 'registered' && !r.isRegistered) return false;
    if (roleFilter === 'admin' && r.role !== 'admin') return false;
    if (roleFilter === 'manager' && r.role !== 'manager') return false;
    if (roleFilter === 'staff' && r.role !== 'staff') return false;
    if (roleFilter === 'withSales' && r.salesCount <= 0) return false;

    if (query) {
      const hay = normalizeName(`${r.displayName} ${r.email} ${r.roleTitle}`);
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} pessoa${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  const currentUid = adminContext.user?.uid || '';

  tbody.innerHTML = filtered.map((r, index) => {
    const rankNum = index + 1;
    const rankClass = rankNum === 1 ? 'gold' : rankNum === 2 ? 'silver' : rankNum === 3 ? 'bronze' : '';
    const initial = (r.displayName || 'U').charAt(0).toUpperCase();
    const isSelf = Boolean(r.uid && r.uid === currentUid);
    const isBootstrap = Boolean(r.email && r.email.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase());

    let roleControlHtml = '';
    if (r.isRegistered && adminContext.isAdmin) {
      roleControlHtml = `
        <div class="admin-role-cell">
          <select class="admin-role-select" data-uid="${escapeHTML(r.uid)}" ${isBootstrap ? 'disabled title="Administrador Principal Protegido"' : ''} aria-label="Alterar cargo de ${escapeHTML(r.displayName)}">
            <option value="admin" ${r.role === 'admin' ? 'selected' : ''}>Administrador</option>
            <option value="manager" ${r.role === 'manager' ? 'selected' : ''}>Coordenador</option>
            <option value="staff" ${r.role === 'staff' ? 'selected' : ''}>Expositor / Equipe</option>
          </select>
        </div>
      `;
    } else {
      const roleLabel = r.role === 'admin'
        ? 'Administrador'
        : r.role === 'manager'
          ? 'Coordenador'
          : r.isRegistered
            ? 'Expositor / Equipe'
            : 'Operador / Responsável';
      roleControlHtml = `<span class="admin-role-text">${escapeHTML(roleLabel)}</span>`;
    }

    const originMeta = r.isRegistered
      ? (r.email ? escapeHTML(r.email) : 'Conta cadastrada')
      : 'Responsável nos lançamentos';

    return `
      <tr>
        <td class="text-center">
          <span class="admin-rank-num ${rankClass}">${rankNum}</span>
        </td>
        <td>
          <div class="admin-seller-cell">
            <div class="admin-seller-avatar ${r.isRegistered ? 'cloud' : 'local'}">${escapeHTML(initial)}</div>
            <div class="admin-seller-info">
              <div class="admin-seller-name">
                <strong>${escapeHTML(r.displayName)}</strong>
                ${isSelf ? '<span class="admin-self-tag">Você</span>' : ''}
              </div>
              <span class="admin-seller-meta">${originMeta}</span>
            </div>
          </div>
        </td>
        <td>${roleControlHtml}</td>
        <td class="text-center font-display">${r.salesCount}</td>
        <td class="text-right">
          <div class="admin-sales-value-box">
            <strong class="font-display text-income">${formatBRL(r.salesTotal)}</strong>
            <div class="admin-share-row">
              <div class="progress-bar-sm">
                <div class="progress-fill" style="width: ${Math.min(100, r.sharePct).toFixed(1)}%; background: var(--color-income);"></div>
              </div>
              <span class="admin-share-pct font-display">${r.sharePct.toFixed(1)}%</span>
            </div>
          </div>
        </td>
        <td class="text-right font-display">${formatBRL(r.avgTicket)}</td>
        <td class="text-center font-display">${r.lastSaleDate ? formatDate(r.lastSaleDate) : '-'}</td>
        <td class="text-center">
          <button type="button" class="btn btn-secondary btn-xs btn-admin-filter" data-seller-key="${escapeHTML(r.key)}">
            Ver Vendas (${r.transactions.length})
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminSalesTable(cachedRows = null) {
  const tbody = document.getElementById('admin-sales-tbody');
  const emptyState = document.getElementById('admin-sales-empty');
  const auditSummary = document.getElementById('admin-audit-summary');
  const btnClear = document.getElementById('btn-admin-clear-seller');
  if (!tbody) return;

  const { rows, txs } = cachedRows ? { rows: cachedRows, txs: getPeriodFilteredTransactions() } : buildSellerAggregations();

  const selectedKey = adminFilterState.selectedSellerKey;
  const txType = adminFilterState.txType;

  if (btnClear) {
    btnClear.classList.toggle('hidden', selectedKey === 'all');
  }

  let targetTxs = txs;
  let sellerLabel = 'Todas as pessoas';
  if (selectedKey !== 'all') {
    const matchedSeller = rows.find(r => r.key === selectedKey);
    targetTxs = matchedSeller ? matchedSeller.transactions : [];
    sellerLabel = matchedSeller ? matchedSeller.displayName : 'Selecionado';
  }

  if (txType !== 'all') {
    targetTxs = targetTxs.filter(t => t.type === txType);
  }

  targetTxs = [...targetTxs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalFilteredAmt = targetTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  if (auditSummary) {
    auditSummary.textContent = `${sellerLabel} • ${targetTxs.length} registro(s) • Total: ${formatBRL(totalFilteredAmt)}`;
  }

  if (targetTxs.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  tbody.innerHTML = targetTxs.map(tx => {
    const isIncome = tx.type === 'income';
    const sellerName = (tx.createdByName || tx.responsible || 'Operador da Feira').trim();

    return `
      <tr>
        <td class="font-display">${formatDate(tx.date)}</td>
        <td>
          <span class="badge-type ${isIncome ? 'income' : 'expense'}">
            ${isIncome ? 'Venda / Receita' : 'Pagamento'}
          </span>
        </td>
        <td>
          <strong>${escapeHTML(tx.description)}</strong>
          <div class="text-muted text-sm">${escapeHTML(tx.category || '')}</div>
        </td>
        <td>
          <span class="font-medium">${escapeHTML(sellerName)}</span>
          ${tx.createdByEmail ? `<div class="text-muted text-sm">${escapeHTML(tx.createdByEmail)}</div>` : ''}
        </td>
        <td><span class="badge-payment">${escapeHTML(tx.paymentMethod || 'Outro')}</span></td>
        <td class="text-right tx-amount-cell ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '-'}${formatBRL(tx.amount)}
        </td>
        <td class="text-center">
          <button type="button" class="btn-icon btn-admin-receipt" data-tx-id="${escapeHTML(tx.id)}" title="Abrir Comprovante Oficial" aria-label="Abrir Comprovante">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

export function exportAdminSellersCSV() {
  const { rows } = buildSellerAggregations();
  const headers = [
    'Posicao',
    'Nome',
    'Email',
    'Cargo / Funcao',
    'Tipo Cadastro',
    'Qtd Vendas',
    'Total Vendido (R$)',
    'Despesas Registradas (R$)',
    'Saldo Liquido (R$)',
    'Ticket Medio (R$)',
    'Participacao (%)',
    'Ultima Venda'
  ];

  const lines = rows.map((r, idx) => [
    idx + 1,
    `"${String(r.displayName || '').replace(/"/g, '""')}"`,
    `"${String(r.email || '').replace(/"/g, '""')}"`,
    `"${String(r.roleTitle || '').replace(/"/g, '""')}"`,
    r.isRegistered ? 'Conta Nuvem' : 'Responsavel Local',
    r.salesCount,
    r.salesTotal.toFixed(2).replace('.', ','),
    r.expensesTotal.toFixed(2).replace('.', ','),
    r.netTotal.toFixed(2).replace('.', ','),
    r.avgTicket.toFixed(2).replace('.', ','),
    r.sharePct.toFixed(1).replace('.', ','),
    r.lastSaleDate || '-'
  ].join(';'));

  const csvContent = '\uFEFF' + [headers.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `feirafinance_adm_vendedores_${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Relatório Exportado', 'Planilha de vendedores e vendas gerada em CSV.', 'success');
}
