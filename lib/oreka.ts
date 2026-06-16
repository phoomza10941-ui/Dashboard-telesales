// dtac OneCall voice-record = Oreka (OrecX) OrkTrack REST API.
// Server-side talk-time fetch for the /supervisor page.
// See docs/plans/2026-06-02-oreka-talktime-supervisor-design.md
import { adminClient } from "./supabase/admin";
import {
  thaiTodayKey,
  thaiMonthKey,
  thaiDateRangeUtc,
  thaiMonthRangeUtc,
  formatTalkTime,
} from "./oreka-format";

// Re-export pure helpers so existing `@/lib/oreka` import sites keep working.
export { formatTalkTime, thaiDateRangeUtc, thaiMonthRangeUtc };

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
  recordingURL?: string; // full URL to stream audio via Oreka mediastream
  waveformURL?: string;
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

// Date/format helpers (Thai UTC+7 -> Oreka UTC startdate) live in ./oreka-format
// so they can be shared with client components without pulling in the admin client.

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
    return buildResult(aggByAccount.values(), extMaps);
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
// Thin wrapper over aggregateInto for the non-streaming (batch) callers.
function aggregate(recs: OrekaRecording[], acct: Account): Map<string, Omit<AgentTalkTime, "nickname">> {
  const map = new Map<string, Omit<AgentTalkTime, "nickname">>();
  aggregateInto(recs, acct, map, new Set<number>());
  return map;
}

// Flatten per-account aggregation maps into the sorted, nickname-resolved result list.
function buildResult(
  maps: Iterable<Map<string, Omit<AgentTalkTime, "nickname">>>,
  extMaps: { gosell: Map<string, string>; hopeful: Map<string, string> },
): AgentTalkTime[] {
  return [...maps]
    .flatMap((m) => [...m.values()])
    .map((e) => ({ ...e, nickname: resolveNickname(e, extMaps) }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);
}

// Fetch + aggregate every account for a UTC range, then resolve nicknames.
// Throws only if ALL accounts fail; a single account failure is logged and skipped.
async function fetchAndAggregate(startUtc: string, endUtc: string): Promise<AgentTalkTime[]> {
  if (ACCOUNTS.length === 0) throw new Error("No Oreka accounts configured");

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

  return buildResult(perAccount, await fetchExtMaps());
}

// --- fetch recordings for a specific localParty (agent ext) on a date range ---
export async function getRecordingsForExt(
  startUtc: string,
  endUtc: string,
  orekaExt: string,
  accountId: AccountId
): Promise<OrekaRecording[]> {
  const acct = ACCOUNTS.find((a) => a.id === accountId);
  if (!acct) throw new Error(`Unknown account: ${accountId}`);
  const all = await fetchRecordingsRange(startUtc, endUtc, acct);
  return all
    .filter((r) => r.localParty === orekaExt)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Get a valid auth token for the given account (for proxy use)
export async function getOrekaToken(accountId: AccountId): Promise<string> {
  const acct = ACCOUNTS.find((a) => a.id === accountId);
  if (!acct) throw new Error(`Unknown account: ${accountId}`);
  return getToken(acct);
}

// Re-login on 401 and return new token
export async function refreshOrekaToken(accountId: AccountId): Promise<string> {
  const acct = ACCOUNTS.find((a) => a.id === accountId);
  if (!acct) throw new Error(`Unknown account: ${accountId}`);
  return login(acct);
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

  const { startUtc, endUtc } = thaiDateRangeUtc(dateKey);
  const result = await fetchAndAggregate(startUtc, endUtc);

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

// Fetch today's recordings for specific agent ext numbers (e.g. for AnalyzeCallPanel).
// Searches across all configured accounts and filters by the provided localParty numbers.
// Returns recordings sorted newest-first. Never throws — returns [] on error.
export interface TodayRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

// Private shared implementation: fetches + normalizes recordings for a UTC range, filtered by exts.
async function fetchRecordingsForExtsInRange(
  exts: string[],
  startUtc: string,
  endUtc: string
): Promise<TodayRecording[]> {
  if (ACCOUNTS.length === 0 || exts.length === 0) return [];
  const extSet = new Set(exts);

  const results = await Promise.allSettled(
    ACCOUNTS.map((acct) => fetchRecordingsRange(startUtc, endUtc, acct))
  );

  const all: TodayRecording[] = [];
  const seenIds = new Set<number>();
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const rec of r.value) {
      if (!extSet.has(rec.localParty)) continue;
      if (seenIds.has(rec.id)) continue;
      seenIds.add(rec.id);
      all.push({
        id: String(rec.id),
        timestamp: rec.timestamp,
        duration: Number(rec.duration) || 0,
        direction: rec.direction === "IN" ? "IN" : "OUT",
        localParty: rec.localParty,
        remoteParty: rec.remoteParty,
      });
    }
  }

  // Sort newest first
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getTodayRecordingsForExts(exts: string[]): Promise<TodayRecording[]> {
  try {
    const dateKey = thaiTodayKey();
    const { startUtc, endUtc } = thaiDateRangeUtc(dateKey);
    return await fetchRecordingsForExtsInRange(exts, startUtc, endUtc);
  } catch (e) {
    console.error("[oreka] getTodayRecordingsForExts failed:", e);
    return [];
  }
}

// Fetch recordings for specific agent ext numbers on an arbitrary Thai calendar date (YYYY-MM-DD).
// Same shape and normalization as getTodayRecordingsForExts. Never throws — returns [] on error.
export async function getRecordingsForExtsOnDate(exts: string[], date: string): Promise<TodayRecording[]> {
  try {
    const { startUtc, endUtc } = thaiDateRangeUtc(date);
    return await fetchRecordingsForExtsInRange(exts, startUtc, endUtc);
  } catch (e) {
    console.error("[oreka] getRecordingsForExtsOnDate failed:", e);
    return [];
  }
}

// Fetch aggregated talk time for an entire month (YYYY-MM Thai time). Graceful — never throws.
export async function getTalkTimeByMonthSafe(monthKey: string): Promise<{ data: AgentTalkTime[]; error: string | null }> {
  try {
    const cached = cacheByDate.get(`month:${monthKey}`);
    const isCurrentMonth = monthKey === thaiMonthKey();
    const ttl = isCurrentMonth ? TALK_TIME_TTL_MS : 10 * 60_000; // current month: 90s, past months: 10 min
    if (cached && Date.now() - cached.at < ttl) return { data: cached.data, error: null };

    const { startUtc, endUtc } = thaiMonthRangeUtc(monthKey);
    const result = await fetchAndAggregate(startUtc, endUtc);

    cacheByDate.set(`month:${monthKey}`, { at: Date.now(), data: result });
    return { data: result, error: null };
  } catch (e) {
    console.error("[oreka] getTalkTimeByMonthSafe failed:", e);
    return { data: [], error: e instanceof Error ? e.message : "unknown error" };
  }
}
