#!/usr/bin/env node
// The Horniness Index: refresh the bundled editorial edition from the published dashboard.
//
// The hosted dashboard (horniness-index.null-value.chatgpt.site) stays the source of truth for
// ingestion, owner review, scoring, watchlists and snapshots. This site is a static public reader:
// its read API answers anonymously but sends no CORS headers, so browsers on bondbellandco.com
// cannot call it. This script makes the server-to-server read instead, at publish time:
//   - only two public GET paths (allowlist below), no credentials, 15 s timeout per request
//   - only allowlisted fields are kept; URLs must be https
//   - on any failure the last successful result (with its timestamp) is kept unchanged
//
// Usage: node scripts/horniness/snapshot.mjs   (writes site/horniness-index/data.js)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// HI_SITE_DIR: folder that contains horniness-index/ (default: this repo's site/; the scheduled refresh in the public repo sets it to the repo root).
const SITE = process.env.HI_SITE_DIR ? path.resolve(process.env.HI_SITE_DIR) : path.join(HERE, '../../site');
const OUT = path.join(SITE, 'horniness-index/data.js');
const BASE = 'https://horniness-index.null-value.chatgpt.site';
const PATHS = { intelligence: '/api/intelligence', prices: '/api/valuation-prices' };
const TIMEOUT_MS = 15000;

const CASE_FIELDS = ['id', 'ticker', 'company', 'executive', 'eventDate', 'title', 'summary', 'status', 'historical',
  'resolution', 'sourceUrl', 'sourceName', 'sourcePublishedAt', 'verifiedAt', 'category', 'currentRelevance', 'listingNote'];
const FACT_FIELDS = ['amount', 'currency', 'kind', 'label', 'sourceUrl', 'amountQualifier', 'qualifier'];
const MILESTONE_FIELDS = ['date', 'title', 'sourceUrl'];
const PRICE_FIELDS = ['status', 'reason', 'ticker', 'benchmark', 'anchorDate', 'anchorSourceUrl', 'retrievedAt', 'providerUrl'];
const STORY_FIELDS = ['id', 'title', 'url', 'publisher', 'publishedAt', 'excerpt', 'ticker'];
const PRICE_ROW_FIELDS = ['ticker', 'date', 'adjustedClose', 'provider', 'adjustmentBasis', 'currency'];

const https = (u) => typeof u === 'string' && /^https:\/\//.test(u) ? u : null;
const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => obj?.[f] !== undefined).map((f) => [f, obj[f]]));
const urlsSafe = (o) => Object.entries(o).every(([k, v]) => !/url$/i.test(k) || v == null || https(v));

async function get(p, query = '') {
  if (!Object.values(PATHS).includes(p)) throw new Error('path not allowlisted: ' + p);
  const res = await fetch(BASE + p + query, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${p} HTTP ${res.status}`);
  return res.json();
}

function cleanCase(c) {
  const out = pick(c, CASE_FIELDS);
  out.financialFacts = (c.financialFacts ?? []).map((f) => pick(f, FACT_FIELDS)).filter(urlsSafe);
  out.milestones = (c.milestones ?? []).map((m) => pick(m, MILESTONE_FIELDS)).filter(urlsSafe);
  if (!out.id || !out.company || !https(out.sourceUrl) || !urlsSafe(out)) throw new Error('case failed validation: ' + out.id);
  return out;
}

function cleanPrices(p) {
  const out = pick(p, PRICE_FIELDS);
  if (!urlsSafe(out)) throw new Error('price record failed validation');
  // Observations are kept only when the hosted API itself marks them publicly displayable.
  out.prices = p.status === 'available' ? (p.prices ?? []).map((r) => pick(r, PRICE_ROW_FIELDS)) : [];
  return out;
}

function readPrevious() {
  try {
    const text = fs.readFileSync(OUT, 'utf8');
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch { return null; }
}

const previous = readPrevious();
const valuation = JSON.parse(fs.readFileSync(path.join(HERE, 'valuation-disclosures.json'), 'utf8'));
const studies = JSON.parse(fs.readFileSync(path.join(HERE, 'studies.json'), 'utf8'));
const now = new Date().toISOString();
let live = null;
try {
  const intel = await get(PATHS.intelligence);
  const cases = intel.cases.map(cleanCase);
  const prices = {};
  for (const c of cases) {
    try { prices[c.id] = cleanPrices(await get(PATHS.prices, '?caseId=' + encodeURIComponent(c.id))); }
    catch (e) { prices[c.id] = { status: 'unavailable', reason: 'Price coverage could not be loaded at publish time.', prices: [] }; }
  }
  const stories = (intel.stories ?? []).map((x) => pick(x, STORY_FIELDS)).filter((x) => x.title && https(x.url));
  live = { cases, prices, stories, sourceAsOf: intel.asOf ?? null };
} catch (e) {
  console.error('live read failed, keeping last successful edition:', e.message);
}

let data;
if (live) {
  data = { edition: 'editorial', fetchedAt: now, lastAttemptAt: now, lastAttemptOk: true, ...live };
} else if (previous) {
  data = { ...previous, lastAttemptAt: now, lastAttemptOk: false };
} else {
  const bundled = JSON.parse(fs.readFileSync(path.join(HERE, 'cases-bundled.json'), 'utf8'));
  data = { edition: 'editorial', fetchedAt: null, lastAttemptAt: now, lastAttemptOk: false, sourceAsOf: bundled.asOf,
    cases: bundled.cases.map(cleanCase), prices: {} };
}
data.valuation = valuation;
data.studies = studies;
data.links = { dashboard: BASE + '/', valuation: BASE + '/?view=valuation' };

// Only publish a new edition when the content changed (timestamps alone never trigger a write).
const content = (d) => JSON.stringify(d && { cases: d.cases, stories: d.stories, prices: d.prices, sourceAsOf: d.sourceAsOf, valuation: d.valuation, studies: d.studies });
if (live && previous && content(previous) === content(data)) {
  console.log('unchanged: edition of ' + previous.fetchedAt + ' is current; nothing written');
  process.exit(0);
}
fs.writeFileSync(OUT, '/* The Horniness Index, editorial edition. Generated by scripts/horniness/snapshot.mjs; do not edit. */\nwindow.HI_DATA = ' + JSON.stringify(data) + ';\n');
console.log(`wrote ${path.relative(process.cwd(), OUT)}: ${data.cases.length} cases, live=${!!live}, fetchedAt=${data.fetchedAt}`);
