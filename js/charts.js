/**
 * FeiraFinance — Pure HTML5 Canvas Charts Engine
 * Gráficos sem dependências externas (Canvas 2D Puro)
 * Suporte a Retina / High-DPI, Sparklines, Animações e Tooltips Interativos
 */

import { formatBRL, formatDate } from './ui.js';

// Paleta vibrante para categorias de Donut
const DONUT_COLORS = [
  '#7c3aed', '#10b981', '#f59e0b', '#ec4899', '#06b6d4',
  '#ff6b35', '#8b5cf6', '#14b8a6', '#f43f5e', '#3b82f6', '#eab308'
];

/**
 * Ajusta a resolução do canvas para telas High-DPI (Retina)
 */
function setupCanvasDPI(canvas) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(rect.width * dpr, 50);
  canvas.height = Math.max(rect.height * dpr, 30);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

/**
 * Controla o Tooltip flutuante global
 */
const tooltipEl = document.getElementById('chart-tooltip');

function showTooltip(x, y, title, lines) {
  if (!tooltipEl) return;
  let rowsHtml = '';
  lines.forEach(line => {
    rowsHtml += `
      <div class="chart-tooltip-row">
        <span style="color: ${line.color || 'var(--text-secondary)'}">${line.label}:</span>
        <span class="chart-tooltip-val" style="color: ${line.color || 'var(--text-primary)'}">${line.val}</span>
      </div>
    `;
  });

  tooltipEl.innerHTML = `
    <div class="chart-tooltip-title">${title}</div>
    ${rowsHtml}
  `;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.classList.remove('hidden');
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.add('hidden');
  }
}

/* ========================================================
   SPARKLINES PARA OS CARDS DE KPI (CANVAS PURO)
   ======================================================== */
export function renderSparkline(canvasId, values, color = '#7c3aed') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const dpi = setupCanvasDPI(canvas);
  if (!dpi) return;
  const { ctx, width, height } = dpi;

  ctx.clearRect(0, 0, width, height);

  if (!values || values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;

  const padding = 2;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const pts = values.map((v, i) => ({
    x: padding + (i * chartW) / (values.length - 1),
    y: padding + chartH - ((v - min) / range) * chartH
  }));

  // Área translúcida com gradiente vertical
  const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (color.includes('10b981') || color.includes('green') || color.includes('income')) {
    fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
  } else if (color.includes('f43f5e') || color.includes('ef4444') || color.includes('expense')) {
    fillGrad.addColorStop(0, 'rgba(244, 63, 94, 0.35)');
    fillGrad.addColorStop(1, 'rgba(244, 63, 94, 0.0)');
  } else {
    fillGrad.addColorStop(0, 'rgba(124, 58, 237, 0.35)');
    fillGrad.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, height);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, height);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Linha
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ponto final com brilho
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ========================================================
   1. GRÁFICO DE LINHA: EVOLUÇÃO DO SALDO ACUMULADO
   ======================================================== */
let balancePoints = [];
let lineCanvasListenerAttached = false;

export function renderBalanceEvolutionChart(transactions) {
  const canvas = document.getElementById('chart-balance-evolution');
  if (!canvas) return;

  const dpi = setupCanvasDPI(canvas);
  if (!dpi) return;
  const { ctx, width, height } = dpi;

  ctx.clearRect(0, 0, width, height);

  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhum dado financeiro para exibir no período.', width / 2, height / 2);
    return;
  }

  const dailyMap = new Map();
  let cumulative = 0;

  sorted.forEach(tx => {
    const d = tx.date;
    const diff = tx.type === 'income' ? tx.amount : -tx.amount;
    cumulative += diff;
    dailyMap.set(d, {
      date: d,
      balance: cumulative,
      txCount: (dailyMap.get(d)?.txCount || 0) + 1
    });
  });

  const pointsData = Array.from(dailyMap.values());
  if (pointsData.length === 1) {
    pointsData.unshift({
      date: pointsData[0].date,
      balance: 0,
      txCount: 0
    });
  }

  const padding = { top: 25, right: 30, bottom: 40, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const balances = pointsData.map(p => p.balance);
  let minVal = Math.min(0, ...balances);
  let maxVal = Math.max(100, ...balances);
  const range = (maxVal - minVal) || 1;

  minVal -= range * 0.05;
  maxVal += range * 0.05;
  const adjRange = maxVal - minVal;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // 1. Grade e Eixo Y
  const gridSteps = 4;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = minVal + (adjRange * (gridSteps - i)) / gridSteps;
    const yPos = padding.top + (chartH * i) / gridSteps;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = textColor;
    let label = Math.abs(yVal) >= 1000 ? `R$ ${(yVal / 1000).toFixed(1)}k` : `R$ ${Math.round(yVal)}`;
    ctx.fillText(label, padding.left - 12, yPos);
  }

  // 2. Coordenadas
  balancePoints = pointsData.map((p, idx) => {
    const x = padding.left + (chartW * idx) / (pointsData.length - 1);
    const y = padding.top + chartH - ((p.balance - minVal) / adjRange) * chartH;
    return { ...p, x, y };
  });

  // 3. Gradiente de Preenchimento
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(124, 58, 237, 0.45)');
  gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.2)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  ctx.beginPath();
  ctx.moveTo(balancePoints[0].x, height - padding.bottom);
  balancePoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(balancePoints[balancePoints.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // 4. Linha do Saldo com Gradiente Multi-Cor
  const strokeGrad = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
  strokeGrad.addColorStop(0, '#7c3aed');
  strokeGrad.addColorStop(0.5, '#06b6d4');
  strokeGrad.addColorStop(1, '#10b981');

  ctx.beginPath();
  balancePoints.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 5. Pontos com halo
  balancePoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = isDark ? '#0b0f19' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // 6. Rótulos do Eixo X
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const labelStep = Math.max(1, Math.floor(balancePoints.length / 5));
  balancePoints.forEach((p, idx) => {
    if (idx % labelStep === 0 || idx === balancePoints.length - 1) {
      ctx.fillText(formatDate(p.date), p.x, height - padding.bottom + 10);
    }
  });

  // Tooltip
  if (!lineCanvasListenerAttached) {
    lineCanvasListenerAttached = true;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let closest = null;
      let minDist = 35;

      balancePoints.forEach(p => {
        const dist = Math.hypot(p.x - mouseX, p.y - mouseY);
        if (dist < minDist) {
          minDist = dist;
          closest = p;
        }
      });

      if (closest) {
        showTooltip(e.clientX, e.clientY, `Posição em ${formatDate(closest.date)}`, [
          { label: 'Saldo Acumulado', val: formatBRL(closest.balance), color: closest.balance >= 0 ? '#10b981' : '#ef4444' }
        ]);
      } else {
        hideTooltip();
      }
    });

    canvas.addEventListener('mouseleave', hideTooltip);
  }
}

/* ========================================================
   2. GRÁFICO DE BARRAS: RECEITAS VS DESPESAS POR MÊS
   ======================================================== */
let barItems = [];
let barCanvasListenerAttached = false;

export function renderMonthlyBarsChart(transactions) {
  const canvas = document.getElementById('chart-monthly-bars');
  if (!canvas) return;

  const dpi = setupCanvasDPI(canvas);
  if (!dpi) return;
  const { ctx, width, height } = dpi;

  ctx.clearRect(0, 0, width, height);

  if (transactions.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem lançamentos para gerar o comparativo mensal.', width / 2, height / 2);
    return;
  }

  const monthlyData = new Map();

  transactions.forEach(tx => {
    const monthKey = tx.date.substring(0, 7);
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { monthKey, income: 0, expense: 0 });
    }
    const curr = monthlyData.get(monthKey);
    if (tx.type === 'income') curr.income += tx.amount;
    else curr.expense += tx.amount;
  });

  const sortedMonths = Array.from(monthlyData.keys()).sort();
  const dataList = sortedMonths.map(k => monthlyData.get(k));

  const padding = { top: 25, right: 25, bottom: 40, left: 70 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  let maxVal = 100;
  dataList.forEach(d => {
    if (d.income > maxVal) maxVal = d.income;
    if (d.expense > maxVal) maxVal = d.expense;
  });
  maxVal *= 1.15;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const gridSteps = 4;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = (maxVal * (gridSteps - i)) / gridSteps;
    const yPos = padding.top + (chartH * i) / gridSteps;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = textColor;
    ctx.fillText(`R$ ${(yVal / 1000).toFixed(1)}k`, padding.left - 12, yPos);
  }

  const groupWidth = chartW / dataList.length;
  const barWidth = Math.min(32, (groupWidth - 24) / 2);
  barItems = [];

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  dataList.forEach((d, idx) => {
    const groupCenterX = padding.left + (idx * groupWidth) + (groupWidth / 2);
    
    const incomeH = (d.income / maxVal) * chartH;
    const expenseH = (d.expense / maxVal) * chartH;

    const incomeX = groupCenterX - barWidth - 4;
    const incomeY = padding.top + chartH - incomeH;

    const expenseX = groupCenterX + 4;
    const expenseY = padding.top + chartH - expenseH;

    const incGrad = ctx.createLinearGradient(0, incomeY, 0, incomeY + incomeH);
    incGrad.addColorStop(0, '#34d399');
    incGrad.addColorStop(1, '#059669');
    ctx.fillStyle = incGrad;
    drawRoundedTopBar(ctx, incomeX, incomeY, barWidth, incomeH, 6);

    const expGrad = ctx.createLinearGradient(0, expenseY, 0, expenseY + expenseH);
    expGrad.addColorStop(0, '#fb7185');
    expGrad.addColorStop(1, '#e11d48');
    ctx.fillStyle = expGrad;
    drawRoundedTopBar(ctx, expenseX, expenseY, barWidth, expenseH, 6);

    const [yStr, mStr] = d.monthKey.split('-');
    const mName = monthNames[parseInt(mStr, 10) - 1] || mStr;
    const label = `${mName}/${yStr.substring(2)}`;

    barItems.push({
      rect: { x: incomeX, y: incomeY, w: barWidth, h: incomeH },
      data: d,
      monthLabel: `${mName} de ${yStr}`,
      type: 'income'
    });
    barItems.push({
      rect: { x: expenseX, y: expenseY, w: barWidth, h: expenseH },
      data: d,
      monthLabel: `${mName} de ${yStr}`,
      type: 'expense'
    });

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, groupCenterX, height - padding.bottom + 10);
  });

  if (!barCanvasListenerAttached) {
    barCanvasListenerAttached = true;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      let hovered = null;
      for (const item of barItems) {
        if (
          mouseX >= item.rect.x &&
          mouseX <= item.rect.x + item.rect.w &&
          mouseY >= item.rect.y &&
          mouseY <= item.rect.y + item.rect.h
        ) {
          hovered = item;
          break;
        }
      }

      if (hovered) {
        const net = hovered.data.income - hovered.data.expense;
        showTooltip(e.clientX, e.clientY, hovered.monthLabel, [
          { label: 'Receitas', val: formatBRL(hovered.data.income), color: '#10b981' },
          { label: 'Despesas', val: formatBRL(hovered.data.expense), color: '#ef4444' },
          { label: 'Resultado', val: formatBRL(net), color: net >= 0 ? '#10b981' : '#ef4444' }
        ]);
      } else {
        hideTooltip();
      }
    });

    canvas.addEventListener('mouseleave', hideTooltip);
  }
}

function drawRoundedTopBar(ctx, x, y, width, height, radius) {
  if (height <= 0) return;
  const r = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();
}

/* ========================================================
   3. GRÁFICO DE DONUT: DISTRIBUIÇÃO POR CATEGORIA
   ======================================================== */
let donutSlices = [];
let donutCanvasListenerAttached = false;

export function renderCategoryDonutChart(transactions, type = 'expense') {
  const canvas = document.getElementById('chart-category-donut');
  const legendEl = document.getElementById('chart-donut-legend');
  if (!canvas) return;

  const dpi = setupCanvasDPI(canvas);
  if (!dpi) return;
  const { ctx, width, height } = dpi;

  ctx.clearRect(0, 0, width, height);

  const filtered = transactions.filter(t => t.type === type);
  
  if (filtered.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Nenhum lançamento de ${type === 'income' ? 'receita' : 'despesa'}.`, width / 2, height / 2);
    if (legendEl) legendEl.innerHTML = '';
    return;
  }

  const catMap = new Map();
  let totalAmount = 0;

  filtered.forEach(tx => {
    const cat = tx.category || 'Outros';
    catMap.set(cat, (catMap.get(cat) || 0) + tx.amount);
    totalAmount += tx.amount;
  });

  const sortedCategories = Array.from(catMap.entries())
    .map(([cat, amt]) => ({ category: cat, amount: amt, percent: (amt / totalAmount) * 100 }))
    .sort((a, b) => b.amount - a.amount);

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(centerX, centerY) * 0.85;
  const innerRadius = outerRadius * 0.62;

  let startAngle = -Math.PI / 2;
  donutSlices = [];

  sortedCategories.forEach((item, idx) => {
    const sliceAngle = (item.amount / totalAmount) * (Math.PI * 2);
    const endAngle = startAngle + sliceAngle;
    const color = DONUT_COLORS[idx % DONUT_COLORS.length];

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    donutSlices.push({
      ...item,
      startAngle,
      endAngle,
      color,
      centerX,
      centerY,
      innerRadius,
      outerRadius
    });

    startAngle = endAngle;
  });

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('TOTAL', centerX, centerY - 10);

  ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
  ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  ctx.fillText(formatBRL(totalAmount), centerX, centerY + 8);

  if (legendEl) {
    legendEl.innerHTML = sortedCategories.map(item => `
      <div class="donut-legend-item">
        <div class="donut-legend-left">
          <span class="donut-legend-dot" style="background-color: ${DONUT_COLORS[sortedCategories.indexOf(item) % DONUT_COLORS.length]}"></span>
          <span>${item.category}</span>
        </div>
        <div class="donut-legend-val">
          <span>${item.percent.toFixed(1)}%</span>
        </div>
      </div>
    `).join('');
  }

  if (!donutCanvasListenerAttached) {
    donutCanvasListenerAttached = true;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const dx = mouseX - (rect.width / 2);
      const dy = mouseY - (rect.height / 2);
      const dist = Math.hypot(dx, dy);

      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;

      let hovered = null;
      for (const slice of donutSlices) {
        if (dist >= slice.innerRadius && dist <= slice.outerRadius) {
          if (angle >= slice.startAngle && angle <= slice.endAngle) {
            hovered = slice;
            break;
          }
        }
      }

      if (hovered) {
        showTooltip(e.clientX, e.clientY, hovered.category, [
          { label: 'Valor', val: formatBRL(hovered.amount), color: hovered.color },
          { label: 'Participação', val: `${hovered.percent.toFixed(1)}%`, color: 'var(--text-primary)' }
        ]);
      } else {
        hideTooltip();
      }
    });

    canvas.addEventListener('mouseleave', hideTooltip);
  }
}
