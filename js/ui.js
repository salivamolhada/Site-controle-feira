/**
 * FeiraFinance — UI Utilities, Formatting, Modals, Toasts & Audio FX
 */

import { Storage } from './storage.js';

// Formatador oficial de Moeda Brasileira
const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

/**
 * Formata número para string monetária (ex.: 1250.5 -> "R$ 1.250,50")
 */
export function formatBRL(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return brlFormatter.format(0);
  }
  return brlFormatter.format(Number(value));
}

/**
 * Converte string formatada ou valor para número float
 */
export function parseBRL(valueStr) {
  if (typeof valueStr === 'number') return valueStr;
  if (!valueStr) return 0;
  const cleanDigits = String(valueStr).replace(/\D/g, '');
  if (!cleanDigits) return 0;
  return Number(cleanDigits) / 100;
}

/**
 * Converte valor numérico para extenso em Reais (pt-BR)
 */
export function numberToCurrencyWords(amount) {
  const n = Math.abs(Number(amount));
  if (isNaN(n) || n === 0) return 'Zero reais';

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  function converterCentena(num) {
    if (num === 100) return 'cem';
    let res = '';
    const c = Math.floor(num / 100);
    const d = Math.floor((num % 100) / 10);
    const u = num % 10;

    if (c > 0) res += centenas[c];

    if (d === 1) {
      if (res) res += ' e ';
      res += especiais[u];
      return res;
    }

    if (d > 1) {
      if (res) res += ' e ';
      res += dezenas[d];
    }

    if (u > 0) {
      if (res) res += ' e ';
      res += unidades[u];
    }

    return res;
  }

  const inteiro = Math.floor(n);
  const centavos = Math.round((n - inteiro) * 100);

  let partesExtenso = [];

  // Milhares
  const mil = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;

  if (mil > 0) {
    if (mil === 1) partesExtenso.push('mil');
    else partesExtenso.push(converterCentena(mil) + ' mil');
  }

  if (resto > 0) {
    partesExtenso.push(converterCentena(resto));
  }

  let finalStr = partesExtenso.join(' e ') || 'zero';
  finalStr += inteiro === 1 ? ' real' : ' reais';

  if (centavos > 0) {
    finalStr += ' e ' + converterCentena(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
  }

  return finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
}

/**
 * Aplica máscara dinâmica em tempo real para inputs monetários (R$ 0,00)
 */
export function setupCurrencyInputMask(inputElement) {
  if (!inputElement) return;

  inputElement.addEventListener('input', (e) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      e.target.value = '';
      return;
    }
    const floatVal = Number(rawVal) / 100;
    e.target.value = formatBRL(floatVal);
  });

  inputElement.addEventListener('focus', (e) => {
    if (!e.target.value) {
      e.target.value = formatBRL(0);
    }
  });
}

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  const parts = String(dateString).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Sanitiza texto para prevenir XSS ao injetar em innerHTML
 */
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* --------------------------------------------------------
   Sintetizador de Áudio (Web Audio API)
   Toques harmônicos sutis para feedback sem arquivos externos
   -------------------------------------------------------- */
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function playAudioFeedback(type = 'income') {
  const settings = Storage.getSettings();
  if (settings.soundEnabled === false) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'income') {
      // Tom harmônico ascendente suave (cristalino)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Tom neutro/quente suave
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(392.00, now); // G4
      osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.1); // E4

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    // Ignora se navegador bloquear autoplay
  }
}

/* --------------------------------------------------------
   Gerenciamento de Toasts
   -------------------------------------------------------- */
let toastCounter = 0;

export function showToast(title, message, type = 'success') {
  const container = document.getElementById('toasts-container');
  if (!container) return;

  toastCounter++;
  const toastId = `toast_${toastCounter}`;

  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  toastEl.id = toastId;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toastEl.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHTML(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Fechar notificação">✕</button>
  `;

  const closeBtn = toastEl.querySelector('.toast-close');
  const dismiss = () => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
    }, 200);
  };

  closeBtn.addEventListener('click', dismiss);

  const timer = setTimeout(dismiss, 3500);
  toastEl.addEventListener('mouseenter', () => clearTimeout(timer));

  container.appendChild(toastEl);
}

/* --------------------------------------------------------
   Gerenciamento Acessível de Modais
   -------------------------------------------------------- */
let lastFocusedElement = null;

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  lastFocusedElement = document.activeElement;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const focusable = modal.querySelectorAll('input:not([type="hidden"]), select, textarea, button:not([disabled])');
  if (focusable.length > 0) {
    focusable[0].focus();
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  document.body.style.overflow = '';

  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

// Handler global para fechar modais com tecla ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
    activeModals.forEach(m => closeModal(m.id));
  }
});

/* --------------------------------------------------------
   Gerador de Recibo Oficial do Evento
   -------------------------------------------------------- */
export function openReceiptModal(tx) {
  const settings = Storage.getSettings();
  const receiptModal = document.getElementById('modal-receipt');
  if (!receiptModal) return;

  const isIncome = tx.type === 'income';
  const receiptNumber = String(tx.id).replace(/\D/g, '').slice(-6) || '104829';
  const words = numberToCurrencyWords(tx.amount);

  document.getElementById('receipt-fair-name').textContent = settings.fairName || 'Feira do Bairro';
  document.getElementById('receipt-fair-edition').textContent = settings.edition || 'Edição 2026';
  document.getElementById('receipt-code').textContent = `#REC-${receiptNumber}`;
  document.getElementById('receipt-type-badge').textContent = isIncome ? 'COMPROVANTE DE ENTRADA / RECEBIMENTO' : 'COMPROVANTE DE PAGAMENTO / SAÍDA';
  document.getElementById('receipt-type-badge').className = `receipt-badge ${isIncome ? 'income' : 'expense'}`;
  document.getElementById('receipt-amount').textContent = formatBRL(tx.amount);
  document.getElementById('receipt-words').textContent = words;
  document.getElementById('receipt-description').textContent = tx.description;
  document.getElementById('receipt-category').textContent = tx.category;
  document.getElementById('receipt-payment').textContent = tx.paymentMethod || 'PIX';
  document.getElementById('receipt-person').textContent = tx.responsible || 'Organização / Feira';
  document.getElementById('receipt-date').textContent = formatDate(tx.date);
  document.getElementById('receipt-notes').textContent = tx.notes || 'Nenhuma observação informada.';
  document.getElementById('receipt-hash').textContent = `AUT-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  openModal('modal-receipt');
}
