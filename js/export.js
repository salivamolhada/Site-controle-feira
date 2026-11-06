/**
 * FeiraFinance — Data Export & Printable Balanço Engine
 * Exportação em CSV com delimitador ';' e BOM UTF-8 (compatível com Excel), JSON e Impressão de Auditoria
 */

import { Storage } from './storage.js';
import { formatDate, formatBRL } from './ui.js';

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function exportTransactionsToCSV() {
  const transactions = Storage.getTransactions();
  const settings = Storage.getSettings();

  const headers = [
    'ID',
    'Tipo',
    'Data',
    'Descrição',
    'Categoria',
    'Forma de Pagamento',
    'Responsável',
    'Valor (R$)',
    'Observações'
  ];

  const rows = transactions.map(tx => [
    escapeCsvValue(tx.id),
    escapeCsvValue(tx.type === 'income' ? 'Recebimento' : 'Pagamento'),
    escapeCsvValue(formatDate(tx.date)),
    escapeCsvValue(tx.description),
    escapeCsvValue(tx.category),
    escapeCsvValue(tx.paymentMethod || ''),
    escapeCsvValue(tx.responsible || ''),
    escapeCsvValue(Number(tx.amount).toFixed(2).replace('.', ',')),
    escapeCsvValue(tx.notes || '')
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blobContent = '\uFEFF' + csvContent;
  const fileName = `FeiraFinance_Lancamentos_${(settings.fairName || 'Feira').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

  downloadFile(blobContent, fileName, 'text/csv;charset=utf-8;');
}

export function exportBoothsToCSV() {
  const booths = Storage.getBooths();
  const settings = Storage.getSettings();

  const headers = ['Estande', 'Expositor', 'Setor', 'Valor Locação (R$)', 'Valor Pago (R$)', 'Status', 'Contato', 'Observações'];
  const rows = booths.map(b => [
    escapeCsvValue(b.number),
    escapeCsvValue(b.exhibitor),
    escapeCsvValue(b.sector),
    escapeCsvValue(Number(b.price).toFixed(2).replace('.', ',')),
    escapeCsvValue(Number(b.paidAmount).toFixed(2).replace('.', ',')),
    escapeCsvValue(b.status === 'paid' ? 'Quitado' : b.status === 'partial' ? 'Parcial' : 'Pendente'),
    escapeCsvValue(b.contact || ''),
    escapeCsvValue(b.notes || '')
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const fileName = `FeiraFinance_Estandes_${(settings.fairName || 'Feira').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;

  downloadFile(blobContentCsv(csvContent), fileName, 'text/csv;charset=utf-8;');
}

function blobContentCsv(str) {
  return str;
}

export function exportDataToJSON() {
  const transactions = Storage.getTransactions();
  const booths = Storage.getBooths();
  const settings = Storage.getSettings();
  const categories = Storage.getCategories();

  const exportPayload = {
    exportDate: new Date().toISOString(),
    system: 'FeiraFinance Pro v2.0',
    settings,
    categories,
    transactionsCount: transactions.length,
    boothsCount: booths.length,
    transactions,
    booths
  };

  const jsonContent = JSON.stringify(exportPayload, null, 2);
  const fileName = `FeiraFinance_BackupCompleto_${(settings.fairName || 'Feira').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;

  downloadFile(jsonContent, fileName, 'application/json;charset=utf-8;');
}

export function exportCategoriesSummaryCSV() {
  const transactions = Storage.getTransactions();
  const catMap = new Map();

  transactions.forEach(tx => {
    const key = `${tx.type}_${tx.category}`;
    if (!catMap.has(key)) {
      catMap.set(key, { type: tx.type, category: tx.category, count: 0, total: 0 });
    }
    const item = catMap.get(key);
    item.count++;
    item.total += tx.amount;
  });

  const headers = ['Tipo', 'Categoria', 'Quantidade de Lançamentos', 'Total Acumulado (R$)'];
  const rows = Array.from(catMap.values()).map(item => [
    escapeCsvValue(item.type === 'income' ? 'Receita' : 'Despesa'),
    escapeCsvValue(item.category),
    escapeCsvValue(item.count),
    escapeCsvValue(item.total.toFixed(2).replace('.', ','))
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  downloadFile(csvContent, `Resumo_Categorias_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Dispara a impressão do Balanço Consolidado do Evento
 */
export function printFinancialReport() {
  window.print();
}
