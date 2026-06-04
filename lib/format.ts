// Shared number/money formatters. Use these everywhere instead of ad-hoc
// `(x/1000).toFixed(1)+"K"` or local `fmtK` helpers.

/** Round to 1 decimal, drop a trailing ".0" (e.g. 1.2K, 3K, 12.5M). */
function trim1(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

/**
 * Compact number for dense KPI/chart contexts.
 * 0, 950, 12.3K, 1.2M, 3.4B, 1.1T. Handles values of any magnitude.
 * No currency symbol — callers prefix ฿ themselves where needed.
 */
export function fmtCompact(val: number): string {
  if (!Number.isFinite(val)) return "0";
  const sign = val < 0 ? "-" : "";
  const n = Math.abs(val);
  if (n < 1000) return sign + Math.round(n).toLocaleString();
  if (n < 1_000_000) return `${sign}${trim1(n / 1_000)}K`;
  if (n < 1_000_000_000) return `${sign}${trim1(n / 1_000_000)}M`;
  if (n < 1_000_000_000_000) return `${sign}${trim1(n / 1_000_000_000)}B`;
  return `${sign}${trim1(n / 1_000_000_000_000)}T`;
}

/** Compact Baht with the ฿ prefix: ฿12.3K, ฿1.2M. */
export function fmtBahtCompact(val: number): string {
  return `฿${fmtCompact(val)}`;
}

/** Full Baht with thousands separators, for tooltips/forms: ฿1,234,567. */
export function fmtBaht(val: number): string {
  if (!Number.isFinite(val)) return "฿0";
  return `฿${Math.round(val).toLocaleString()}`;
}

/** Percentage display with a sane cap so 999%+ never shows a meaningless number. */
export function fmtPct(val: number, cap = 999): string {
  return val > cap ? `${cap}+%` : `${val}%`;
}
