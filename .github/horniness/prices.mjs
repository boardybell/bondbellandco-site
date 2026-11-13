// prices.mjs — build-time daily closes for the Valuation Impact "Market reaction" panel.
// Free sources, same order as the Bond Bell dashboard: Yahoo chart API (keyless), then Tiingo
// (only if TIINGO_API_KEY is set). Company and SPY always come from the SAME provider, adjusted for
// splits and dividends, so case-valuation.js can pair them. Output is baked into
// site/horniness-index/prices.js, so visitors' browsers never contact a third party.
// Run: node scripts/horniness/prices.mjs   (re-run before deploy; keeps the last good file on failure)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const SITE = process.env.HI_SITE_DIR ? process.env.HI_SITE_DIR.replace(/\/?$/, '/') : fileURLToPath(new URL('../../site/', import.meta.url));
const OUT = SITE + 'horniness-index/prices.js';
const UA = 'Mozilla/5.0 (Macintosh) price-snapshot';
const ctx = { window: {} }; vm.runInNewContext(readFileSync(SITE + 'horniness-index/data.js', 'utf8'), ctx);
const D = ctx.window.HI_DATA;

// Listed security used for each case. Where the original listing no longer trades, the successor is
// named explicitly in `note` and shown on the page; null = no honest US-dollar listing, left unavailable.
const LISTING = {
  'nestle-freixe-2025': { symbol: 'NSRGY', note: 'Nestlé ADR (NSRGY), US dollars' },
  'kohls-buchanan-2025': { symbol: 'KSS' },
  'wwe-mcmahon-sec-2025': { symbol: 'TKO', note: 'TKO Group Holdings, parent of WWE since 2023' },
  'norfolk-shaw-2024': { symbol: 'NSC' },
  'bp-looney-2023': { symbol: 'BP', note: 'BP ADR (BP), US dollars' },
  'cboe-tilly-2023': { symbol: 'CBOE' },
  'mcd-easterbrook-2019': { symbol: 'MCD' },
  'cbs-moonves-2018': { symbol: 'VIAC', note: 'CBS Corporation (later ViacomCBS), delisted history' },
  'wynn-governance-2018': { symbol: 'WYNN' },
  'intel-krzanich-2018': { symbol: 'INTC' },
  'lululemon-potdevin-2018': { symbol: 'LULU' },
  'bestbuy-dunn-2012': { symbol: 'BBY' },
  'hp-hurd-2010': { symbol: 'HPQ', afterClose: true }, // resignation released after the Aug 6, 2010 close
};

const day = 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10);
async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
  return r.json();
}
async function yahoo(symbol, from, to) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${Math.floor(from / 1000)}&period2=${Math.floor(to / 1000)}&interval=1d&events=div%7Csplit&includeAdjustedClose=true`;
  const res = (await getJSON(u)).chart?.result?.[0];
  const ts = res?.timestamp ?? [], adj = res?.indicators?.adjclose?.[0]?.adjclose ?? [], cur = res?.meta?.currency;
  const off = res?.meta?.gmtoffset ?? 0;
  return ts.map((t, i) => ({ date: iso((t + off) * 1000), adjustedClose: adj[i], currency: cur }))
    .filter((r) => Number.isFinite(r.adjustedClose) && r.adjustedClose > 0);
}
async function tiingo(symbol, from, to) {
  const key = process.env.TIINGO_API_KEY; if (!key) throw new Error('no TIINGO_API_KEY');
  const rows = await getJSON(`https://api.tiingo.com/tiingo/daily/${encodeURIComponent(symbol)}/prices?startDate=${iso(from)}&endDate=${iso(to)}`, { authorization: 'Token ' + key });
  return rows.map((r) => ({ date: r.date.slice(0, 10), adjustedClose: r.adjClose, currency: 'USD' })).filter((r) => Number.isFinite(r.adjustedClose) && r.adjustedClose > 0);
}
const PROVIDERS = [['Yahoo Finance', 'https://finance.yahoo.com', yahoo], ['Tiingo', 'https://www.tiingo.com', tiingo]];

const prev = existsSync(OUT) ? (() => { const c = { window: {} }; vm.runInNewContext(readFileSync(OUT, 'utf8'), c); return c.window.HI_PRICES?.prices ?? {}; })() : {};
const out = {}; const now = Date.now();
for (const c of D.cases) {
  const live = D.prices?.[c.id] ?? {}; const L = LISTING[c.id];
  const anchorDate = live.anchorDate ?? c.eventDate; const anchorSourceUrl = live.anchorSourceUrl ?? c.sourceUrl;
  const base = { ticker: null, benchmark: 'SPY', anchorDate, anchorSourceUrl, afterClose: !!L?.afterClose, listingNote: L?.note ?? null };
  if (!L) { out[c.id] = { ...base, status: 'unavailable', reason: 'No US-dollar listing covers this record.', rows: [] }; continue; }
  const t0 = Date.parse(anchorDate) - 20 * day, t1 = Math.min(now, Date.parse(anchorDate) + 400 * day);
  let got = null, why = [];
  for (const [provider, providerUrl, fn] of PROVIDERS) {
    for (const sym of [L.symbol, ...(L.alt ?? [])]) {
      try {
        const [s, m] = await Promise.all([fn(sym, t0, t1), fn('SPY', t0, t1)]);
        const pre = s.filter((r) => r.date < anchorDate).length, post = s.filter((r) => r.date >= anchorDate).length;
        if (pre < 1 || post < 1 || s.some((r) => r.currency !== 'USD')) { why.push(`${provider} ${sym}: ${pre}/${post} rows`); continue; }
        const mm = new Map(m.map((r) => [r.date, +r.adjustedClose.toFixed(4)]));
        got = { ...base, status: 'available', ticker: sym, provider, providerUrl, retrievedAt: iso(now), rows: s.filter((r) => mm.has(r.date)).map((r) => [r.date, +r.adjustedClose.toFixed(4), mm.get(r.date)]) };
        break;
      } catch (e) { why.push(`${provider} ${sym}: ${e.message}`); }
    }
    if (got) break;
  }
  out[c.id] = got ?? (prev[c.id]?.status === 'available' ? prev[c.id] : { ...base, status: 'unavailable', reason: 'Daily history could not be retrieved at publish time.', rows: [] });
  console.log(c.id.padEnd(26), got ? `${got.ticker} via ${got.provider}, ${got.rows.length} sessions` : 'UNAVAILABLE ' + why.join('; '));
}
// Unchanged = same fields and sessions, closes within 0.01% (providers re-round adjusted closes between calls).
const meta = (v) => JSON.stringify({ ...v, rows: undefined, retrievedAt: undefined });
const close = (a, b) => Math.abs(a - b) <= 1e-4 * Math.max(Math.abs(a), Math.abs(b));
const sameCase = (a, b) => !!a && !!b && meta(a) === meta(b) && (a.rows ?? []).length === (b.rows ?? []).length
  && (a.rows ?? []).every((r, i) => r[0] === b.rows[i][0] && close(r[1], b.rows[i][1]) && close(r[2], b.rows[i][2]));
const unchanged = Object.keys(prev).length === Object.keys(out).length && Object.keys(out).every((k) => sameCase(prev[k], out[k]));
if (unchanged) { console.log('unchanged: prices.js is current; nothing written'); process.exit(0); }
writeFileSync(OUT, `// Generated by scripts/horniness/prices.mjs on ${iso(now)}. Do not edit.\nwindow.HI_PRICES = ${JSON.stringify({ generatedAt: iso(now), prices: out })};\n`);
console.log('wrote', OUT);
