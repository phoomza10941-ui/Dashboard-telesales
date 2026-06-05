// Pure date/format helpers for Oreka talk-time — NO server imports.
// Safe to import from both server (lib/oreka.ts, API routes) and client components.

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// A Date -> Oreka UTC startdate string "YYYYMMDD_HHMMSS"
export function toOrekaStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

// Thai-today key (YYYY-MM-DD), used for cache bucketing
export function thaiTodayKey(now = new Date()): string {
  const thai = new Date(now.getTime() + 7 * 3600_000);
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
}

// Thai-today month key (YYYY-MM)
export function thaiMonthKey(now = new Date()): string {
  const thai = new Date(now.getTime() + 7 * 3600_000);
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}`;
}

// Build startdate/enddate UTC stamps for a Thai-calendar date key ("YYYY-MM-DD")
export function thaiDateRangeUtc(dateKey: string): { startUtc: string; endUtc: string } {
  const thaiMidnightUtcMs = new Date(`${dateKey}T00:00:00Z`).getTime() - 7 * 3600_000;
  const thaiEndUtcMs = thaiMidnightUtcMs + 24 * 3600_000;
  return {
    startUtc: toOrekaStamp(new Date(thaiMidnightUtcMs)),
    endUtc: toOrekaStamp(new Date(thaiEndUtcMs)),
  };
}

// Build startdate/enddate UTC stamps for a Thai-calendar month key ("YYYY-MM")
export function thaiMonthRangeUtc(monthKey: string): { startUtc: string; endUtc: string } {
  const [y, m] = monthKey.split("-").map(Number);
  // Thai midnight of first day of month
  const startMs = new Date(`${monthKey}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  // Thai midnight of first day of next month
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const endMs = new Date(`${nextMonth}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  return {
    startUtc: toOrekaStamp(new Date(startMs)),
    endUtc: toOrekaStamp(new Date(endMs)),
  };
}

// Format seconds -> "H:MM:SS" or "M:SS"
export function formatTalkTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}
