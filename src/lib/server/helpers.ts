// ============================================================
// Shared server-side helpers: rounding, safe math, date/month
// formatting and the two-proportion z-test used by /api/experiments.
// ============================================================

/** Round to `decimals` places; returns 0 for NaN/Infinity. */
export function round(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * f) / f;
}

export const round2 = (n: number): number => round(n, 2);
export const round4 = (n: number): number => round(n, 4);

/** Division that returns 0 when the denominator is 0 (or non-finite inputs). */
export function safeDiv(numerator: number, denominator: number): number {
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  const r = numerator / denominator;
  return Number.isFinite(r) ? r : 0;
}

/** Percentage delta (last - prev) / prev with zero guards. */
export function pctDelta(last: number, prev: number): number {
  return safeDiv(last - prev, prev);
}

// ---------- dates & months ----------

/** "YYYY-MM-DD" from a Date (UTC). */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM" from a Date (UTC). */
export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** All month-start Dates between `start` and `end` inclusive (UTC, capped at 600). */
export function enumerateMonths(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const first = startOfMonthUTC(start);
  const last = startOfMonthUTC(end);
  if (last < first) return out;
  let cur = first;
  for (let i = 0; i < 600 && cur <= last; i++) {
    out.push(cur);
    cur = addMonthsUTC(cur, 1);
  }
  return out;
}

/**
 * Month axis for a response: when from/to are supplied the axis spans the
 * requested window (month-aligned); otherwise it spans min..max of the months
 * present in the data.
 */
export function monthAxis(
  from: Date | undefined,
  to: Date | undefined,
  dataMonths: Date[]
): Date[] {
  const present = dataMonths.map(startOfMonthUTC).sort((a, b) => a.getTime() - b.getTime());
  const start = from ? startOfMonthUTC(from) : present[0];
  const end = to ? startOfMonthUTC(to) : present[present.length - 1];
  if (!start || !end) return present;
  return enumerateMonths(start, end);
}

// ---------- statistics: two-proportion z-test ----------

/** Abramowitz & Stegun 7.1.26 error-function approximation (max abs error 1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const y = 1 - poly * Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Two-proportion z-test (two-sided).
 * z = (pT - pC) / sqrt(p * (1 - p) * (1/nC + 1/nT)) with pooled p.
 */
export function twoProportionZ(
  controlEligible: number,
  controlConverted: number,
  treatmentEligible: number,
  treatmentConverted: number
): { z: number; pValue: number } {
  if (!controlEligible || !treatmentEligible) return { z: 0, pValue: 1 };
  const pooled =
    (controlConverted + treatmentConverted) / (controlEligible + treatmentEligible);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / controlEligible + 1 / treatmentEligible));
  if (!se) return { z: 0, pValue: 1 };
  const pC = controlConverted / controlEligible;
  const pT = treatmentConverted / treatmentEligible;
  const z = (pT - pC) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, pValue: Math.min(1, Math.max(0, pValue)) };
}

// ---------- misc ----------

/** Group a list of rows by a string key, preserving insertion order. */
export function groupBy<T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = keyFn(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/** Increment a numeric counter in a map. */
export function bump(map: Map<string, number>, key: string, delta: number): void {
  map.set(key, (map.get(key) ?? 0) + delta);
}

/** Sum a numeric field over rows. */
export function sumBy<T>(rows: T[], fn: (row: T) => number): number {
  let s = 0;
  for (const r of rows) s += fn(r);
  return s;
}

/** Whole-dollar money formatting for insight strings: 1234.5 -> "1,235". */
export function fmtMoney(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Last-vs-previous month percentage delta over a { "YYYY-MM": value } series. */
export function seriesDelta(series: Map<string, number>): number {
  const keys = [...series.keys()].sort();
  if (keys.length < 2) return 0;
  const last = series.get(keys[keys.length - 1]) ?? 0;
  const prev = series.get(keys[keys.length - 2]) ?? 0;
  return round4(pctDelta(last, prev));
}
