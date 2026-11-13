// Story charts for The Horniness Index ("The evidence" view, Overview teaser, case annotations).
// Plain SVG strings sized to their container; hover text goes in data-tip (bound by hi.js).
// Colours validated with the dataviz palette checker against the dark panel #101b27 (all checks pass):
//   company #b7892a vs S&P 500 #4a8fd6; diverging down #d4634c / up #2b98b0 around neutral #566572.
// Every coloured mark also carries a sign, label or logo, so colour is never the only cue.
import { svgIcon } from './icons.js';

export const C = { co: '#b7892a', bm: '#4a8fd6', neg: '#d4634c', pos: '#2b98b0', mid: '#566572', grid: '#2a3540', tick: '#8b9da9', label: '#d6dbdc', muted: '#8b9da9', faint: '#3b4955', panel: '#101b27' };
export const BRANDS = { NESN: ['nestle.svg', '#807363'], KSS: ['kohls.png', '#8d184b'], WWE: ['wwe.svg', '#d91c2d'], NSC: ['norfolk-southern.svg', '#7f9cab'], BP: [null, '#7bac54'], CBOE: ['cboe.svg', '#00a7d8'], MCD: ['mcdonalds.svg', '#e9b531'], CBS: ['cbs.svg', '#7089b3'], WYNN: ['wynn.png', '#ad8b5e'], INTC: ['intel.svg', '#0071c5'], LULU: ['lululemon.svg', '#c52a3b'], BBY: ['bestbuy.png', '#e8c548'], HPQ: ['hp.svg', '#0096d6'], AAPL: ['apple.svg', '#a3b2c1'], MSFT: [null, '#76b9ba'], SBUX: ['starbucks.svg', '#00754a'] };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const minus = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
export const pct = (v, d = 1, unit = '%') => (v == null || !Number.isFinite(v) ? '—' : minus(v, d) + unit);
const tipAttr = (html) => `data-tip="${esc(html)}"`;
const txt = (x, y, s, { size = 11, fill = C.tick, anchor = 'start', weight = 400, extra = '' } = {}) => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${esc(s)}</text>`;
const svg = (W, H, label, body) => `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" font-family="Arial,Helvetica,sans-serif">${body}</svg>`;

// Company mark inside a chart: cream tile with the logo, or the dashboard's text identifier.
export function svgLogo(ticker, x, y, s = 20) {
  const [file, accent] = BRANDS[(ticker || '').toUpperCase()] ?? [null, '#c7ad76'];
  const r = Math.max(4, Math.round(s * 0.2)), pad = Math.max(2, Math.round(s * 0.12));
  if (file) return `<g><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" fill="#f4f1e8"/><image href="brands/${file}" x="${x + pad}" y="${y + pad}" width="${s - 2 * pad}" height="${s - 2 * pad}" preserveAspectRatio="xMidYMid meet"${ticker === 'NSC' ? ' style="filter:brightness(0)"' : ''}/></g>`;
  return `<g><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" fill="#18232d" stroke="${accent}66"/>${txt(x + s / 2, y + s * 0.66, ticker === 'BP' ? 'bp' : ticker.slice(0, 4), { size: Math.round(s * 0.42), fill: accent, anchor: 'middle', weight: 700 })}</g>`;
}
const niceStep = (span, target = 5) => { const raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; };
const ticksFor = (lo, hi, target) => { const st = niceStep(hi - lo, target), out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(10)); return out; };

// 1. Every case's path relative to the S&P 500 over the first 20 sessions, median emphasised.
function spaghetti({ rows, median, sessions = 20 }, W, H) {
  const padL = 46, padR = 118, padT = 12, padB = 30;
  const all = rows.flatMap((r) => r.points.map((p) => p.v)).concat(median.map((p) => p.v), [0]);
  let lo = Math.min(...all), hi = Math.max(...all); const sp = hi - lo || 4; lo -= sp * 0.06; hi += sp * 0.06;
  const x = (s) => padL + (s / sessions) * (W - padL - padR), y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  let g = '';
  for (const t of ticksFor(lo, hi, 5)) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(padL - 8, y(t) + 4, pct(t, 0, ' pp'), { anchor: 'end' })}`;
  g += `<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" stroke="#74828c" stroke-dasharray="3 4"/>`;
  for (const s of [0, 5, 10, 15, 20]) g += txt(x(s), H - 10, s === 0 ? (W < 520 ? '0' : 'Prior close') : (W < 520 ? '' : 'Day ') + s, { anchor: s === 0 ? 'start' : 'middle' });
  if (W < 520) g += txt(W - padR, H - 10, 'sessions', { anchor: 'start', fill: C.muted, size: 10 });
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.s).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  for (const r of rows) {
    const last = r.points[r.points.length - 1];
    g += `<g class="hi-sp" tabindex="0" ${tipAttr(`<strong>${esc(r.company)}</strong><p>Day 1 ${pct(r.points.find((p) => p.s === 1)?.v, 1, ' pp')} · Day ${last.s} ${pct(last.v, 1, ' pp')} vs S&amp;P 500</p>`)}><path d="${path(r.points)}" fill="none" stroke="transparent" stroke-width="10"/><path class="hi-sp-line" d="${path(r.points)}" fill="none" stroke="${C.faint}" stroke-width="1.5"/></g>`;
  }
  g += `<path d="${path(median)}" fill="none" stroke="${C.co}" stroke-width="3" stroke-linecap="round"/>`;
  // selective end labels: median, best, worst (nudged apart)
  const ends = rows.map((r) => ({ r, v: r.points[r.points.length - 1].v })).sort((a, b) => a.v - b.v);
  const lab = [{ y: y(median[median.length - 1].v), html: (yy) => `${txt(W - padR + 8, yy + 4, 'Median ' + pct(median[median.length - 1].v, 1, ' pp'), { fill: C.label, weight: 700 })}` }];
  for (const e of [ends[0], ends[ends.length - 1]]) lab.push({ y: y(e.v), html: (yy) => `${svgLogo(e.r.ticker, W - padR + 8, yy - 9, 18)}${txt(W - padR + 31, yy + 4, pct(e.v, 1, ' pp'), { fill: C.label })}` });
  lab.sort((a, b) => a.y - b.y); for (let i = 1; i < lab.length; i++) lab[i].y = Math.max(lab[i].y, lab[i - 1].y + 22);
  g += lab.map((l) => l.html(l.y)).join('');
  return svg(W, H, 'Each company’s cumulative return minus the S&P 500 over the first 20 trading sessions after disclosure; the gold line is the median', g);
}

// 2. Ranked diverging bars (one per company) with logos.
function rankBars({ rows, unit = ' pp', label, note }, W, H) {
  const narrow = W < 520, rowH = (H - 30) / rows.length, labW = narrow ? 34 : 190, padR = 56, padT = 6;
  const vals = rows.map((r) => r.v).filter((v) => v != null), lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1, x0 = labW + 8 + ((0 - lo) / span) * (W - labW - 8 - padR - 46) + 46 * (lo < 0 ? 1 : 0);
  const x = (v) => x0 + (v / span) * (W - labW - 8 - padR - 46);
  let g = '';
  for (const t of ticksFor(lo, hi, narrow ? 3 : 6)) g += `<line x1="${x(t)}" x2="${x(t)}" y1="${padT}" y2="${H - 24}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(x(t), H - 8, pct(t, 0, unit.trim() === 'pp' ? '' : '%'), { anchor: 'middle' })}`;
  g += `<line x1="${x0}" x2="${x0}" y1="${padT}" y2="${H - 24}" stroke="#74828c"/>`;
  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2, bh = Math.min(16, rowH - 8);
    g += svgLogo(r.ticker, 0, cy - 10, 20);
    if (!narrow) g += txt(28, cy + 4, r.company.length > 26 ? r.company.slice(0, 25) + '…' : r.company, { fill: C.label, size: 12 });
    if (r.v == null) { g += txt(x0 + 6, cy + 4, '— unavailable', { fill: C.muted }); return; }
    const xe = x(r.v), left = Math.min(x0, xe), w = Math.max(2, Math.abs(xe - x0)), col = r.v < 0 ? C.neg : C.pos;
    // rounded only at the data end
    const d = r.v < 0 ? `M${x0},${cy - bh / 2} H${left + 4} q-4,0 -4,4 V${cy + bh / 2 - 4} q0,4 4,4 H${x0} Z` : `M${x0},${cy - bh / 2} H${left + w - 4} q4,0 4,4 V${cy + bh / 2 - 4} q0,4 -4,4 H${x0} Z`;
    g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(r.company)}</strong><p>${esc(label)}: ${pct(r.v, 1, unit)}</p>${r.sub ? `<p>${esc(r.sub)}</p>` : ''}`)}><rect x="${labW}" y="${cy - rowH / 2}" width="${W - labW}" height="${rowH}" fill="transparent"/><path d="${w <= 6 ? `M${left},${cy - bh / 2} h${w} v${bh} h-${w} Z` : d}" fill="${col}"/></g>`;
    g += txt(r.v < 0 ? xe - 6 : xe + 6, cy + 4, pct(r.v, 1, unit), { fill: C.label, anchor: r.v < 0 ? 'end' : 'start', size: 11.5, weight: 700 });
  });
  return svg(W, H, label + (note ? ' — ' + note : ''), g);
}

// 3. How deep the fall, how long to get back: logo markers.
function recovery({ points, horizon = 252 }, W, H) {
  const padL = 52, padR = 20, padT = 16, padB = 40, gapX = 64; // right band = not recovered
  const plotR = W - padR - gapX, lo = Math.min(-5, ...points.map((p) => p.dd)) * 1.08;
  const x = (s) => padL + (s / horizon) * (plotR - padL - 10), y = (v) => padT + (H - padT - padB) * (v / lo);
  let g = '';
  for (const t of ticksFor(lo, 0, 5)) g += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(padL - 8, y(t) + 4, pct(t, 0), { anchor: 'end' })}`;
  for (const s of (W < 520 ? [0, 63, 126, 252] : [0, 21, 63, 126, 252])) g += txt(x(s), H - 22, s === 0 ? '0' : s === 21 ? '1 mo' : s === 63 ? '3 mo' : s === 126 ? '6 mo' : '1 yr', { anchor: 'middle' });
  g += txt((padL + plotR) / 2, H - 6, 'Trading days to recover the pre-disclosure close', { anchor: 'middle', fill: C.muted, size: 10 });
  g += `<rect x="${plotR + 6}" y="${padT}" width="${gapX - 6}" height="${H - padT - padB}" rx="6" fill="#d4634c14" stroke="#d4634c40"/>`;
  g += txt(plotR + 6 + (gapX - 6) / 2, H - 22, 'Not within', { anchor: 'middle', fill: C.neg, size: 10 }) + txt(plotR + 6 + (gapX - 6) / 2, H - 10, '1 year', { anchor: 'middle', fill: C.neg, size: 10 });
  const placed = [];
  for (const p of points.slice().sort((a, b) => a.dd - b.dd)) {
    let px = p.recovered ? x(p.rec ?? 0) : plotR + 6 + (gapX - 6) / 2, py = y(p.dd);
    for (let k = 0; k < 8 && placed.some((q) => Math.abs(q.x - px) < 22 && Math.abs(q.y - py) < 22); k++) px += p.recovered ? 22 : 0, py += p.recovered ? 0 : 22;
    placed.push({ x: px, y: py });
    g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(p.company)}</strong><p>Deepest fall ${pct(p.dd)} within a year</p><p>${p.rec === 0 ? 'Never closed below the pre-disclosure price' : p.recovered ? 'Back to the pre-disclosure close after ' + p.rec + ' trading days' : 'Not back to the pre-disclosure close within the year'}</p>`)}>${svgLogo(p.ticker, px - 11, py - 11, 22)}</g>`;
  }
  return svg(W, H, 'Maximum drawdown within a year against trading days needed to regain the pre-disclosure close', g);
}

// 4. How long each saga ran: first to last dated event.
const TYPE_ICON = { departure: 'LogOut', finding: 'FileSearch', settlement: 'Gavel', fine: 'Landmark', recovery: 'Coins', announcement: 'Megaphone' };
export const typeIcon = (t) => TYPE_ICON[t] ?? 'Megaphone';
function saga({ rows }, W, H) {
  const narrow = W < 520, labW = narrow ? 30 : 180, padR = 74, padT = 22, rowH = (H - padT - 26) / rows.length;
  const maxM = Math.max(6, ...rows.map((r) => r.months)), top = Math.ceil(maxM / 12) * 12;
  const x = (m) => labW + 10 + (m / top) * (W - labW - 10 - padR);
  let g = '';
  for (let m = 0; m <= top; m += top > 24 ? 12 : 6) g += `<line x1="${x(m)}" x2="${x(m)}" y1="${padT - 6}" y2="${H - 22}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(x(m), H - 6, m === 0 ? (narrow ? '0' : 'First event') : m % 12 === 0 ? m / 12 + (m === 12 ? ' year' : ' years') : m + ' mo', { anchor: m === 0 ? 'start' : 'middle' })}`;
  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2;
    g += svgLogo(r.ticker, 0, cy - 10, 20);
    if (!narrow) g += txt(28, cy + 4, r.company.length > 22 ? r.company.slice(0, 21) + '…' : r.company, { fill: C.label, size: 12 });
    if (r.months > 0) g += `<line x1="${x(0)}" x2="${x(r.months)}" y1="${cy}" y2="${cy}" stroke="${C.co}" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
    for (const e of r.events) {
      const ex = x(e.m);
      g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(e.dateLabel)}</strong><p>${esc(r.company)}: ${esc(e.title)}</p>`)}><circle cx="${ex}" cy="${cy}" r="12" fill="${C.panel}" stroke="${C.co}" stroke-width="1.5"/>${svgIcon(typeIcon(e.type), ex - 8, cy - 8, 16, '#e3c47e')}</g>`;
    }
    g += txt(x(r.months) + 18, cy + 4, r.span, { fill: C.label, size: 11, weight: 700 });
  });
  return svg(W, H, 'Time from first to last dated public event in each case', g);
}

// 5. Every disclosed amount on one log scale, grouped by kind. Never summed; currency kept.
function ledger({ groups }, W, H) {
  const narrow = W < 520, labW = narrow ? 30 : 190, padR = 120, padT = 8;
  const lo = 1e5, hi = 1e9, x = (v) => labW + 10 + ((Math.log10(v) - 5) / 4) * (W - labW - 10 - padR);
  const rowsN = groups.reduce((n, g) => n + g.rows.length + 1, 0), rowH = (H - padT - 26) / rowsN;
  let g = '', i = 0;
  for (const [v, l] of [[1e5, '100K'], [1e6, '1M'], [1e7, '10M'], [1e8, '100M'], [1e9, '1B']]) g += `<line x1="${x(v)}" x2="${x(v)}" y1="${padT}" y2="${H - 22}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(x(v), H - 6, l, { anchor: 'middle' })}`;
  for (const grp of groups) {
    const gy = padT + i * rowH + rowH * 0.7; i++;
    g += txt(0, gy, grp.kind.toUpperCase(), { fill: '#d6b779', size: 9.5, weight: 700, extra: 'letter-spacing="1.2"' });
    for (const r of grp.rows) {
      const cy = padT + i * rowH + rowH / 2; i++;
      g += svgLogo(r.ticker, 0, cy - 9, 18);
      if (!narrow) g += txt(26, cy + 4, r.company.length > 24 ? r.company.slice(0, 23) + '…' : r.company, { fill: C.label, size: 11.5 });
      const cx = x(Math.min(hi, Math.max(lo, r.amount))), usd = r.currency === 'USD';
      g += `<line x1="${x(lo)}" x2="${cx}" y1="${cy}" y2="${cy}" stroke="${C.faint}" stroke-width="1"/>`;
      g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(r.company)} · ${esc(grp.kind)}</strong><p>${esc(r.display)} (${esc(r.currency)})</p><p>${esc(r.label)}</p>`)}><rect x="${labW}" y="${cy - rowH / 2}" width="${W - labW}" height="${rowH}" fill="transparent"/><circle cx="${cx}" cy="${cy}" r="6.5" fill="${usd ? C.co : C.panel}" stroke="${C.co}" stroke-width="2"/></g>`;
      g += txt(cx + 12, cy + 4, r.display + (usd ? '' : ' ' + r.currency), { fill: C.label, size: 11.5, weight: 700 });
    }
  }
  return svg(W, H, 'Disclosed recoveries, fines, forfeitures and penalties on a logarithmic scale, each in its disclosed currency', g);
}

// 6. Net margin in the fiscal year before vs the year containing the event (dumbbell).
function dumbbell({ rows }, W, H) {
  const narrow = W < 520, labW = narrow ? 30 : 180, padR = 70, padT = 6, rowH = (H - padT - 26) / rows.length;
  const vals = rows.flatMap((r) => [r.before, r.after]), lo = Math.min(0, ...vals) - 2, hi = Math.max(...vals) + 2;
  const x = (v) => labW + 10 + ((v - lo) / (hi - lo)) * (W - labW - 10 - padR);
  let g = '';
  for (const t of ticksFor(lo, hi, narrow ? 3 : 6)) g += `<line x1="${x(t)}" x2="${x(t)}" y1="${padT}" y2="${H - 22}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(x(t), H - 6, t + '%', { anchor: 'middle' })}`;
  if (lo < 0) g += `<line x1="${x(0)}" x2="${x(0)}" y1="${padT}" y2="${H - 22}" stroke="#74828c"/>`;
  rows.forEach((r, i) => {
    const cy = padT + i * rowH + rowH / 2, d = r.after - r.before, col = d < 0 ? C.neg : C.pos;
    g += svgLogo(r.ticker, 0, cy - 10, 20);
    if (!narrow) g += txt(28, cy + 4, r.company.length > 22 ? r.company.slice(0, 21) + '…' : r.company, { fill: C.label, size: 12 });
    g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(r.company)}</strong><p>Net margin ${r.before.toFixed(1)}% (FY ${esc(r.beforeLabel)}) → ${r.after.toFixed(1)}% (FY ${esc(r.afterLabel)})</p><p>Revenue ${pct(r.rev, 1)} year on year · ${esc(r.currency)}</p>`)}><rect x="${labW}" y="${cy - rowH / 2}" width="${W - labW}" height="${rowH}" fill="transparent"/>
      <line x1="${x(r.before)}" x2="${x(r.after)}" y1="${cy}" y2="${cy}" stroke="${col}" stroke-width="3"/><circle cx="${x(r.before)}" cy="${cy}" r="5" fill="${C.panel}" stroke="#9aa7b2" stroke-width="2"/><circle cx="${x(r.after)}" cy="${cy}" r="6" fill="${col}"/></g>`;
    g += txt(x(Math.max(r.before, r.after)) + 12, cy + 4, pct(d, 1, ' pts'), { fill: C.label, size: 11, weight: 700 });
  });
  return svg(W, H, 'Net margin in the fiscal year before the event and in the fiscal year containing it', g);
}

// 7. This casebook's 3-session reactions against published research means.
function strip({ points, refs, median }, W, H) {
  const padL = 24, padR = 24, axisY = H - 34;
  const vals = points.map((p) => p.v).concat(refs.map((r) => r.v), [0]); const lo = Math.min(...vals) - 1.5, hi = Math.max(...vals) + 1.5;
  const x = (v) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  let g = '';
  for (const t of ticksFor(lo, hi, W < 520 ? 4 : 8)) g += `<line x1="${x(t)}" x2="${x(t)}" y1="10" y2="${axisY}" stroke="${C.grid}" stroke-dasharray="2 6"/>${txt(x(t), axisY + 16, pct(t, 0), { anchor: 'middle' })}`;
  g += `<line x1="${x(0)}" x2="${x(0)}" y1="10" y2="${axisY}" stroke="#74828c"/>`;
  // research reference lines, labels stacked to avoid overlap
  refs.forEach((r, i) => { const rx = x(r.v); g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(r.label)}</strong><p>${esc(r.source)}</p>`)}><line x1="${rx}" x2="${rx}" y1="${18 + i * 16}" y2="${axisY}" stroke="${C.bm}" stroke-width="2" stroke-dasharray="5 4"/>${txt(rx + (i % 2 ? -6 : 6), 28 + i * 16, r.short + ' ' + pct(r.v, 2), { fill: C.bm, size: 10.5, weight: 700, anchor: i % 2 ? 'end' : 'start' })}</g>`; });
  const placed = [];
  for (const p of points.slice().sort((a, b) => a.v - b.v)) {
    const px = x(p.v); let py = axisY - 26;
    while (placed.some((q) => Math.abs(q.x - px) < 22 && Math.abs(q.y - py) < 22)) py -= 22;
    placed.push({ x: px, y: py });
    g += `<g class="hi-hit" tabindex="0" ${tipAttr(`<strong>${esc(p.company)}</strong><p>3-session market-adjusted return ${pct(p.v, 1, ' pp')}</p>`)}>${svgLogo(p.ticker, px - 10, py - 10, 20)}</g>`;
  }
  const mx = x(median); g += `<path d="M${mx},${axisY - 6} l7,7 l-7,7 l-7,-7 Z" fill="${C.co}"/>${txt(mx, axisY + 30, 'Casebook median ' + pct(median, 1, ' pp'), { fill: C.co, anchor: 'middle', size: 11, weight: 700 })}`;
  return svg(W, H, 'This casebook’s 3-session market-adjusted returns compared with published study means', g);
}

export const KINDS = { spaghetti, rankBars, recovery, saga, ledger, dumbbell, strip };
