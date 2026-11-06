/**
 * FeiraFinance — Booths & Exhibitors Module (Gestão de Estandes)
 * Controle operacional e financeiro de espaços comerciais da feira
 */

import { Storage } from './storage.js';
import { formatBRL, escapeHTML, openModal, closeModal, showToast } from './ui.js';
import { openNewTransactionModal } from './transactions.js';
import { updateDashboard } from './dashboard.js';

let boothSectorFilter = 'all';
let boothSearchQuery = '';

export function initBoothsModule() {
  setupBoothFormsAndModals();
  renderBoothsView();
}

export function renderBoothsView() {
  const container = document.getElementById('booths-grid-container');
  const sectorSelect = document.getElementById('filter-booth-sector');
  const searchInput = document.getElementById('search-booths-input');
  const totalOccupiedEl = document.getElementById('booths-stat-occupied');
  const totalContractedEl = document.getElementById('booths-stat-contracted');
  const totalCollectedEl = document.getElementById('booths-stat-collected');
  const totalPendingEl = document.getElementById('booths-stat-pending');

  if (!container) return;

  const booths = Storage.getBooths();

  // Calcula estatísticas
  let totalContracted = 0;
  let totalCollected = 0;
  let occupiedCount = 0;

  booths.forEach(b => {
    totalContracted += b.price;
    totalCollected += b.paidAmount;
    if (b.status === 'paid' || b.status === 'partial') occupiedCount++;
  });

  const totalPending = Math.max(0, totalContracted - totalCollected);
  const occupancyRate = booths.length > 0 ? Math.round((occupiedCount / booths.length) * 100) : 0;

  if (totalOccupiedEl) totalOccupiedEl.textContent = `${occupiedCount}/${booths.length} (${occupancyRate}%)`;
  if (totalContractedEl) totalContractedEl.textContent = formatBRL(totalContracted);
  if (totalCollectedEl) totalCollectedEl.textContent = formatBRL(totalCollected);
  if (totalPendingEl) totalPendingEl.textContent = formatBRL(totalPending);

  // Filtra
  const filtered = booths.filter(b => {
    if (boothSectorFilter !== 'all' && b.sector !== boothSectorFilter) return false;
    if (boothSearchQuery) {
      const q = boothSearchQuery.toLowerCase();
      const matchNum = b.number.toLowerCase().includes(q);
      const matchEx = b.exhibitor.toLowerCase().includes(q);
      const matchSec = (b.sector || '').toLowerCase().includes(q);
      if (!matchNum && !matchEx && !matchSec) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state full-width">
        <h4 class="empty-state-title">Nenhum estande encontrado</h4>
        <p class="empty-state-desc">Altere os filtros de busca ou cadastre um novo espaço para expositores.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(b => {
    let statusClass = 'pending';
    let statusLabel = 'Pendente';
    if (b.status === 'paid') {
      statusClass = 'paid';
      statusLabel = 'Quitado';
    } else if (b.status === 'partial') {
      statusClass = 'partial';
      statusLabel = 'Parcial';
    }

    const remaining = Math.max(0, b.price - b.paidAmount);

    return `
      <div class="booth-card" data-booth-id="${b.id}" data-sector="${escapeHTML(b.sector || 'Geral')}">
        <div class="booth-card-header">
          <div>
            <span class="booth-sector-tag">${escapeHTML(b.sector || 'Geral')}</span>
            <h4 class="booth-number">${escapeHTML(b.number)}</h4>
          </div>
          <span class="booth-status-badge ${statusClass}">${statusLabel}</span>
        </div>

        <div class="booth-body">
          <strong class="booth-exhibitor" title="${escapeHTML(b.exhibitor)}">${escapeHTML(b.exhibitor)}</strong>
          ${b.contact ? `<span class="booth-contact">📞 ${escapeHTML(b.contact)}</span>` : ''}
          ${b.notes ? `<p class="booth-notes">${escapeHTML(b.notes)}</p>` : ''}
        </div>

        <div class="booth-financial-row">
          <div>
            <span class="booth-f-label">Locação:</span>
            <strong class="booth-f-val">${formatBRL(b.price)}</strong>
          </div>
          <div class="text-right">
            <span class="booth-f-label">Pago:</span>
            <strong class="booth-f-val ${b.paidAmount > 0 ? 'text-income' : 'text-expense'}">${formatBRL(b.paidAmount)}</strong>
          </div>
        </div>

        ${remaining > 0 ? `
          <div class="booth-remaining-pill">
            <span>Falta pagar: <strong>${formatBRL(remaining)}</strong></span>
          </div>
        ` : `
          <div class="booth-paid-pill">
            <span>✓ Totalmente liquidado</span>
          </div>
        `}

        <div class="booth-actions-row">
          ${remaining > 0 ? `
            <button class="btn btn-primary btn-xs btn-booth-pay" data-booth-id="${b.id}" title="Lançar recebimento no financeiro">
              <span>+ Receber PIX/Cartão</span>
            </button>
          ` : `
            <button class="btn btn-secondary btn-xs btn-booth-pay" data-booth-id="${b.id}">
              <span>+ Novo Lançamento</span>
            </button>
          `}
          <button class="btn btn-ghost btn-xs btn-booth-edit" data-booth-id="${b.id}" title="Editar estande">Editar</button>
          <button class="btn btn-ghost btn-xs btn-booth-delete text-danger" data-booth-id="${b.id}" title="Excluir estande">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners nos cartões
  container.querySelectorAll('.btn-booth-pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-booth-id');
      const b = booths.find(item => item.id === id);
      if (!b) return;

      const remaining = Math.max(0, b.price - b.paidAmount);
      openNewTransactionModal('income', {
        description: `Aluguel ${b.number} - ${b.exhibitor}`,
        amount: remaining > 0 ? remaining : b.price,
        category: 'Aluguel de Estande',
        responsible: b.exhibitor,
        notes: `Locação do ${b.number} (${b.sector}). Contato: ${b.contact || '-'}`
      });
    });
  });

  container.querySelectorAll('.btn-booth-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-booth-id');
      openEditBoothModal(id);
    });
  });

  container.querySelectorAll('.btn-booth-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-booth-id');
      if (confirm('Tem certeza de que deseja remover este estande do cadastro?')) {
        Storage.deleteBooth(id);
        showToast('Estande Removido', 'Cadastro atualizado com sucesso.');
        renderBoothsView();
        updateDashboard();
      }
    });
  });
}

export function openBoothModal(boothData = null) {
  if (boothData) {
    document.getElementById('modal-booth-title').textContent = 'Editar Estande';
    document.getElementById('booth-id').value = boothData.id;
    document.getElementById('booth-number').value = boothData.number;
    document.getElementById('booth-exhibitor').value = boothData.exhibitor;
    document.getElementById('booth-sector').value = boothData.sector || 'Gastronomia';
    document.getElementById('booth-price').value = boothData.price;
    document.getElementById('booth-paid').value = boothData.paidAmount;
    document.getElementById('booth-contact').value = boothData.contact || '';
    document.getElementById('booth-notes').value = boothData.notes || '';
  } else {
    document.getElementById('modal-booth-title').textContent = 'Cadastrar Novo Estande';
    document.getElementById('booth-id').value = '';
    document.getElementById('booth-number').value = `Estande ${Storage.getBooths().length + 1}`;
    document.getElementById('booth-exhibitor').value = '';
    document.getElementById('booth-sector').value = 'Gastronomia';
    document.getElementById('booth-price').value = '1000.00';
    document.getElementById('booth-paid').value = '0.00';
    document.getElementById('booth-contact').value = '';
    document.getElementById('booth-notes').value = '';
  }
  openModal('modal-booth');
}

function setupBoothFormsAndModals() {
  const formBooth = document.getElementById('form-booth');
  const btnNewBooth = document.getElementById('btn-open-new-booth-modal');
  const btnCancelBooth = document.getElementById('btn-cancel-booth-modal');
  const btnCloseBooth = document.getElementById('btn-close-booth-modal');
  const searchInput = document.getElementById('search-booths-input');
  const sectorSelect = document.getElementById('filter-booth-sector');

  if (btnNewBooth) {
    btnNewBooth.addEventListener('click', () => {
      openBoothModal();
    });
  }

  if (btnCancelBooth) btnCancelBooth.addEventListener('click', () => closeModal('modal-booth'));
  if (btnCloseBooth) btnCloseBooth.addEventListener('click', () => closeModal('modal-booth'));

  if (formBooth) {
    formBooth.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('booth-id').value;
      const number = document.getElementById('booth-number').value.trim();
      const exhibitor = document.getElementById('booth-exhibitor').value.trim();
      const sector = document.getElementById('booth-sector').value;
      const price = Number(document.getElementById('booth-price').value) || 0;
      const paidAmount = Number(document.getElementById('booth-paid').value) || 0;
      const contact = document.getElementById('booth-contact').value.trim();
      const notes = document.getElementById('booth-notes').value.trim();

      let status = 'pending';
      if (paidAmount >= price && price > 0) status = 'paid';
      else if (paidAmount > 0) status = 'partial';

      const data = { number, exhibitor, sector, price, paidAmount, status, contact, notes };

      if (id) {
        Storage.updateBooth(id, data);
        showToast('Estande Atualizado', `"${number}" alterado com sucesso.`);
      } else {
        Storage.addBooth(data);
        showToast('Estande Criado', `"${number}" cadastrado com sucesso.`);
      }

      closeModal('modal-booth');
      renderBoothsView();
      updateDashboard();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      boothSearchQuery = e.target.value.trim();
      renderBoothsView();
    });
  }

  if (sectorSelect) {
    sectorSelect.addEventListener('change', (e) => {
      boothSectorFilter = e.target.value;
      renderBoothsView();
    });
  }
}

function openEditBoothModal(id) {
  const booths = Storage.getBooths();
  const b = booths.find(item => item.id === id);
  if (!b) return;
  openBoothModal(b);
}
