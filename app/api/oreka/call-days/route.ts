import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/db";
import { getOrekaToken, refreshOrekaToken } from "@/lib/oreka";
import type { AccountId, OrekaRecording } from "@/lib/oreka";
import { thaiMonthRangeUtc, thaiMonthKey, pad } from "@/lib/oreka-format";

export const dynamic = "force-dynamic";

const BASE = process.env.OREKA_BASE_URL ?? "";
const PAGE_SIZE = 200;

// Normalize Thai phone to +66... for comparison with Oreka remoteParty
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("66")) return "+" + digits;
  if (digits.startsWith("0")) return "+66" + digits.slice(1);
  if (digits.length === 9) return "+66" + digits;
  return phone;
}

// Module-level cache: "phone|month" -> { data, ts }
const cache = new Map<string, { data: Record<string, { count: number; duration: number }>; ts: number }>();
const CACHE_TTL_MS = 60_000;

async function fetchPageForCallDays(
  pageNum: number,
  startUtc: string,
  endUtc: string,
  accountId: AccountId,
  token: string,
  normalizedPhone: string
): Promise<{ recs: OrekaRecording[]; hasMore: boolean; token: string }> {
  const url =
    `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
    `&remoteparty=${encodeURIComponent(normalizedPhone)}` +
    `&sort=&page=${pageNum}&pagesize=${PAGE_SIZE}&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;

  let t = token;
  let res = await fetch(url, { headers: { Authorization: t, Accept: "application/json" } });
  if (res.status === 401 || res.status === 403) {
    t = await refreshOrekaToken(accountId);
    res = await fetch(url, { headers: { Authorization: t, Accept: "application/json" } });
  }
  if (!res.ok) throw new Error(`Oreka HTTP ${res.status}`);

  const data = await res.json();
  const recs: OrekaRecording[] = data?.objects ?? [];
  return { recs, hasMore: recs.length >= PAGE_SIZE && !!data?.nextPageUri, token: t };
}

async function fetchRecordingsForAccount(
  startUtc: string,
  endUtc: string,
  normalizedPhone: string,
  accountId: AccountId
): Promise<OrekaRecording[]> {
  let token = await getOrekaToken(accountId);
  const all: OrekaRecording[] = [];
  let page = 1;

  while (page <= 50) {
    const { recs, hasMore, token: newToken } = await fetchPageForCallDays(page, startUtc, endUtc, accountId, token, normalizedPhone);
    token = newToken;
    for (const r of recs) {
      if (normalizePhone(r.remoteParty) === normalizedPhone) {
        all.push(r);
      }
    }
    if (!hasMore) break;
    page++;
  }

  return all;
}

// Convert UTC timestamp to Thai date key "YYYY-MM-DD"
function toThaiDateKey(utcTimestamp: string): string {
  // timestamp is "YYYY-MM-DD HH:MM:SS" (UTC), add Z to parse as UTC
  const d = new Date(utcTimestamp + "Z");
  // Shift to Thai time (+7h)
  const thaiMs = d.getTime() + 7 * 3600_000;
  const thai = new Date(thaiMs);
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone");
  const monthParam = req.nextUrl.searchParams.get("month");

  if (!phone) return Response.json({ error: "Provide ?phone=..." }, { status: 400 });
  if (!BASE) return Response.json({ error: "Oreka not configured" }, { status: 503 });

  // Validate/default month
  const monthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : thaiMonthKey();
  const normalizedPhone = normalizePhone(phone);

  // Check cache
  const cacheKey = `${normalizedPhone}|${monthKey}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return Response.json({ month: monthKey, days: cached.data });
  }

  const { startUtc, endUtc } = thaiMonthRangeUtc(monthKey);
  const ACCOUNTS: AccountId[] = ["gosell", "hopeful"];

  try {
    const results = await Promise.allSettled(
      ACCOUNTS.map((acct) => fetchRecordingsForAccount(startUtc, endUtc, normalizedPhone, acct))
    );

    // Dedupe by recording id across accounts
    const byId = new Map<number, OrekaRecording>();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const rec of r.value) byId.set(rec.id, rec);
    }

    // Bucket by Thai day
    const days: Record<string, { count: number; duration: number }> = {};
    for (const rec of byId.values()) {
      const dayKey = toThaiDateKey(rec.timestamp);
      // Only include days in the requested month
      if (!dayKey.startsWith(monthKey)) continue;
      const entry = days[dayKey] ?? { count: 0, duration: 0 };
      entry.count += 1;
      entry.duration += Number(rec.duration) || 0;
      days[dayKey] = entry;
    }

    // Store in cache
    cache.set(cacheKey, { data: days, ts: Date.now() });

    return Response.json({ month: monthKey, days });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
