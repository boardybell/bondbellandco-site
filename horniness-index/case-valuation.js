// Ported from the hosted dashboard's lib/case-valuation.ts (types stripped, logic unchanged).
const benchmark = "SPY";
const horizons = [
  [1, "1D"],
  [5, "1W"],
  [20, "1M"],
  [63, "3M"],
  [126, "6M"],
  [252, "1Y"],
]         ;
export const CASE_VALUATION_WINDOWS = horizons;
function isDate(value                           )                  {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function emptyWindow(sessions        , label        , status               = "missing", endDate                = null)                      {
  return { sessions, label, endDate, status, stockReturn: null, benchmarkReturn: null, relativePercentagePoints: null };
}
function bySession(prices                               , ticker        , asOfDate               ) {
  const observations = new Map                     ();
  for (const price of prices) {
    if (price.ticker !== ticker || !isDate(price.date) || (asOfDate && price.date > asOfDate)) continue;
    const prior = observations.get(price.date);
    if (prior === undefined) {
      observations.set(price.date, price);
      continue;
    }
    if (!prior || prior.adjustedClose !== price.adjustedClose || prior.adjustmentBasis !== price.adjustmentBasis
      || prior.currency !== price.currency || prior.provider !== price.provider) {
      observations.set(price.date, null);
    }
  }
  return observations;
}
function verifiedClose(observation                         )                                                                {
  return observation?.adjustmentBasis === "split-and-dividend"
    && observation.currency === "USD"
    && !!observation.provider.trim()
    && typeof observation.adjustedClose === "number"
    && Number.isFinite(observation.adjustedClose)
    && observation.adjustedClose > 0;
}
function pair(stock                         , market                         )                     {
  if (!verifiedClose(stock) || !verifiedClose(market) || stock.provider !== market.provider) return null;
  return { stock: stock.adjustedClose, market: market.adjustedClose, provider: stock.provider };
}
function weekdaysBetween(first        , last        ) {
  if (last < first) return 0;
  const day = new Date(first + "T00:00:00Z");
  const lastTime = Date.parse(last + "T00:00:00Z");
  const elapsed = Math.floor((lastTime - day.getTime()) / 86_400_000) + 1;
  let count = Math.floor(elapsed / 7) * 5;
  for (let offset = 0; offset < elapsed % 7; offset += 1) {
    const weekday = (day.getUTCDay() + offset) % 7;
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
}
function calendarDaysBetween(first        , last        ) {
  return (Date.parse(last) - Date.parse(first)) / 86_400_000;
}
/** Observed shareholder returns around a disclosure. SPY daily bars define the US market sessions. */
export function analyzeCaseValuation({ ticker, disclosureDate, prices, afterClose, asOfDate }                    )                {
  const alignment = afterClose === undefined ? "date-only" : afterClose ? "next-session" : "same-session";
  const result                = {
    status: "invalid-disclosure", ticker, benchmark, disclosureDate, alignment,
    eventSession: null, baselineDate: null, windows: horizons.map(([sessions, label]) => emptyWindow(sessions, label)),
    series: [], maxDrawdownPct: null, recoverySessions: null, recoveryStatus: "unavailable",
    riskObservationCount: 0, riskThroughDate: null,
  };
  if (!isDate(disclosureDate) || !ticker || ticker === benchmark) return result;
  const cutoff = isDate(asOfDate) ? asOfDate : null;
  const stock = bySession(prices, ticker, cutoff);
  const market = bySession(prices, benchmark, cutoff);
  if (!stock.size) return { ...result, status: "no-prices" };
  if (!market.size) return { ...result, status: "no-benchmark" };
  const dates = [...market.keys()].sort();
  const eventIndex = dates.findIndex((date) => afterClose ? date > disclosureDate : date >= disclosureDate);
  if (eventIndex < 0 || calendarDaysBetween(disclosureDate, dates[eventIndex]) > 7) {
    return { ...result, status: "no-event-session" };
  }
  result.eventSession = dates[eventIndex];
  if (afterClose === false && result.eventSession !== disclosureDate) result.alignment = "next-session";
  result.baselineDate = dates[eventIndex - 1] ?? null;
  if (!result.baselineDate || calendarDaysBetween(result.baselineDate, result.eventSession) > 7) {
    return { ...result, status: "no-baseline" };
  }
  const baselineDate = result.baselineDate;
  const eventSession = result.eventSession;
  const stockOnlySessions = [...stock.keys()].filter((date) => date > baselineDate && !market.has(date)).sort();
  const firstMissingMarketDate = stockOnlySessions[0];
  if (firstMissingMarketDate && firstMissingMarketDate < eventSession) return { ...result, status: "no-event-session" };
  if (!stock.has(baselineDate)) return { ...result, status: "no-baseline" };
  const base = pair(stock.get(baselineDate), market.get(baselineDate));
  const maxHorizon = horizons[horizons.length - 1][0];
  const forwardDates = dates.slice(eventIndex, eventIndex + maxHorizon);
  const closes = forwardDates.map((date) => {
    if (firstMissingMarketDate && firstMissingMarketDate < date) return { status: "missing", values: null }         ;
    if (!stock.has(date)) return { status: "missing", values: null }         ;
    const values = pair(stock.get(date), market.get(date));
    if (!base || !values || values.provider !== base.provider) return { status: "incompatible", values: null }         ;
    return { status: "available", values }         ;
  });
  result.windows = horizons.map(([sessions, label]) => {
    const index = sessions - 1;
    const endDate = forwardDates[index] ?? null;
    if (!endDate) {
      const pending = cutoff && weekdaysBetween(eventSession, cutoff) < sessions;
      return emptyWindow(sessions, label, pending ? "pending" : "missing");
    }
    const incomplete = closes.slice(0, sessions).find(({ status }) => status !== "available");
    if (incomplete || !base) return emptyWindow(sessions, label, incomplete?.status ?? "incompatible", endDate);
    const end = closes[index].values ;
    const stockReturn = (end.stock / base.stock - 1) * 100;
    const benchmarkReturn = (end.market / base.market - 1) * 100;
    return { sessions, label, endDate, status: "available", stockReturn, benchmarkReturn, relativePercentagePoints: stockReturn - benchmarkReturn };
  });
  if (!base) return { ...result, status: "no-baseline" };
  result.series = [
    { date: baselineDate, session: 0, stock: 100, benchmark: 100 },
    ...forwardDates.map((date, index) => {
      const values = closes[index].values;
      return { date, session: index + 1, stock: values ? values.stock / base.stock * 100 : null, benchmark: values ? values.market / base.market * 100 : null };
    }),
  ];
  let peak = 100;
  let maxDrawdownPct = 0;
  let fellBelowBaseline = false;
  for (const point of result.series.slice(1)) {
    if (point.stock === null) break;
    result.riskObservationCount += 1;
    result.riskThroughDate = point.date;
    peak = Math.max(peak, point.stock);
    maxDrawdownPct = Math.min(maxDrawdownPct, (point.stock / peak - 1) * 100);
    if (point.stock < 100) fellBelowBaseline = true;
    if (fellBelowBaseline && point.stock >= 100 && result.recoverySessions === null) result.recoverySessions = point.session;
  }
  if (result.riskObservationCount > 0) {
    result.maxDrawdownPct = maxDrawdownPct;
    result.recoveryStatus = result.recoverySessions !== null ? "recovered" : fellBelowBaseline ? "below-baseline" : "no-decline";
  }
  result.status = "available";
  return result;
}
