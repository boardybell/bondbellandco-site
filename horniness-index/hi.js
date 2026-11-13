// The Horniness Index on bondbellandco.com: a static mirror of the hosted ChatGPT dashboard
// (horniness-index.null-value.chatgpt.site). Markup and class names follow its components
// (public-intelligence.tsx, valuation-impact.tsx, dashboard.tsx) so dash.css (its globals.css) styles it.
// Data: data.js (cases + official publications, snapshot of the public read API, scripts/horniness/snapshot.mjs)
// and prices.js (daily closes from free sources, scripts/horniness/prices.mjs). No runtime third-party requests.
import { analyzeCaseValuation } from './case-valuation.js';
import { icon } from './icons.js';

const D = window.HI_DATA;
const LIVE = D.links?.dashboard ?? 'https://horniness-index.null-value.chatgpt.site/';
const root = document.getElementById('hi-root');
const heading = document.getElementById('hi-heading');
const crumb = document.getElementById('hi-crumb');

// ── formatting (same rules as the dashboard) ─────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const https = (u) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);
const date = (v) => (v ? new Date(v.length === 10 ? v + 'T12:00:00Z' : v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(v.length === 10 ? { timeZone: 'UTC' } : {}) }) : 'Date unavailable');
const formatDate = (v) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(v.length === 10 ? v + 'T12:00:00Z' : v));
const money = (amount, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: amount >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(amount);
const moneyC = (v, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(v);
const factMoney = (f) => (f.amountQualifier === 'more-than' ? '> ' : f.amountQualifier === 'up-to' || f.qualifier === 'maximum-potential' ? 'Up to ' : f.amountQualifier === 'approximately' ? '≈ ' : f.qualifier === 'agreed' ? 'Agreed ' : f.qualifier === 'required' ? 'Required ' : '') + money(f.amount, f.currency);
const signed = (v, suffix = '%') => (v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}${suffix}`);
const tone = (v) => (v == null || v === 0 ? '' : v < 0 ? 'negative' : 'positive');
const change = (from, to) => (to / from - 1) * 100;
const statusClass = (s) => (s === 'Resolved' ? 'resolved' : s === 'Investigation' || s === 'Disputed' ? 'pending' : 'documented');
const ext = (url, label, cls = 'source-link') => { const u = https(url); return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}${icon('ExternalLink', 12)}</a>` : `<span class="${cls}">${label}</span>`; };

// ── company marks (dashboard's CompanyBrand, local files) ─────
const BRANDS = { NESN: ['nestle.svg', '#807363'], KSS: ['kohls.png', '#8d184b'], WWE: ['wwe.svg', '#d91c2d'], NSC: ['norfolk-southern.svg', '#7f9cab'], BP: [null, '#7bac54'], CBOE: ['cboe.svg', '#00a7d8'], MCD: ['mcdonalds.svg', '#e9b531'], CBS: ['cbs.svg', '#7089b3'], WYNN: ['wynn.png', '#ad8b5e'], INTC: ['intel.svg', '#0071c5'], LULU: ['lululemon.svg', '#c52a3b'], BBY: ['bestbuy.png', '#e8c548'], HPQ: ['hp.svg', '#0096d6'], AAPL: ['apple.svg', '#a3b2c1'], MSFT: [null, '#76b9ba'], SBUX: ['starbucks.svg', '#00754a'] };
function brand(ticker = '', name = '', size = 40) {
  const t = ticker.toUpperCase(), [file, accent] = BRANDS[t] ?? [null, '#c7ad76'];
  const box = `width:${size}px;height:${size}px;min-width:${size}px;display:inline-flex;align-items:center;justify-content:center;border-radius:${Math.max(7, Math.round(size * 0.19))}px;overflow:hidden;flex-shrink:0;box-shadow:0 2px 7px #00000015;`;
  if (file) return `<span class="company-brand has-logo" title="${esc(name)}" style="${box}background:#f4f1e8;border:1px solid #ffffff24;padding:${Math.max(4, Math.round(size * 0.12))}px"><img class="company-brand-logo" src="brands/${file}" alt="${esc(name)} logo" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:contain;filter:${t === 'NSC' ? 'brightness(0)' : 'none'}"></span>`;
  const label = t === 'BP' ? 'bp' : (t || '?').slice(0, 4);
  return `<span class="company-brand text-identifier" title="${esc(name)}" style="${box}background:#18232d;border:1px solid ${accent}55;padding:3px"><span class="company-brand-identifier" role="img" aria-label="${esc(name)} company identifier" style="color:${accent};font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:${Math.max(8, Math.round(size / (t.length > 3 ? 4.8 : 3.2)))}px;line-height:1">${esc(label)}</span></span>`;
}

// ── data ─────────────────────────────────────────────────────
const cases = D.cases.slice().sort((a, b) => b.eventDate.localeCompare(a.eventDate));
const byId = new Map(cases.map((c) => [c.id, c]));
const stories = (D.stories ?? []).slice().sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
const feeds = new Set(stories.map((s) => s.publisher).filter(Boolean)).size;
// prices.js rows are [date, company, SPY] adjusted closes from one provider; expand to case-valuation.js rows.
const PRICES = Object.fromEntries(Object.entries(window.HI_PRICES?.prices ?? {}).map(([id, p]) => [id, { ...p, prices: (p.rows ?? []).flatMap(([d, co, spy]) =>
  [[p.ticker, co], ['SPY', spy]].map(([ticker, adjustedClose]) => ({ ticker, date: d, adjustedClose, adjustmentBasis: 'split-and-dividend', currency: 'USD', provider: p.provider }))) }]));
const VISUALS = {
  'Policy & conflicts': ['visuals/policy-conflicts.webp', 'Fingerprint', 'Conflicts, disclosure, and company policy'],
  Governance: ['visuals/boardroom-hero.webp', 'Network', 'The decisions behind boardroom oversight'],
  Leadership: ['visuals/leadership.webp', 'Users', 'Departures, succession, and disruption'],
  'Legal & financial': ['visuals/legal-financial.webp', 'Scale', 'Proceedings and disclosed consequences'],
};
const visualFor = (cat) => VISUALS[cat] ?? VISUALS.Governance;
const categories = [...new Set(cases.map((c) => c.category))].map((name) => ({ name, count: cases.filter((c) => c.category === name).length }));
const storyTicker = (s) => s.ticker ?? (/apple/i.test(s.publisher ?? '') ? 'AAPL' : /microsoft/i.test(s.publisher ?? '') ? 'MSFT' : /starbucks/i.test(s.publisher ?? '') ? 'SBUX' : '');

// ── state & routing (?view=overview|casebook|valuation|news&case=id) ──
const VIEWS = { overview: 'Overview', casebook: 'Casebook', valuation: 'Valuation impact', news: 'Official news' };
const SUBTITLE = { overview: 'A funny name for potentially expensive governance failures.', casebook: 'Documented executive cases, original sources, and corporate outcomes.', valuation: 'Short-term market reactions and longer-run shareholder outcomes around documented disclosures.', news: 'Company publications, shown separately from conduct findings.' };
const filters = { q: '', category: 'All categories', status: 'All evidence', order: 'newest' };
let view = 'overview', valuationId = 'mcd-easterbrook-2019';

function readUrl() {
  const p = new URLSearchParams(location.search);
  view = VIEWS[p.get('view')] ? p.get('view') : 'overview';
  if (p.get('case') && byId.has(p.get('case'))) valuationId = p.get('case');
}
function go(v, { caseId, push = true, scroll = true } = {}) {
  view = v; if (caseId) valuationId = caseId;
  if (push) { const p = new URLSearchParams(); if (v !== 'overview') p.set('view', v); if (v === 'valuation') p.set('case', valuationId); history.pushState(null, '', p.toString() ? '?' + p : location.pathname); }
  render(); closeNav(); if (scroll) window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => { readUrl(); render(); });

// ── charts (SVG, sized to their container) ────────────────────
const CHARTS = new Map();
function drawCharts() {
  root.querySelectorAll('[data-chart]').forEach((el) => {
    const spec = CHARTS.get(el.dataset.chart); if (!spec) return;
    const cs = getComputedStyle(el), W = Math.max(240, el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), H = Math.max(150, el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    el.innerHTML = spec.kind === 'bar' ? barSvg(spec, W, H) : lineSvg(spec, W, H);
    bindTips(el);
  });
}
function barSvg({ rows }, W, H) {
  const padL = 30, padB = 26, padT = 22, max = Math.max(...rows.map((r) => r.count), 1), bw = (W - padL - 16) / rows.length, inner = Math.min(44, bw * 0.62);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  let g = `<defs><linearGradient id="caseBarGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8cf95"/><stop offset="100%" stop-color="#967747"/></linearGradient></defs>`;
  for (let v = 0; v <= max; v++) g += `<line x1="${padL}" x2="${W - 16}" y1="${y(v)}" y2="${y(v)}" stroke="#2a3540" stroke-dasharray="2 6"/><text x="${padL - 10}" y="${y(v) + 4}" fill="#8b9da9" font-size="11" text-anchor="end">${v}</text>`;
  rows.forEach((r, i) => {
    const x = padL + i * bw + (bw - inner) / 2, top = y(r.count);
    g += `<g class="hi-hit" tabindex="0" data-tip="${esc(`<strong>${r.year}</strong><p>${r.count} documented case${r.count === 1 ? '' : 's'}</p>`)}"><rect x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent"/><path fill="url(#caseBarGold)" d="M${x},${H - padB} V${top + 4} q0,-4 4,-4 h${inner - 8} q4,0 4,4 V${H - padB} Z"/></g><text x="${x + inner / 2}" y="${H - 6}" fill="#acbac4" font-size="11" text-anchor="middle">${r.year}</text>`;
  });
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Case disclosures by year">${g}</svg>`;
}
function lineSvg({ data, benchmark }, W, H) {
  const padL = 52, padR = 14, padT = 10, padB = 24, n = data.length;
  const vals = data.flatMap((d) => [d.stock, benchmark ? d.benchmark : null]).filter((v) => v != null).concat([100]);
  let lo = Math.min(...vals), hi = Math.max(...vals); const span = hi - lo || 10; lo -= span * 0.08; hi += span * 0.08;
  const x = (i) => padL + (n === 1 ? 0 : (i * (W - padL - padR)) / (n - 1)), y = (v) => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const fy = (v) => (benchmark ? '$' + Math.round(v) : String(Math.round(v)));
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; g += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="#32404c" stroke-dasharray="2 6"/><text x="${padL - 8}" y="${y(v) + 4}" fill="#a9b8c1" font-size="11" text-anchor="end">${fy(v)}</text>`; }
  g += `<line x1="${padL}" x2="${W - padR}" y1="${y(100)}" y2="${y(100)}" stroke="#74828c" stroke-dasharray="3 4"/>`;
  const ticks = Math.max(2, Math.floor((W - padL) / 80)), step = Math.max(1, Math.ceil((n - 1) / ticks));
  data.forEach((d, i) => { if (i % step === 0 && (n - 1 - i >= step * 0.6 || i === n - 1) || i === n - 1) g += `<text x="${x(i)}" y="${H - 4}" fill="#a9b8c1" font-size="11" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(benchmark ? new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : d.date.slice(0, 4))}</text>`; });
  const path = (k) => { let p = '', pen = false; data.forEach((d, i) => { if (d[k] == null) { pen = false; return; } p += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)} `; pen = true; }); return p; };
  g += `<path d="${path('stock')}" fill="none" stroke="#dfc58c" stroke-width="2"/>`;
  if (benchmark) g += `<path d="${path('benchmark')}" fill="none" stroke="#87bcb2" stroke-width="2"/>`;
  else g += data.map((d, i) => (d.stock == null ? '' : `<circle cx="${x(i)}" cy="${y(d.stock)}" r="4" fill="#dfc58c" stroke="#101b27" stroke-width="2"/>`)).join('');
  const colW = (W - padL - padR) / Math.max(1, n - 1), fv = (v) => (v == null ? '—' : (benchmark ? '$' : '') + v.toFixed(2));
  g += data.map((d, i) => `<g class="hi-hit" data-tip="${esc(`<strong>${esc(formatDate(d.date))}</strong><div><span style="background:#dfc58c"></span>Company ${fv(d.stock)}</div>${benchmark ? `<div><span style="background:#87bcb2"></span>SPY ${fv(d.benchmark)}</div>` : ''}`)}"><rect x="${x(i) - colW / 2}" y="${padT}" width="${Math.max(colW, 1)}" height="${H - padT - padB}" fill="transparent"/><line class="hi-cross" x1="${x(i)}" x2="${x(i)}" y1="${padT}" y2="${H - padB}"/></g>`).join('');
  return `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${benchmark ? 'Company and SPY value of $100 invested at the pre-disclosure close' : 'Issuer-reported total shareholder return, rebased to 100'}">${g}</svg>`;
}
const tip = document.createElement('div');
tip.className = 'chart-tip hi-floating-tip'; tip.hidden = true; document.body.appendChild(tip);
function bindTips(scope) {
  scope.querySelectorAll('[data-tip]').forEach((el) => {
    const show = () => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const r = el.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = Math.max(8, r.top + scrollY - tip.offsetHeight - 8) + 'px'; };
    el.addEventListener('pointerenter', show); el.addEventListener('focus', show);
    el.addEventListener('pointerleave', () => (tip.hidden = true)); el.addEventListener('blur', () => (tip.hidden = true));
  });
}
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(drawCharts, 120); });

// ── pieces ───────────────────────────────────────────────────
function caseCards(items, compact = false) {
  return `<div class="public-case-grid image-case-grid ${compact ? 'compact' : ''}">${items.map((c) => { const [img, ic] = visualFor(c.category), f = c.financialFacts[0]; return `<article class="public-case-card image-case-card">
    <button class="case-image-cover" data-open="${esc(c.id)}" aria-label="Open ${esc(c.company)} case record"><img src="${img}" alt="" width="800" height="450" loading="lazy"><span class="case-image-shade"></span><span class="illustration-label">EDITORIAL ILLUSTRATION</span><span class="case-cover-category">${icon(ic, 14)}${esc(c.category)}</span><span class="case-cover-arrow">${icon('ArrowRight', 19)}</span></button>
    <div class="case-card-content">
      <div class="case-card-top">${brand(c.ticker, c.company, 42)}<div><strong>${esc(c.company)}</strong><span>${esc(c.ticker)} · ${esc(date(c.eventDate))}</span></div><span class="case-status ${statusClass(c.status)}">${esc(c.status)}</span></div>
      <h3><button data-open="${esc(c.id)}">${esc(c.title)}</button></h3><p class="case-summary">${esc(c.summary)}</p>
      <div class="case-subject"><span>Executive at the time</span><strong>${esc(c.executive)}</strong></div>
      ${f ? `<div class="case-financial"><strong>${esc(factMoney(f))}</strong><span>${esc(f.kind)}<small>${esc(f.label)}</small></span></div>` : ''}
      <div class="case-card-bottom">${ext(c.sourceUrl, 'Original record')}<button class="text-button" data-open="${esc(c.id)}">Read case ${icon('ArrowRight', 13)}</button></div>
      <p class="historical-note">${c.historical ? 'Historical record · executive named at the time' : 'Source status and current relevance shown separately'}</p>
    </div></article>`; }).join('')}</div>`;
}
const newsCards = (limit) => `<div class="official-news-list visual-news-list">${stories.slice(0, limit ?? stories.length).map((s, i) => `<article><div class="news-brand-column">${brand(storyTicker(s), s.publisher ?? 'Official source', 42)}<span class="news-item-index">${String(i + 1).padStart(2, '0')}</span></div><div><div class="feed-meta"><strong>${esc(s.publisher ?? 'Official company source')}</strong>${s.ticker ? `<span>${esc(s.ticker)}</span>` : ''}<span>${esc(s.publishedAt ? date(s.publishedAt) : 'Publication date unavailable')}</span></div><h3>${ext(s.url, esc(s.title), '')}</h3>${s.excerpt ? `<p>${esc(s.excerpt)}</p>` : ''}<span class="news-context">Corporate publication · not automatically a conduct finding</span></div></article>`).join('')}</div>`;
const feedPending = `<div class="public-feed-pending">${icon('Radio', 22)}<strong>No publications in this edition</strong><p>The live dashboard carries the current publication stream.</p></div>`;

// ── views ────────────────────────────────────────────────────
function overview() {
  const companyCount = new Set(cases.map((c) => c.company)).size;
  const sourceCount = new Set(cases.flatMap((c) => [c.sourceUrl, ...c.milestones.map((m) => m.sourceUrl), ...c.financialFacts.map((f) => f.sourceUrl)])).size;
  const counts = new Map(); cases.forEach((c) => counts.set(c.eventDate.slice(0, 4), (counts.get(c.eventDate.slice(0, 4)) ?? 0) + 1));
  CHARTS.set('year', { kind: 'bar', rows: [...counts].sort((a, b) => a[0].localeCompare(b[0])).map(([year, count]) => ({ year, count })) });
  const facts = cases.flatMap((c) => c.financialFacts.map((f) => ({ ...f, caseId: c.id, company: c.company, ticker: c.ticker }))).sort((a, b) => b.amount - a.amount);
  const featured = [facts.find((f) => f.kind === 'Company recovery'), facts.find((f) => f.kind === 'Compensation forfeited'), facts.find((f) => f.kind === 'Company fine') ?? facts.find((f) => f.kind === 'Severance withheld')].filter(Boolean);
  return `<div class="visual-research">
    <section class="visual-hero">
      <div class="visual-hero-art"><img src="visuals/boardroom-hero.webp" alt="" width="1600" height="1000" fetchpriority="high"><span class="hero-art-vignette"></span></div>
      <div class="visual-hero-copy">
        <span class="visual-kicker"><span></span>THE BOARDROOM, UNDER REVIEW</span>
        <h2>The cost of<br><em>poor judgment.</em></h2>
        <p>Follow the disclosures, boardroom decisions, and financial consequences behind executive conduct cases.</p>
        <div class="visual-hero-actions"><button class="button gold" data-go="casebook" data-reset>Explore the casebook ${icon('ArrowRight', 15)}</button><button class="hero-news-link" data-go="news">Official news ${icon('ChevronRight', 15)}</button></div>
        <div class="visual-hero-proof">${icon('ShieldCheck', 15)}<span>Original sources. Named subjects. Documented outcomes.</span></div>
      </div>
      <div class="visual-hero-bottom"><span class="hero-feed-status"><i></i>${feeds ? feeds + ' official feeds' : 'Source monitoring'}<span> · Hourly updates · Edition ${esc(stamp(D.fetchedAt))}</span></span><span class="hero-illustration-note">Conceptual editorial illustration</span></div>
    </section>
    <div class="public-metrics-grid visual-metrics">
      <div class="public-metric primary"><div><span>DOCUMENTED CASES</span><strong>${cases.length}</strong><small>Source-backed case records</small></div>${icon('BookOpen', 28)}</div>
      <div class="public-metric"><div><span>COMPANIES IN CASEBOOK</span><strong>${companyCount}</strong><small>Historical executive subjects</small></div>${icon('Users', 28)}</div>
      <div class="public-metric"><div><span>ORIGINAL SOURCE LINKS</span><strong>${sourceCount}</strong><small>Company and official records</small></div>${icon('FileCheck2', 28)}</div>
      <div class="public-metric"><div><span>OFFICIAL PUBLICATIONS</span><strong>${stories.length}</strong><small>Latest retained feed items</small></div>${icon('Radio', 28)}</div>
    </div>
    <section class="valuation-preview panel">${icon('BarChart3', 24)}<div><h2>Valuation impact</h2><p>Compare immediate market reactions, longer-run shareholder returns, and costs disclosed by the company.</p></div><button class="button secondary" data-go="valuation">Explore valuations ${icon('ArrowRight', 14)}</button></section>
    <section class="company-evidence-strip" aria-label="Companies in the historical casebook"><span>IN THE CASEBOOK<small>Historical records</small></span><div>${cases.map((c) => `<button data-company="${esc(c.company)}" title="View ${esc(c.company)} case">${brand(c.ticker, c.company, 32)}<span>${esc(c.company)}</span></button>`).join('')}</div></section>
    <section class="casebook-preview visual-casebook-preview"><div class="section-title-row"><div><span class="visual-section-number">01 / THE CASEBOOK</span><h2>Behind the boardroom doors.</h2><p>The disclosure, the response, and the outcome—on the record.</p></div><button class="button secondary" data-go="casebook" data-reset>View all ${cases.length} cases ${icon('ArrowRight', 14)}</button></div>${caseCards(cases.slice(0, 3), true)}</section>
    <div class="public-overview-charts visual-overview-charts">
      <section class="panel public-chronology"><div class="panel-heading"><div><span class="visual-section-number">02 / THE HISTORICAL RECORD</span><h2>When governance became a headline</h2><p>Case disclosures by year in this curated record</p></div>${icon('BookOpen', 19)}</div><div class="public-year-chart" data-chart="year"></div><div class="chart-footer"><span>Casebook counts, not market-wide incident rates.</span><button data-go="casebook" data-reset>Explore the record ${icon('ArrowRight', 12)}</button></div></section>
      <section class="panel public-consequences visual-consequences"><div class="panel-heading"><div><span class="visual-section-number">03 / DISCLOSED CONSEQUENCES</span><h2>Real numbers. Different meanings.</h2><p>Reported figures, never a fabricated loss estimate</p></div>${icon('Scale', 19)}</div><div class="consequence-facts">${featured.map((f) => `<article><div class="consequence-brand-row">${brand(f.ticker, f.company, 34)}<span>${esc(f.company)}<small>${esc(f.kind)}</small></span><strong>${esc(factMoney(f))}<small>${esc(f.currency)}</small></strong></div><p>${esc(f.label)}</p>${ext(f.sourceUrl, 'Original disclosure')}</article>`).join('')}</div><p class="consequence-footnote">Recoveries, fines, forfeitures, and withheld pay stay separate. They are never added together or presented as stock-market losses.</p></section>
    </div>
    <section class="visual-category-section"><div class="section-title-row"><div><span class="visual-section-number">04 / FOLLOW THE EVIDENCE</span><h2>Four ways judgment becomes exposure.</h2></div><span class="visual-scope-note">Categories describe this casebook</span></div><div class="visual-category-grid">${categories.map((c) => { const [img, ic, cap] = visualFor(c.name); return `<button data-category="${esc(c.name)}" class="visual-category-card"><img src="${img}" alt="" width="600" height="450" loading="lazy"><span class="category-card-shade"></span><span class="category-topline">${icon(ic, 20)}<b>${String(c.count).padStart(2, '0')}<small>cases</small></b></span><span class="category-bottomline"><strong>${esc(c.name)}</strong><small>${esc(cap)}</small>${icon('ArrowRight', 18)}</span></button>`; }).join('')}</div><p class="visual-art-note">Category imagery is conceptual illustration, not a photograph of any person or event.</p></section>
    <div class="public-lower-grid visual-lower-grid"><section class="panel"><div class="panel-heading"><div><span class="visual-section-number">05 / DIRECT FROM THE SOURCE</span><h2>Latest official publications</h2><p>Company news, separate from conduct findings</p></div><button class="text-button" data-go="news">All news ${icon('ArrowRight', 12)}</button></div>${stories.length ? newsCards(4) : feedPending}</section>
    <section class="visual-monitor-promo"><img src="visuals/leadership.webp" alt="" width="800" height="900" loading="lazy"><div class="monitor-promo-shade"></div><div><span class="visual-kicker"><span></span>THE EXPOSURE MONITOR</span>${icon('ShieldCheck', 32)}<h2>Today's risk needs<br>today's evidence.</h2><p>Historical cases provide context. Current exposure scores require reviewed corporate evidence and clearly stated coverage.</p><a class="button gold" href="${esc(LIVE)}" target="_blank" rel="noopener noreferrer">Open the monitor ${icon('ArrowUpRight', 15)}</a><span class="hero-illustration-note">Conceptual editorial illustration</span></div></section></div>
  </div>`;
}

function filtered() {
  const q = filters.q.toLowerCase();
  return cases.filter((c) => (c.company + ' ' + c.ticker + ' ' + c.executive + ' ' + c.title + ' ' + c.summary).toLowerCase().includes(q) && (filters.category === 'All categories' || c.category === filters.category) && (filters.status === 'All evidence' || c.status === filters.status))
    .sort((a, b) => (filters.order === 'oldest' ? a.eventDate.localeCompare(b.eventDate) : b.eventDate.localeCompare(a.eventDate)));
}
const results = (visible) => `<p class="public-filter-summary">${visible.length} matching record${visible.length === 1 ? '' : 's'} · company and official disclosures</p>${caseCards(visible)}${visible.length ? '' : `<div class="panel public-no-matches">${icon('Search', 22)}<h3>No case matches those filters</h3><button class="text-button" data-clear>Clear filters ${icon('ArrowRight', 12)}</button></div>`}`;
function casebook() {
  const opt = (v, cur, label = v) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  return `<div class="visual-research">
    <section class="casebook-visual-masthead"><img src="visuals/boardroom-hero.webp" alt="" width="1600" height="500"><div><span class="visual-kicker"><span></span>THE PUBLIC RECORD</span><h2>Decisions leave a paper trail.</h2><p>${cases.length} documented cases. Every record names the executive involved at the time and links to the original evidence.</p></div><span class="hero-illustration-note">Editorial illustration</span></section>
    <div class="public-case-filters"><label class="search-input">${icon('Search', 17)}<input id="f-q" value="${esc(filters.q)}" placeholder="Search company, executive, or event" aria-label="Search casebook"></label>
      <select id="f-cat" aria-label="Casebook category">${opt('All categories', filters.category)}${categories.map((c) => opt(c.name, filters.category)).join('')}</select>
      <select id="f-status" aria-label="Casebook evidence status">${opt('All evidence', filters.status)}${[...new Set(cases.map((c) => c.status))].map((s) => opt(s, filters.status)).join('')}</select>
      <select id="f-order" aria-label="Casebook date order">${opt('newest', filters.order, 'Newest first')}${opt('oldest', filters.order, 'Oldest first')}</select></div>
    <div id="hi-results">${results(filtered())}</div>
  </div>`;
}

function news() {
  return `<div class="visual-research">
    <section class="official-news-masthead"><div><span class="visual-kicker"><span></span>OFFICIAL PUBLICATION STREAM</span><h2>Straight from the source.</h2><p>Company newsroom items retain their attribution. Publication alone is never a conduct finding.</p></div><div class="publisher-marks">${brand('AAPL', 'Apple', 58)}${brand('MSFT', 'Microsoft', 58)}${brand('SBUX', 'Starbucks', 58)}</div></section>
    <section class="panel"><div class="panel-heading"><div><h2>Official publication stream</h2><p>${stories.length} retained publications · newest first · edition of ${esc(date(D.fetchedAt))}</p></div><span class="live-publication-badge"><i></i>${feeds} feeds</span></div>${stories.length ? newsCards() : feedPending}</section>
  </div>`;
}

const HORIZONS = ['1 day', '1 week', '1 month', '3 months', '6 months', '1 year'], SESSIONS = [1, 5, 20, 63, 126, 252];
const WINDOW_NOTES = { available: '', pending: 'Window still open', missing: 'Missing observations', incompatible: 'Price basis mismatch' };
const legend = (benchmark) => `<div class="valuation-chart-legend"><span><i></i>Company</span>${benchmark ? '<span><i></i>SPY</span>' : ''}<small>${benchmark ? 'Starting value $100' : 'Rebased to 100'}</small></div>`;
function valuation() {
  const c = byId.get(valuationId) ?? cases[0];
  const p = PRICES[c.id] ?? D.prices?.[c.id] ?? null;
  const a = p?.status === 'available' && p.ticker && p.anchorDate ? analyzeCaseValuation({ ticker: p.ticker, disclosureDate: p.anchorDate, prices: p.prices, afterClose: !!p.afterClose }) : null;
  const has = a?.windows.some((w) => w.status === 'available') ?? false;
  const state = !p ? 'Coverage unavailable' : p.status === 'connection-needed' ? 'Connection needed' : p.status === 'pending' ? 'Awaiting backfill' : has ? 'Historical daily data' : 'Daily history unavailable';
  if (a && a.riskObservationCount > 0) CHARTS.set('market', { kind: 'line', benchmark: true, data: a.series.map((s) => ({ date: s.date, stock: s.stock, benchmark: s.benchmark })) });
  const studies = D.studies ?? [];
  return `<div class="valuation-view">
    <section class="panel valuation-case-selector"><div>${brand(c.ticker, c.company, 44)}<div><h2>${esc(c.company)} <small>${esc(c.ticker)}</small></h2><p>${esc(c.title)}</p></div></div>
      <label>Case<select id="v-case">${cases.slice().sort((x, y) => x.company.localeCompare(y.company)).map((o) => `<option value="${esc(o.id)}"${o.id === c.id ? ' selected' : ''}>${esc(o.company)} · ${o.eventDate.slice(0, 4)}</option>`).join('')}</select></label></section>
    <div class="valuation-analysis-grid">
      <section class="panel valuation-panel">
        <div class="valuation-panel-heading"><div><h2>Market reaction</h2><p>Company and SPY, from the close before the selected disclosure session</p></div><span class="valuation-status">${esc(state)}</span></div>
        ${p?.anchorDate ? `<p class="valuation-anchor">Selected public disclosure · ${esc(formatDate(p.anchorDate))}${p.anchorSourceUrl ? ' · ' + ext(p.anchorSourceUrl, 'Original disclosure') : ''}${a?.eventSession ? ' · Trading session ' + esc(formatDate(a.eventSession)) : ''}</p>` : ''}
        ${a && a.riskObservationCount > 0 ? `${legend(true)}<div class="valuation-chart" data-chart="market"></div><div class="valuation-drawdown"><span>Max drawdown${a.riskThroughDate ? ' through ' + esc(formatDate(a.riskThroughDate)) : ''} <b class="${tone(a.maxDrawdownPct)}">${signed(a.maxDrawdownPct)}</b></span><span>Recovery to prior close <b>${a.recoveryStatus === 'recovered' ? a.recoverySessions + ' sessions' : a.recoveryStatus === 'no-decline' ? 'No close below baseline' : a.recoveryStatus === 'below-baseline' ? 'Unrecovered in observed period' : '—'}</b></span></div>` : ''}
        <div class="table-scroll"><table class="valuation-table"><thead><tr><th>Trading window</th><th>Company</th><th>SPY</th><th>vs. SPY</th></tr></thead><tbody>
          ${SESSIONS.map((n, i) => { const w = a?.windows.find((r) => r.sessions === n); return `<tr><th scope="row">${HORIZONS[i]} <small>${n} sessions${w?.endDate ? ' · ' + esc(formatDate(w.endDate)) : ''}${w && WINDOW_NOTES[w.status] ? ' · ' + WINDOW_NOTES[w.status] : ''}</small></th><td class="${tone(w?.stockReturn)}">${signed(w?.stockReturn)}</td><td>${signed(w?.benchmarkReturn)}</td><td class="${tone(w?.relativePercentagePoints)}">${signed(w?.relativePercentagePoints, ' pp')}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${!has ? `<p class="valuation-note" role="status">${esc(p?.reason ?? 'Matching historical observations are missing for this disclosure.')}</p>` : ''}
        ${c.id === 'hp-hurd-2010' && studies[0] ? `<p class="valuation-note">Stanford’s study reported an almost 9% decline over three days for Hewlett-Packard. HP released preliminary results and raised its outlook in the same announcement. ${ext(studies[0].url, 'Published study')}</p>` : ''}
        ${has ? `<div class="valuation-attribution">${ext(p.providerUrl, 'Market data by ' + esc(p.provider))}${p.retrievedAt ? `<span>Retrieved ${esc(formatDate(p.retrievedAt))}</span>` : ''}${p.listingNote ? `<span>Listing: ${esc(p.listingNote)}</span>` : ''}</div>` : ''}
      </section>
      ${fiscal(c)}
    </div>
    ${c.financialFacts.length ? `<section class="panel valuation-panel valuation-consequences"><div class="valuation-panel-heading"><div><h2>Disclosed financial consequences</h2><p>Amounts retain the scope and currency stated in the original records.</p></div>${icon('Scale', 20)}</div><div class="valuation-fact-grid">${c.financialFacts.map((f) => `<article><small>${esc(f.kind)} · ${esc(f.currency)}</small><strong>${f.amountQualifier === 'up-to' ? 'Up to ' : f.amountQualifier === 'more-than' ? 'Over ' : f.amountQualifier === 'approximately' ? 'About ' : ''}${esc(moneyC(f.amount, f.currency))}</strong><p>${esc(f.label)}</p>${ext(f.sourceUrl, 'Original disclosure')}</article>`).join('')}</div></section>` : ''}
    <div class="valuation-study-heading"><div><h2>What past studies observed</h2><p>Published research samples. Company outcomes vary and longer windows capture other business and market developments.</p></div>${icon('Scale', 23)}</div>
    <div class="valuation-study-grid">${studies.map((s) => `<article class="panel valuation-study"><strong>${esc(s.value)}</strong><h3>${esc(s.label)}</h3><p>${esc(s.description)}</p>${ext(s.url, esc(s.source))}</article>`).join('')}</div>
    <details class="panel valuation-method"><summary>How to read the numbers</summary>
      <p>Daily returns use company and SPY closes adjusted for splits and dividends. The baseline is the last session close before the selected disclosure session. Date-only disclosures use the session on or after the stated date. When the release came after that day’s close, the next session may contain the first reaction. The benchmark gap is the difference in cumulative returns, in percentage points.</p>
      <p>Fiscal-year returns use the company’s published shareholder-return index, rebased to $100 at the preceding fiscal year-end. The event-year return includes months before the disclosure, and later returns reflect all intervening developments. Only disclosed periods appear.</p>
      <p>Returns measure shareholder performance. Market-cap changes require matched share counts and unadjusted closes. P/E and enterprise-value multiples also require financial statements available on each measurement date. Where an issuer reports fiscal year-end market cap, the view shows that figure and derives trailing P/E and price-to-sales from its fiscal-year results. Those ratios are retrospective. Company costs, fines and recoveries retain their disclosed amounts.</p>
    </details>
  </div>`;
}
function fiscal(record) {
  const d = D.valuation?.[record.id], levels = d?.levels ?? [];
  const ei = levels.findIndex((l) => l.date >= record.eventDate), ok = ei > 0;
  const before = ok ? levels[ei - 1] : null, ev = ok ? levels[ei] : null, next = ok ? levels[ei + 1] : null, two = ok ? levels[ei + 2] : null;
  if (before) CHARTS.set('fiscal', { kind: 'line', benchmark: false, data: levels.slice(ei - 1, ei + 3).map((l) => ({ date: l.date, stock: (l.value / before.value) * 100 })) });
  const annual = [['Fiscal year containing event', before, ev], ['Following fiscal year', ev, next], ['Two fiscal years after event year', ev, two]];
  const fu = d?.fundamentals, periods = fu?.periods ?? [], pi = periods.findIndex((p) => p.date >= record.eventDate);
  const fin = pi < 0 ? [] : periods.slice(Math.max(0, pi - 1), pi + 3), caps = fin.filter((p) => p.marketCap != null);
  const bc = periods[pi - 1]?.marketCap, ec = periods[pi]?.marketCap;
  return `<section class="panel valuation-panel">
    <div class="valuation-panel-heading"><div><h2>Longer-run shareholder returns</h2><p>Fiscal year-end observations reported by the issuer</p></div><span class="valuation-status">${ok ? 'Company filing' : 'No matched series'}</span></div>
    ${ok ? `${legend(false)}<div class="valuation-chart" data-chart="fiscal"></div>
      <div class="table-scroll"><table class="valuation-table"><thead><tr><th>Fiscal period</th><th>Total return</th></tr></thead><tbody>${annual.map(([label, f, t]) => { const v = f && t ? change(f.value, t.value) : null; return `<tr><th scope="row">${label}${f && t ? `<small>${esc(formatDate(f.date))} – ${esc(formatDate(t.date))}</small>` : ''}</th><td class="${tone(v)}">${signed(v)}</td></tr>`; }).join('')}</tbody></table></div>
      <p class="valuation-note">Fiscal-year results include market and company developments throughout the period.</p><div class="valuation-attribution">${ext(d.sourceUrl, esc(d.sourceLabel))}</div>`
    : '<p class="valuation-note">A verified series spanning the fiscal year before and the fiscal year of this case is unavailable.</p>'}
    ${d?.note ? `<p class="valuation-note">${esc(d.note)}${!ok ? ' ' + ext(d.sourceUrl, esc(d.sourceLabel)) : ''}</p>` : ''}
    ${fu && caps.length ? `<h3 class="valuation-subheading">Fiscal year-end valuation · ${esc(fu.currency)}</h3><div class="table-scroll"><table class="valuation-table"><thead><tr><th>Fiscal year-end</th><th>Market cap</th><th>P/E</th><th>Price/sales</th></tr></thead><tbody>${caps.map((p) => `<tr><th scope="row">${esc(formatDate(p.date))}</th><td>${esc(moneyC(p.marketCap, fu.currency))}</td><td>${p.netIncome > 0 ? (p.marketCap / p.netIncome).toFixed(1) + '×' : '—'}</td><td>${p.revenue > 0 ? (p.marketCap / p.revenue).toFixed(1) + '×' : '—'}</td></tr>`).join('')}</tbody></table></div>${bc != null && ec != null ? `<p class="valuation-note">Market cap moved <b class="${tone(ec - bc)}">${signed(change(bc, ec))}</b> across the event-containing fiscal year.</p>` : ''}` : ''}
    ${fu && fin.length ? `<h3 class="valuation-subheading">Operating context · ${esc(fu.currency)}</h3><div class="table-scroll"><table class="valuation-table"><thead><tr><th>Fiscal year-end</th><th>Revenue</th><th>Net income</th><th>Net margin</th></tr></thead><tbody>${fin.map((p) => `<tr><th scope="row">${esc(formatDate(p.date))}${p.sourceUrl ? `<small>${ext(p.sourceUrl, 'Original filing')}</small>` : ''}</th><td>${esc(moneyC(p.revenue, fu.currency))}</td><td>${esc(moneyC(p.netIncome, fu.currency))}</td><td>${p.revenue > 0 ? ((p.netIncome / p.revenue) * 100).toFixed(1) + '%' : '—'}</td></tr>`).join('')}</tbody></table></div><div class="valuation-attribution">${ext(fu.sourceUrl, esc(fu.sourceLabel))}</div>` : ''}
  </section>`;
}

// ── case drawer (modal) ──────────────────────────────────────
let opener = null;
function openCase(id) {
  const c = byId.get(id); if (!c) return;
  opener = document.activeElement;
  const [img] = visualFor(c.category);
  const wrap = document.createElement('div'); wrap.className = 'modal-backdrop'; wrap.id = 'hi-modal';
  wrap.innerHTML = `<section class="public-case-drawer visual-case-drawer" role="dialog" aria-modal="true" aria-label="${esc(c.company)} case record">
    <header><div><span class="eyebrow">PUBLIC CASE RECORD · ${esc(c.ticker)}</span><span class="case-status ${statusClass(c.status)}">${esc(c.status)}</span></div><button class="icon-button" data-close aria-label="Close case record">${icon('X', 21)}</button></header>
    <div class="case-detail-visual"><img src="${img}" alt="" width="1000" height="500"><span></span>${brand(c.ticker, c.company, 64)}<small>Conceptual editorial illustration</small></div>
    <div class="public-case-detail"><span class="case-category">${esc(c.category)} · ${esc(date(c.eventDate))}</span><h2>${esc(c.title)}</h2>
      <div class="case-executive"><span>Company</span><strong>${esc(c.company)}</strong><span>Executive involved at the time</span><strong>${esc(c.executive)}</strong></div>
      ${c.listingNote ? `<p class="case-listing-note">${esc(c.listingNote)}</p>` : ''}<p class="public-case-lede">${esc(c.summary)}</p>${ext(c.sourceUrl, esc(c.sourceName) + ' · original record')}
      <div class="historical-callout">${icon('ShieldCheck', 18)}<p>${c.historical ? "This historical record concerns the named executive at the time. It is not an allegation about the current CEO and does not automatically contribute to today's exposure score." : "Consider this record's evidence status and current corporate relevance separately."}</p></div>
      <h3>Corporate response and outcome</h3><p>${esc(c.resolution ?? "The linked source describes the company's disclosed response. No later resolution is assumed.")}</p><h3>Current relevance</h3><p>${esc(c.currentRelevance)}</p>
      ${c.financialFacts.length ? `<h3>Disclosed financial facts</h3><div class="case-detail-financials">${c.financialFacts.map((f) => `<article>${icon('Scale', 20)}<strong>${esc(factMoney(f))}<small>${esc(f.currency)} · ${esc(f.kind)}</small></strong><p>${esc(f.label)}</p>${ext(f.sourceUrl, 'Source for this amount')}</article>`).join('')}</div><p class="micro-note">Figures retain their disclosed scope. They do not estimate shareholder loss or price causation.</p>` : ''}
      <button class="button secondary case-valuation-link" data-valuation="${esc(c.id)}">View valuation impact ${icon('ArrowRight', 14)}</button>
      <h3>Source chronology</h3><div class="public-case-timeline">${c.milestones.map((m, i) => `<article><span class="timeline-record-number">${String(i + 1).padStart(2, '0')}</span><time>${esc(date(m.date))}</time><strong>${esc(m.title)}</strong>${ext(m.sourceUrl, 'Original disclosure')}</article>`).join('')}</div>
      <div class="public-case-verification">${icon('Check', 15)}<span>Primary source checked ${esc(date(c.verifiedAt))} · source published ${esc(date(c.sourcePublishedAt))}</span></div></div>
  </section>`;
  document.body.appendChild(wrap); document.body.style.overflow = 'hidden';
  wrap.addEventListener('click', (e) => {
    const v = e.target.closest('[data-valuation]');
    if (v) { closeCase(false); go('valuation', { caseId: v.dataset.valuation }); return; }
    if (e.target === wrap || e.target.closest('[data-close]')) closeCase();
  });
  wrap.querySelector('[data-close]').focus();
}
function closeCase(restore = true) {
  const m = document.getElementById('hi-modal'); if (!m) return;
  m.remove(); document.body.style.overflow = '';
  if (restore && opener && document.contains(opener)) opener.focus();
}
document.addEventListener('keydown', (e) => {
  const m = document.getElementById('hi-modal'); if (!m) return;
  if (e.key === 'Escape') closeCase();
  if (e.key === 'Tab') { const items = [...m.querySelectorAll('button,a[href],select,input')]; const first = items[0], last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
});

// ── shell: sidebar, heading, events ──────────────────────────
const sidebar = document.querySelector('.sidebar'), scrim = document.querySelector('.mobile-scrim');
function closeNav() { sidebar.classList.remove('open'); scrim.hidden = true; }
document.querySelector('.mobile-menu').addEventListener('click', () => { sidebar.classList.add('open'); scrim.hidden = false; });
scrim.addEventListener('click', closeNav);

function render() {
  CHARTS.clear(); tip.hidden = true;
  document.querySelectorAll('[data-nav]').forEach((b) => { b.classList.toggle('active', b.dataset.nav === view); if (b.dataset.nav === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  crumb.textContent = VIEWS[view];
  heading.querySelector('h1').textContent = view === 'overview' ? 'The Horniness Index' : VIEWS[view];
  heading.querySelector('p').textContent = SUBTITLE[view];
  document.title = (view === 'overview' ? 'The Horniness Index' : VIEWS[view] + ' · The Horniness Index') + ' | Bond Bell & Co';
  root.innerHTML = view === 'casebook' ? casebook() : view === 'valuation' ? valuation() : view === 'news' ? news() : overview();
  drawCharts();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-nav],[data-go],[data-open],[data-company],[data-category],[data-clear],[data-export]');
  if (!t || t.closest('#hi-modal') || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (t.dataset.nav) { e.preventDefault(); go(t.dataset.nav); }
  else if (t.dataset.go) { if (t.hasAttribute('data-reset')) Object.assign(filters, { q: '', category: 'All categories', status: 'All evidence' }); go(t.dataset.go); }
  else if (t.dataset.open) openCase(t.dataset.open);
  else if (t.dataset.company) { Object.assign(filters, { q: t.dataset.company, category: 'All categories', status: 'All evidence' }); go('casebook'); }
  else if (t.dataset.category) { Object.assign(filters, { q: '', category: t.dataset.category, status: 'All evidence' }); go('casebook'); }
  else if (t.hasAttribute('data-clear')) { Object.assign(filters, { q: '', category: 'All categories', status: 'All evidence' }); render(); }
  else if (t.hasAttribute('data-export')) {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), edition: D.fetchedAt, casebook: D.cases, officialPublications: D.stories ?? [] }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'horniness-index-edition.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
});
root.addEventListener('input', (e) => {
  if (e.target.id !== 'f-q') return; filters.q = e.target.value;
  document.getElementById('hi-results').innerHTML = results(filtered());
});
root.addEventListener('change', (e) => {
  if (e.target.id === 'v-case') { go('valuation', { caseId: e.target.value, scroll: false }); return; }
  const map = { 'f-cat': 'category', 'f-status': 'status', 'f-order': 'order' }; if (!map[e.target.id]) return;
  filters[map[e.target.id]] = e.target.value; document.getElementById('hi-results').innerHTML = results(filtered());
});

const stamp = (v) => (v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'date unavailable');
document.getElementById('hi-updated').textContent = 'Edition ' + stamp(D.fetchedAt) + ' · refreshed hourly';

// Self-refresh: the site rebuilds data.js / prices.js hourly (GitHub Actions). An open page checks every
// 5 minutes (and when the tab comes back) and reloads in place when a new edition is published.
// Same-origin HEAD requests only; nothing leaves bondbellandco.com.
const WATCH = ['data.js', 'prices.js'];
const version = async () => (await Promise.all(WATCH.map((f) => fetch(f, { method: 'HEAD', cache: 'no-store' })
  .then((r) => (r.ok ? (r.headers.get('etag') ?? r.headers.get('last-modified') ?? '') : ''))))).join('|');
let baseline = null;
async function checkForEdition() {
  try {
    const v = await version(); if (!v.replace(/\|/g, '')) return;
    if (baseline === null) { baseline = v; return; }
    if (v === baseline) return;
    const busy = document.getElementById('hi-modal') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if (busy) return; // try again on the next check
    try { sessionStorage.setItem('hi.scroll', String(scrollY)); } catch {}
    location.reload();
  } catch { /* offline: keep showing the current edition */ }
}
checkForEdition();
setInterval(() => { if (!document.hidden) checkForEdition(); }, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForEdition(); });

readUrl(); render();
try { const y = sessionStorage.getItem('hi.scroll'); if (y) { sessionStorage.removeItem('hi.scroll'); requestAnimationFrame(() => scrollTo(0, +y)); } } catch {}
