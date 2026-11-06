/**
 * FeiraFinance — Transactions CRUD Engine
 * Gestão de Lançamentos, Validações Inline, Tabela, Ações em Lote e Emissão de Recibo
 */

import { Storage } from './storage.js';
import {
  formatBRL,
  parseBRL,
  formatDate,
  escapeHTML,
  openModal,
  closeModal,
  showToast,
  setupCurrencyInputMask,
  playAudioFeedback,
  openReceiptModal
} from './ui.js';
import { FilterState, getPaginatedTransactions, renderActiveFilterChips, getFilteredTransactions } from './filters.js';
import { updateDashboard } from './dashboard.js';

let selectedIds = new Set();
let pendingDeleteId = null;

export function initTransactionsModule() {
  setupTransactionForm();
  setupTableEventListeners();
  setupBatchActionListeners();
  setupDeleteModalListeners();
}

export function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('table-empty-state');
  const table = document.getElementById('transactions-table');
  const summaryEl = document.getElementById('pagination-summary');
  const filteredAmountEl = document.getElementById('filtered-total-amount');

  if (!tbody) return;

  const { items, total, totalPages, currentPage, startIdx, endIdx } = getPaginatedTransactions();

  const allFiltered = getFilteredTransactions();
  let totalIncome = 0;
  let totalExpense = 0;
  allFiltered.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else totalExpense += t.amount;
  });
  const filteredNet = totalIncome - totalExpense;
  if (filteredAmountEl) {
    filteredAmountEl.textContent = formatBRL(filteredNet);
    filteredAmountEl.style.color = filteredNet >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
  }

  if (total === 0) {
    tbody.innerHTML = '';
    if (table) table.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (summaryEl) summaryEl.textContent = 'Nenhum lançamento no filtro';
    renderPaginationButtons(1, 1);
    updateBatchBar();
    return;
  }

  if (table) table.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  if (summaryEl) {
    summaryEl.textContent = `Exibindo ${startIdx} a ${endIdx} de ${total} lançamentos`;
  }

  tbody.innerHTML = items.map(tx => {
    const isChecked = selectedIds.has(tx.id);
    const isIncome = tx.type === 'income';

    return `
      <tr class="${isChecked ? 'row-selected' : ''}" data-row-id="${tx.id}">
        <td class="td-checkbox">
          <input type="checkbox" class="row-checkbox" data-tx-id="${tx.id}" ${isChecked ? 'checked' : ''} aria-label="Selecionar lançamento" />
        </td>
        <td>${formatDate(tx.date)}</td>
        <td>
          <span class="badge-type ${isIncome ? 'income' : 'expense'}">
            ${isIncome
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`
              : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`
            }
            ${isIncome ? 'Recebimento' : 'Pagamento'}
          </span>
        </td>
        <td>
          <strong title="${escapeHTML(tx.description)}">${escapeHTML(tx.description)}</strong>
          ${tx.notes ? `<div class="text-muted text-sm">${escapeHTML(tx.notes)}</div>` : ''}
        </td>
        <td>
          <span class="badge-category">${escapeHTML(tx.category)}</span>
        </td>
        <td>
          <span class="badge-payment">${escapeHTML(tx.paymentMethod || 'Outro')}</span>
        </td>
        <td>
          <span class="text-sm">${escapeHTML(tx.responsible || '-')}</span>
        </td>
        <td class="text-right tx-amount-cell ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '-'}${formatBRL(tx.amount)}
        </td>
        <td class="actions-cell">
          <button class="btn-icon btn-receipt-tx" data-tx-id="${tx.id}" title="Gerar Recibo Oficial" aria-label="Gerar Recibo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </button>
          <button class="btn-icon btn-edit-tx" data-tx-id="${tx.id}" title="Editar lançamento" aria-label="Editar lançamento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="btn-icon btn-delete-tx text-danger" data-tx-id="${tx.id}" title="Excluir lançamento" aria-label="Excluir lançamento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderPaginationButtons(currentPage, totalPages);

  const masterCb = document.getElementById('th-select-all');
  if (masterCb) {
    const allOnPageSelected = items.length > 0 && items.every(it => selectedIds.has(it.id));
    masterCb.checked = allOnPageSelected;
    masterCb.indeterminate = !allOnPageSelected && items.some(it => selectedIds.has(it.id));
  }

  updateSortIndicators();
  updateBatchBar();
}

function renderPaginationButtons(current, totalPages) {
  const container = document.getElementById('pagination-pages');
  const prevBtn = document.getElementById('btn-pagination-prev');
  const nextBtn = document.getElementById('btn-pagination-next');

  if (prevBtn) prevBtn.disabled = current <= 1;
  if (nextBtn) nextBtn.disabled = current >= totalPages;

  if (!container) return;

  let html = '';
  const maxButtons = 5;
  let startPage = Math.max(1, current - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `
      <button class="btn-page ${p === current ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>
    `;
  }
  container.innerHTML = html;

  container.querySelectorAll('.btn-page').forEach(btn => {
    btn.addEventListener('click', () => {
      FilterState.currentPage = Number(btn.getAttribute('data-page'));
      renderTransactionsTable();
    });
  });
}

function updateSortIndicators() {
  document.querySelectorAll('.th-sortable').forEach(th => {
    const field = th.getAttribute('data-sort');
    const icon = th.querySelector('.sort-indicator');
    if (!icon) return;

    if (field === FilterState.sortField) {
      th.classList.add('active');
      icon.textContent = FilterState.sortDirection === 'asc' ? '↑' : '↓';
    } else {
      th.classList.remove('active');
      icon.textContent = '↕';
    }
  });
}

function updateBatchBar() {
  const bar = document.getElementById('batch-action-bar');
  const countBadge = document.getElementById('batch-selected-count');
  if (!bar || !countBadge) return;

  const count = selectedIds.size;
  if (count > 0) {
    countBadge.textContent = count;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function setupTransactionForm() {
  const form = document.getElementById('form-transaction');
  const amountInput = document.getElementById('tx-amount');
  const typeTabIncome = document.getElementById('tab-type-income');
  const typeTabExpense = document.getElementById('tab-type-expense');
  const txTypeInput = document.getElementById('tx-type');

  if (amountInput) {
    setupCurrencyInputMask(amountInput);
  }

  const switchType = (newType) => {
    if (txTypeInput) txTypeInput.value = newType;
    if (newType === 'income') {
      typeTabIncome.classList.add('active');
      typeTabExpense.classList.remove('active');
    } else {
      typeTabExpense.classList.add('active');
      typeTabIncome.classList.remove('active');
    }
    populateCategoryOptions(newType);
  };

  if (typeTabIncome) typeTabIncome.addEventListener('click', () => switchType('income'));
  if (typeTabExpense) typeTabExpense.addEventListener('click', () => switchType('expense'));

  const btnCloseModal = document.getElementById('btn-close-transaction-modal');
  const btnCancelModal = document.getElementById('btn-cancel-transaction-modal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', () => closeModal('modal-transaction'));
  if (btnCancelModal) btnCancelModal.addEventListener('click', () => closeModal('modal-transaction'));

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateTransactionForm()) return;

      const txId = document.getElementById('tx-id').value;
      const type = document.getElementById('tx-type').value;
      const description = document.getElementById('tx-description').value.trim();
      const amount = parseBRL(document.getElementById('tx-amount').value);
      const date = document.getElementById('tx-date').value;
      const category = document.getElementById('tx-category').value;
      const paymentMethod = document.getElementById('tx-payment-method').value;
      const responsible = document.getElementById('tx-responsible').value.trim();
      const notes = document.getElementById('tx-notes').value.trim();

      const payload = {
        type,
        description,
        amount,
        date,
        category,
        paymentMethod,
        responsible,
        notes
      };

      if (txId) {
        Storage.updateTransaction(txId, payload);
        playAudioFeedback(type);
        showToast('Lançamento Atualizado', `"${description}" salvo com sucesso.`);
      } else {
        Storage.addTransaction(payload);
        playAudioFeedback(type);
        showToast('Novo Lançamento', `"${description}" adicionado com sucesso.`);
      }

      closeModal('modal-transaction');
      renderTransactionsTable();
      updateDashboard();
    });
  }
}

function validateTransactionForm() {
  let isValid = true;

  const descInput = document.getElementById('tx-description');
  const amountInput = document.getElementById('tx-amount');
  const dateInput = document.getElementById('tx-date');
  const catInput = document.getElementById('tx-category');

  const errDesc = document.getElementById('err-tx-description');
  const errAmount = document.getElementById('err-tx-amount');
  const errDate = document.getElementById('err-tx-date');
  const errCat = document.getElementById('err-tx-category');

  if (!descInput.value.trim() || descInput.value.trim().length < 3) {
    errDesc.classList.remove('hidden');
    isValid = false;
  } else {
    errDesc.classList.add('hidden');
  }

  const amtVal = parseBRL(amountInput.value);
  if (!amtVal || amtVal <= 0) {
    errAmount.classList.remove('hidden');
    isValid = false;
  } else {
    errAmount.classList.add('hidden');
  }

  if (!dateInput.value) {
    errDate.classList.remove('hidden');
    isValid = false;
  } else {
    errDate.classList.add('hidden');
  }

  if (!catInput.value) {
    errCat.classList.remove('hidden');
    isValid = false;
  } else {
    errCat.classList.add('hidden');
  }

  return isValid;
}

export function populateCategoryOptions(type, selectedCategory = '') {
  const catSelect = document.getElementById('tx-category');
  if (!catSelect) return;

  const categories = Storage.getCategories();
  const list = categories[type] || [];

  catSelect.innerHTML = list.map(c => `
    <option value="${escapeHTML(c)}" ${c === selectedCategory ? 'selected' : ''}>
      ${escapeHTML(c)}
    </option>
  `).join('');
}

export function openNewTransactionModal(defaultType = 'income', prefillData = {}) {
  document.getElementById('modal-transaction-title').textContent = 'Novo Lançamento';
  document.getElementById('tx-id').value = '';
  document.getElementById('tx-description').value = prefillData.description || '';
  document.getElementById('tx-amount').value = prefillData.amount ? formatBRL(prefillData.amount) : '';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('tx-date').value = prefillData.date || today;

  document.getElementById('tx-responsible').value = prefillData.responsible || '';
  document.getElementById('tx-notes').value = prefillData.notes || '';

  document.querySelectorAll('.field-error').forEach(el => el.classList.add('hidden'));

  const txTypeInput = document.getElementById('tx-type');
  if (txTypeInput) txTypeInput.value = defaultType;

  const typeTabIncome = document.getElementById('tab-type-income');
  const typeTabExpense = document.getElementById('tab-type-expense');
  if (defaultType === 'income') {
    typeTabIncome.classList.add('active');
    typeTabExpense.classList.remove('active');
  } else {
    typeTabExpense.classList.add('active');
    typeTabIncome.classList.remove('active');
  }

  populateCategoryOptions(defaultType, prefillData.category || '');
  openModal('modal-transaction');
}

export function openEditTransactionModal(id) {
  const transactions = Storage.getTransactions();
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('modal-transaction-title').textContent = 'Editar Lançamento';
  document.getElementById('tx-id').value = tx.id;
  document.getElementById('tx-type').value = tx.type;
  document.getElementById('tx-description').value = tx.description;
  document.getElementById('tx-amount').value = formatBRL(tx.amount);
  document.getElementById('tx-date').value = tx.date;
  document.getElementById('tx-payment-method').value = tx.paymentMethod || 'PIX';
  document.getElementById('tx-responsible').value = tx.responsible || '';
  document.getElementById('tx-notes').value = tx.notes || '';

  document.querySelectorAll('.field-error').forEach(el => el.classList.add('hidden'));

  const typeTabIncome = document.getElementById('tab-type-income');
  const typeTabExpense = document.getElementById('tab-type-expense');
  if (tx.type === 'income') {
    typeTabIncome.classList.add('active');
    typeTabExpense.classList.remove('active');
  } else {
    typeTabExpense.classList.add('active');
    typeTabIncome.classList.remove('active');
  }

  populateCategoryOptions(tx.type, tx.category);
  openModal('modal-transaction');
}

function setupTableEventListeners() {
  const tbody = document.getElementById('transactions-tbody');
  const masterCb = document.getElementById('th-select-all');

  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const receiptBtn = e.target.closest('.btn-receipt-tx');
      if (receiptBtn) {
        const id = receiptBtn.getAttribute('data-tx-id');
        const transactions = Storage.getTransactions();
        const tx = transactions.find(t => t.id === id);
        if (tx) openReceiptModal(tx);
        return;
      }

      const editBtn = e.target.closest('.btn-edit-tx');
      if (editBtn) {
        const id = editBtn.getAttribute('data-tx-id');
        openEditTransactionModal(id);
        return;
      }

      const deleteBtn = e.target.closest('.btn-delete-tx');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-tx-id');
        openSingleDeleteModal(id);
        return;
      }

      const cb = e.target.closest('.row-checkbox');
      if (cb) {
        const id = cb.getAttribute('data-tx-id');
        if (cb.checked) selectedIds.add(id);
        else selectedIds.delete(id);

        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', cb.checked);
        updateBatchBar();
      }
    });
  }

  if (masterCb) {
    masterCb.addEventListener('change', () => {
      const { items } = getPaginatedTransactions();
      if (masterCb.checked) {
        items.forEach(it => selectedIds.add(it.id));
      } else {
        items.forEach(it => selectedIds.delete(it.id));
      }
      renderTransactionsTable();
    });
  }

  document.querySelectorAll('.th-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (FilterState.sortField === field) {
        FilterState.sortDirection = FilterState.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        FilterState.sortField = field;
        FilterState.sortDirection = 'asc';
      }
      renderTransactionsTable();
    });
  });

  const prevBtn = document.getElementById('btn-pagination-prev');
  const nextBtn = document.getElementById('btn-pagination-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (FilterState.currentPage > 1) {
        FilterState.currentPage--;
        renderTransactionsTable();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      FilterState.currentPage++;
      renderTransactionsTable();
    });
  }

  const selectItems = document.getElementById('select-items-per-page');
  if (selectItems) {
    selectItems.addEventListener('change', (e) => {
      FilterState.itemsPerPage = Number(e.target.value);
      FilterState.currentPage = 1;
      renderTransactionsTable();
    });
  }
}

function setupBatchActionListeners() {
  const btnBatchDelete = document.getElementById('btn-batch-delete');
  const btnBatchDeselect = document.getElementById('btn-batch-deselect');
  const btnConfirmBatch = document.getElementById('btn-confirm-batch-delete');
  const btnCancelBatch = document.getElementById('btn-cancel-batch-delete');
  const btnCloseBatchModal = document.getElementById('btn-close-batch-modal');

  if (btnBatchDelete) {
    btnBatchDelete.addEventListener('click', () => {
      const count = selectedIds.size;
      if (count === 0) return;
      document.getElementById('batch-delete-count-display').textContent = count;
      openModal('modal-batch-delete-confirm');
    });
  }

  if (btnBatchDeselect) {
    btnBatchDeselect.addEventListener('click', () => {
      selectedIds.clear();
      renderTransactionsTable();
    });
  }

  if (btnCancelBatch) btnCancelBatch.addEventListener('click', () => closeModal('modal-batch-delete-confirm'));
  if (btnCloseBatchModal) btnCloseBatchModal.addEventListener('click', () => closeModal('modal-batch-delete-confirm'));

  if (btnConfirmBatch) {
    btnConfirmBatch.addEventListener('click', () => {
      const count = selectedIds.size;
      Storage.deleteTransactions(Array.from(selectedIds));
      selectedIds.clear();
      closeModal('modal-batch-delete-confirm');
      showToast('Exclusão Concluída', `${count} lançamentos foram excluídos.`);
      renderTransactionsTable();
      updateDashboard();
    });
  }
}

function openSingleDeleteModal(id) {
  pendingDeleteId = id;
  const transactions = Storage.getTransactions();
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('delete-tx-desc').textContent = tx.description;
  document.getElementById('delete-tx-val').textContent = formatBRL(tx.amount);
  openModal('modal-delete-confirm');
}

function setupDeleteModalListeners() {
  const btnCancel = document.getElementById('btn-cancel-delete');
  const btnClose = document.getElementById('btn-close-delete-modal');
  const btnConfirm = document.getElementById('btn-confirm-delete');

  if (btnCancel) btnCancel.addEventListener('click', () => closeModal('modal-delete-confirm'));
  if (btnClose) btnClose.addEventListener('click', () => closeModal('modal-delete-confirm'));

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (!pendingDeleteId) return;
      Storage.deleteTransaction(pendingDeleteId);
      selectedIds.delete(pendingDeleteId);
      pendingDeleteId = null;
      closeModal('modal-delete-confirm');
      showToast('Lançamento Excluído', 'O registro foi removido com sucesso.');
      renderTransactionsTable();
      updateDashboard();
    });
  }
}
