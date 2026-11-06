/**
 * FeiraFinance — Filters, Search, Sorting & Pagination Engine
 */

import { Storage } from './storage.js';

export const FilterState = {
  searchQuery: '',
  typeFilter: 'all', // 'all' | 'income' | 'expense'
  categoryFilter: 'all',
  periodPreset: 'thisMonth', // 'all' | 'today' | 'last7' | 'thisMonth' | 'thisYear' | 'custom'
  startDate: '',
  endDate: '',
  sortField: 'date',
  sortDirection: 'desc',
  currentPage: 1,
  itemsPerPage: 10,

  // Ouvintes de mudança de filtro
  listeners: [],

  subscribe(callback) {
    this.listeners.push(callback);
  },

  notify() {
    this.listeners.forEach(fn => fn());
  },

  reset() {
    this.searchQuery = '';
    this.typeFilter = 'all';
    this.categoryFilter = 'all';
    this.periodPreset = 'thisMonth';
    this.calculatePresetDates('thisMonth');
    this.sortField = 'date';
    this.sortDirection = 'desc';
    this.currentPage = 1;
    this.notify();
  },

  calculatePresetDates(preset) {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const toYMD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'today') {
      const ymd = toYMD(today);
      this.startDate = ymd;
      this.endDate = ymd;
    } else if (preset === 'last7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      this.startDate = toYMD(past);
      this.endDate = toYMD(today);
    } else if (preset === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      this.startDate = toYMD(first);
      this.endDate = toYMD(last);
    } else if (preset === 'thisYear') {
      const first = new Date(today.getFullYear(), 0, 1);
      const last = new Date(today.getFullYear(), 11, 31);
      this.startDate = toYMD(first);
      this.endDate = toYMD(last);
    } else if (preset === 'all') {
      this.startDate = '';
      this.endDate = '';
    }
  }
};

// Inicializa as datas do preset inicial 'thisMonth'
FilterState.calculatePresetDates(FilterState.periodPreset);

/**
 * Retorna as transações após aplicar busca, filtros de tipo, categoria, período e ordenação
 */
export function getFilteredTransactions() {
  const all = Storage.getTransactions();

  return all.filter(tx => {
    // 1. Filtro por Tipo (Receita / Despesa)
    if (FilterState.typeFilter !== 'all' && tx.type !== FilterState.typeFilter) {
      return false;
    }

    // 2. Filtro por Categoria
    if (FilterState.categoryFilter !== 'all' && tx.category !== FilterState.categoryFilter) {
      return false;
    }

    // 3. Busca Textual (Descrição e Responsável)
    if (FilterState.searchQuery) {
      const q = FilterState.searchQuery.toLowerCase();
      const descMatch = (tx.description || '').toLowerCase().includes(q);
      const respMatch = (tx.responsible || '').toLowerCase().includes(q);
      const catMatch = (tx.category || '').toLowerCase().includes(q);
      if (!descMatch && !respMatch && !catMatch) {
        return false;
      }
    }

    // 4. Filtro por Data
    if (FilterState.startDate && tx.date < FilterState.startDate) {
      return false;
    }
    if (FilterState.endDate && tx.date > FilterState.endDate) {
      return false;
    }

    return true;
  });
}

/**
 * Retorna transações filtradas e ordenadas
 */
export function getSortedTransactions() {
  const filtered = getFilteredTransactions();
  const { sortField, sortDirection } = FilterState;

  return filtered.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'amount') {
      valA = Number(valA);
      valB = Number(valB);
    } else if (sortField === 'date') {
      valA = new Date(valA).getTime();
      valB = new Date(valB).getTime();
    } else {
      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Retorna página atual dos dados
 */
export function getPaginatedTransactions() {
  const sorted = getSortedTransactions();
  const total = sorted.length;
  const totalPages = Math.ceil(total / FilterState.itemsPerPage) || 1;

  if (FilterState.currentPage > totalPages) {
    FilterState.currentPage = totalPages;
  }
  if (FilterState.currentPage < 1) {
    FilterState.currentPage = 1;
  }

  const startIdx = (FilterState.currentPage - 1) * FilterState.itemsPerPage;
  const endIdx = startIdx + FilterState.itemsPerPage;
  const items = sorted.slice(startIdx, endIdx);

  return {
    items,
    total,
    totalPages,
    currentPage: FilterState.currentPage,
    startIdx: total > 0 ? startIdx + 1 : 0,
    endIdx: Math.min(endIdx, total)
  };
}

/**
 * Renderiza Chips de filtros ativos na barra superior
 */
export function renderActiveFilterChips() {
  const container = document.getElementById('active-filter-chips');
  const chipsList = document.getElementById('chips-list');
  if (!container || !chipsList) return;

  const chips = [];

  if (FilterState.searchQuery) {
    chips.push({
      label: `Busca: "${FilterState.searchQuery}"`,
      onRemove: () => {
        FilterState.searchQuery = '';
        const input = document.getElementById('filter-search-input');
        if (input) input.value = '';
        FilterState.notify();
      }
    });
  }

  if (FilterState.typeFilter !== 'all') {
    chips.push({
      label: `Tipo: ${FilterState.typeFilter === 'income' ? 'Receitas' : 'Despesas'}`,
      onRemove: () => {
        FilterState.typeFilter = 'all';
        FilterState.notify();
      }
    });
  }

  if (FilterState.categoryFilter !== 'all') {
    chips.push({
      label: `Categoria: ${FilterState.categoryFilter}`,
      onRemove: () => {
        FilterState.categoryFilter = 'all';
        FilterState.notify();
      }
    });
  }

  if (FilterState.periodPreset !== 'all') {
    const presetNames = {
      today: 'Hoje',
      last7: 'Últimos 7 dias',
      thisMonth: 'Este Mês',
      thisYear: 'Este Ano',
      custom: 'Período Personalizado'
    };
    chips.push({
      label: `Período: ${presetNames[FilterState.periodPreset] || FilterState.periodPreset}`,
      onRemove: () => {
        FilterState.periodPreset = 'all';
        FilterState.calculatePresetDates('all');
        FilterState.notify();
      }
    });
  }

  if (chips.length > 0) {
    container.classList.remove('hidden');
    chipsList.innerHTML = chips.map((c, idx) => `
      <span class="chip">
        <span>${c.label}</span>
        <button class="chip-remove" data-chip-idx="${idx}" aria-label="Remover filtro">✕</button>
      </span>
    `).join('');

    chipsList.querySelectorAll('.chip-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-chip-idx'));
        if (chips[idx]) chips[idx].onRemove();
      });
    });
  } else {
    container.classList.add('hidden');
    chipsList.innerHTML = '';
  }
}

/**
 * Atualiza o dropdown de categorias dos filtros dinamicamente
 */
export function updateCategoryFilterOptions() {
  const select = document.getElementById('filter-category-select');
  if (!select) return;

  const cats = Storage.getCategories();
  const allCats = Array.from(new Set([...cats.income, ...cats.expense])).sort();

  const currentVal = select.value;
  select.innerHTML = `<option value="all">Todas as Categorias</option>` +
    allCats.map(c => `<option value="${c}" ${c === currentVal ? 'selected' : ''}>${c}</option>`).join('');
}
