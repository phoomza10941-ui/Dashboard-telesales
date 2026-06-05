// dtac OneCall voice-record = Oreka (OrecX) OrkTrack REST API.
// Server-side talk-time fetch for the /supervisor page.
// See docs/plans/2026-06-02-oreka-talktime-supervisor-design.md
import { adminClient } from "./supabase/admin";

const BASE = process.env.OREKA_BASE_URL ?? "";

// One OrkTrack login per team account (same base URL, different credentials).
// gosell = original OREKA_USER/PASSWORD; hopeful = OREKA_HOPEFUL_USER/PASSWORD.
// An account with missing credentials is skipped, so the others still work.
export type AccountId = "gosell" | "hopeful";

interface Account {
  id: AccountId;
  label: string;
  user: string;
  pass: string;
}

const ACCOUNTS: Account[] = (
  [
    { id: "gosell", label: "Gosell", user: process.env.OREKA_USER ?? "", pass: process.env.OREKA_PASSWORD ?? "" },
    { id: "hopeful", label: "Hopeful", user: process.env.OREKA_HOPEFUL_USER ?? "", pass: process.env.OREKA_HOPEFUL_PASSWORD ?? "" },
  ] satisfies Account[]
).filter((a) => a.user && a.pass);

const TALK_TIME_TTL_MS = 90_000; // cache ~90s so /supervisor refresh doesn't hammer Oreka
const PAGE_SIZE = 1000;  // max records per Oreka page (was 200, 5× fewer round-trips)
const MAX_PAGES = 200;   // safety cap
const PARALLEL_PAGES = 5; // fetch this many pages simultaneously per account

export interface OrekaRecording {
  id: number;
  timestamp: string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  duration: number; // seconds
  localParty: string; // agent number, "+66..."
  remoteParty: string; // customer number
  direction: "IN" | "OUT" | string;
  userDto?: { firstname?: string; lastname?: string };
}

export interface AgentTalkTime {
  account: AccountId; // which Oreka account this row came from
  accountLabel: string; // human label, e.g. "Gosell" / "Hopeful"
  orekaExt: string; // localParty (+66...)
  nickname: string | null; // matched from profiles.oreka_ext, else null
  orekaName: string; // userDto name from Oreka (fallback display)
  totalSeconds: number;
  callCount: number;
  outCount: number;
  inCount: number;
}

// --- auth: login once per account, cache token, lazy re-login on 401/403 ---
const tokenByAccount = new Map<AccountId, string>();

async function login(acct: Account): Promise<string> {
  if (!BASE) throw new Error("Oreka OREKA_BASE_URL missing");
  const basic = Buffer.from(`${acct.user}:${acct.pass}`).toString("base64");
  const url = `${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Oreka login failed (${acct.id}): HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.accesstoken) throw new Error(`Oreka login (${acct.id}): no accesstoken in response`);
  const token = json.accesstoken as string;
  tokenByAccount.set(acct.id, token);
  return token;
}

async function getToken(acct: Account): Promise<string> {
  return tokenByAccount.get(acct.id) ?? (await login(acct));
}

// --- date helpers (Thai UTC+7 -> Oreka UTC startdate) ---
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toOrekaStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

// Thai-today key (YYYY-MM-DD) for cache bucketing
function thaiTodayKey(now = new Date()): string {
  const thai = new Date(now.getTime() + 7 * 3600_000);
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
}

// Start of Thai today expressed as an Oreka UTC startdate string
function thaiTodayStartUtc(now = new Date()): string {
  const key = thaiTodayKey(now); // "YYYY-MM-DD"
  const thaiMidnightUtcMs = new Date(`${key}T00:00:00Z`).getTime() - 7 * 3600_000;
  return toOrekaStamp(new Date(thaiMidnightUtcMs));
}

// --- fetch recordings for a date range for one account (paginated) ---
async function fetchRecordingsRange(startUtc: string, endUtc: string, acct: Account): Promise<OrekaRecording[]> {
  const all: OrekaRecording[] = [];
  for await (const page of yieldRecordingPages(startUtc, endUtc, acct)) all.push(...page);
  return all;
}

// Fetch a single page, returns recordings + whether more pages exist
async function fetchOnePage(
  pageNum: number, startUtc: string, endUtc: string, acct: Account, token: string
): Promise<{ recs: OrekaRecording[]; hasMore: boolean; newToken: string }> {
  const url =
    `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
    `&sort=&page=${pageNum}&pagesize=${PAGE_SIZE}&maxresults=0` +
    `&includetags=false&includemetadata=false&includeprograms=false`;

  let t = token;
  let res = await fetch(url, { headers: { Authorization: t, Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) {
    t = await login(acct);
    res = await fetch(url, { headers: { Authorization: t, Accept: "application/json" } });
  }
  if (!res.ok) throw new Error(`Oreka recordings failed (${acct.id}): HTTP ${res.status}`);

  const data = await res.json();
  const recs: OrekaRecording[] = data?.objects ?? [];
  return { recs, hasMore: recs.length >= PAGE_SIZE && !!data?.nextPageUri, newToken: t };
}

// Async generator: yields batches of pages in parallel (PARALLEL_PAGES at a time)
async function* yieldRecordingPages(startUtc: string, endUtc: string, acct: Account): AsyncGenerator<OrekaRecording[]> {
  let token = await getToken(acct);
  let nextPage = 1;
  let done = false;

  while (!done && nextPage <= MAX_PAGES) {
    // Build a batch of page numbers to fetch in parallel
    const batch = Array.from(
      { length: Math.min(PARALLEL_PAGES, MAX_PAGES - nextPage + 1) },
      (_, i) => nextPage + i
    );
    nextPage += batch.length;

    // Fetch all pages in the batch simultaneously
    const results = await Promise.all(
      batch.map((p) => fetchOnePage(p, startUtc, endUtc, acct, token).catch((e) => {
        console.error(`[oreka] page ${p} failed:`, e);
        return null;
      }))
    );

    for (const r of results) {
      if (!r) { done = true; break; }
      token = r.newToken; // keep latest token (re-login propagates)
      yield r.recs;
      if (!r.hasMore) { done = true; break; }
    }
  }
}

// Mutates an existing per-account aggregation map with new recordings.
// seenIds guards against the same recording appearing on multiple pages (offset pagination race).
function aggregateInto(
  recs: OrekaRecording[],
  acct: Account,
  map: Map<string, Omit<AgentTalkTime, "nickname">>,
  seenIds: Set<number>
): void {
  for (const r of recs) {
    const ext = r.localParty;
    if (!ext) continue;
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const e = map.get(ext) ?? {
      account: acct.id, accountLabel: acct.label, orekaExt: ext,
      orekaName: [r.userDto?.firstname, r.userDto?.lastname].filter(Boolean).join(" ").trim(),
      totalSeconds: 0, callCount: 0, outCount: 0, inCount: 0,
    };
    e.totalSeconds += Number(r.duration) || 0;
    e.callCount += 1;
    if (r.direction === "OUT") e.outCount += 1;
    else if (r.direction === "IN") e.inCount += 1;
    map.set(ext, e);
  }
}

// Stream talk time page-by-page, calling onProgress after each page with partial results.
// Processes accounts sequentially so progress is monotonic.
export async function streamTalkTimeForRange(
  startUtc: string,
  endUtc: string,
  onProgress: (partial: AgentTalkTime[], pagesLoaded: number) => Promise<void>
): Promise<void> {
  if (ACCOUNTS.length === 0) throw new Error("No Oreka accounts configured");

  const extMaps = await fetchExtMaps();

  const aggByAccount = new Map<AccountId, Map<string, Omit<AgentTalkTime, "nickname">>>();
  const seenIdsByAccount = new Map<AccountId, Set<number>>();
  for (const acct of ACCOUNTS) {
    aggByAccount.set(acct.id, new Map());
    seenIdsByAccount.set(acct.id, new Set());
  }

  let pagesLoaded = 0;

  function snapshot(): AgentTalkTime[] {
    return [...aggByAccount.values()]
      .flatMap((m) => [...m.values()])
      .map((e) => ({ ...e, nickname: resolveNickname(e, extMaps) }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }

  for (const acct of ACCOUNTS) {
    try {
      for await (const recs of yieldRecordingPages(startUtc, endUtc, acct)) {
        aggregateInto(recs, acct, aggByAccount.get(acct.id)!, seenIdsByAccount.get(acct.id)!);
        pagesLoaded++;
        await onProgress(snapshot(), pagesLoaded);
      }
    } catch (e) {
      console.error(`[oreka] streaming account "${acct.id}" failed:`, e);
    }
  }
}

// Build account-aware ext→nickname lookup maps (Gosell uses oreka_ext, Hopeful uses oreka_ext_hopeful)
async function fetchExtMaps(): Promise<{ gosell: Map<string, string>; hopeful: Map<string, string> }> {
  const { data } = await adminClient
    .from("profiles")
    .select("nickname, oreka_ext, oreka_ext_hopeful");
  const gosell = new Map<string, string>();
  const hopeful = new Map<string, string>();
  for (const p of data ?? []) {
    if (p.oreka_ext) gosell.set(p.oreka_ext, p.nickname);
    if (p.oreka_ext_hopeful) hopeful.set(p.oreka_ext_hopeful, p.nickname);
  }
  return { gosell, hopeful };
}

function resolveNickname(
  entry: Omit<AgentTalkTime, "nickname">,
  maps: { gosell: Map<string, string>; hopeful: Map<string, string> }
): string | null {
  const map = entry.account === "hopeful" ? maps.hopeful : maps.gosell;
  return map.get(entry.orekaExt) ?? null;
}

// --- aggregate talk time per agent for one account, matched to profiles.oreka_ext ---
function aggregate(recs: OrekaRecording[], acct: Account): Map<string, Omit<AgentTalkTime, "nickname">> {
  const map = new Map<string, Omit<AgentTalkTime, "nickname">>();
  const seenIds = new Set<number>();
  for (const r of recs) {
    const ext = r.localParty;
    if (!ext) continue;
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    const e =
      map.get(ext) ??
      {
        account: acct.id,
        accountLabel: acct.label,
        orekaExt: ext,
        orekaName: [r.userDto?.firstname, r.userDto?.lastname].filter(Boolean).join(" ").trim(),
        totalSeconds: 0,
        callCount: 0,
        outCount: 0,
        inCount: 0,
      };
    e.totalSeconds += Number(r.duration) || 0;
    e.callCount += 1;
    if (r.direction === "OUT") e.outCount += 1;
    else if (r.direction === "IN") e.inCount += 1;
    map.set(ext, e);
  }
  return map;
}

// Build startdate/enddate UTC stamps for a Thai-calendar date key ("YYYY-MM-DD")
function thaiDateRangeUtc(dateKey: string): { startUtc: string; endUtc: string } {
  const thaiMidnightUtcMs = new Date(`${dateKey}T00:00:00Z`).getTime() - 7 * 3600_000;
  const thaiEndUtcMs = thaiMidnightUtcMs + 24 * 3600_000;
  return {
    startUtc: toOrekaStamp(new Date(thaiMidnightUtcMs)),
    endUtc: toOrekaStamp(new Date(thaiEndUtcMs)),
  };
}

// Build startdate/enddate UTC stamps for a Thai-calendar month key ("YYYY-MM")
function thaiMonthRangeUtc(monthKey: string): { startUtc: string; endUtc: string } {
  const [y, m] = monthKey.split("-").map(Number);
  // Thai midnight of first day of month
  const startMs = new Date(`${monthKey}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  // Thai midnight of first day of next month
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const endMs = new Date(`${nextMonth}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  return {
    startUtc: toOrekaStamp(new Date(startMs)),
    endUtc: toOrekaStamp(new Date(endMs)),
  };
}

function thaiMonthKey(now = new Date()): string {
  const thai = new Date(now.getTime() + 7 * 3600_000);
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}`;
}

// --- public API with TTL cache (keyed by date) ---
const cacheByDate = new Map<string, { at: number; data: AgentTalkTime[] }>();

// Call this whenever a profile's oreka_ext changes so the next request re-resolves nicknames.
export function invalidateTalkTimeCache(): void {
  cacheByDate.clear();
}

async function fetchTalkTimeForDate(dateKey: string): Promise<AgentTalkTime[]> {
  const cached = cacheByDate.get(dateKey);
  const isToday = dateKey === thaiTodayKey();
  const ttl = isToday ? TALK_TIME_TTL_MS : 5 * 60_000; // past days: 5 min cache
  if (cached && Date.now() - cached.at < ttl) return cached.data;

  if (ACCOUNTS.length === 0) throw new Error("No Oreka accounts configured (OREKA_USER / OREKA_HOPEFUL_USER)");

  const { startUtc, endUtc } = thaiDateRangeUtc(dateKey);

  let failures = 0;
  const perAccount = await Promise.all(
    ACCOUNTS.map(async (acct) => {
      try {
        return aggregate(await fetchRecordingsRange(startUtc, endUtc, acct), acct);
      } catch (e) {
        failures++;
        console.error(`[oreka] account "${acct.id}" fetch failed:`, e);
        return new Map<string, Omit<AgentTalkTime, "nickname">>();
      }
    }),
  );
  if (failures === ACCOUNTS.length) throw new Error("All Oreka accounts failed to fetch");

  const extMaps = await fetchExtMaps();

  const result: AgentTalkTime[] = perAccount
    .flatMap((agg) => [...agg.values()])
    .map((e) => ({ ...e, nickname: resolveNickname(e, extMaps) }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  cacheByDate.set(dateKey, { at: Date.now(), data: result });
  return result;
}

export async function getTalkTimeByAgent(): Promise<AgentTalkTime[]> {
  return fetchTalkTimeForDate(thaiTodayKey());
}

// Graceful variant for page-level use — never throws, so /supervisor still renders.
export async function getTalkTimeByAgentSafe(): Promise<{ data: AgentTalkTime[]; error: string | null }> {
  try {
    return { data: await getTalkTimeByAgent(), error: null };
  } catch (e) {
    console.error("[oreka] getTalkTimeByAgent failed:", e);
    return { data: [], error: e instanceof Error ? e.message : "unknown error" };
  }
}

// Fetch talk time for any past date (YYYY-MM-DD Thai time). Graceful — never throws.
export async function getTalkTimeByDateSafe(dateKey: string): Promise<{ data: AgentTalkTime[]; error: string | null }> {
  try {
    return { data: await fetchTalkTimeForDate(dateKey), error: null };
  } catch (e) {
    console.error("[oreka] getTalkTimeByDateSafe failed:", e);
    return { data: [], error: e instanceof Error ? e.message : "unknown error" };
  }
}

// Fetch aggregated talk time for an entire month (YYYY-MM Thai time). Graceful — never throws.
export async function getTalkTimeByMonthSafe(monthKey: string): Promise<{ data: AgentTalkTime[]; error: string | null }> {
  try {
    const cached = cacheByDate.get(`month:${monthKey}`);
    const isCurrentMonth = monthKey === thaiMonthKey();
    const ttl = isCurrentMonth ? TALK_TIME_TTL_MS : 10 * 60_000; // current month: 90s, past months: 10 min
    if (cached && Date.now() - cached.at < ttl) return { data: cached.data, error: null };

    if (ACCOUNTS.length === 0) throw new Error("No Oreka accounts configured");

    const { startUtc, endUtc } = thaiMonthRangeUtc(monthKey);

    let failures = 0;
    const perAccount = await Promise.all(
      ACCOUNTS.map(async (acct) => {
        try {
          return aggregate(await fetchRecordingsRange(startUtc, endUtc, acct), acct);
        } catch (e) {
          failures++;
          console.error(`[oreka] account "${acct.id}" month fetch failed:`, e);
          return new Map<string, Omit<AgentTalkTime, "nickname">>();
        }
      }),
    );
    if (failures === ACCOUNTS.length) throw new Error("All Oreka accounts failed to fetch");

    const extMaps = await fetchExtMaps();

    const result: AgentTalkTime[] = perAccount
      .flatMap((agg) => [...agg.values()])
      .map((e) => ({ ...e, nickname: resolveNickname(e, extMaps) }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    cacheByDate.set(`month:${monthKey}`, { at: Date.now(), data: result });
    return { data: result, error: null };
  } catch (e) {
    console.error("[oreka] getTalkTimeByMonthSafe failed:", e);
    return { data: [], error: e instanceof Error ? e.message : "unknown error" };
  }
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
