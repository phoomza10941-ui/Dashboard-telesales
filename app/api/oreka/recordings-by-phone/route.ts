import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { thaiDateRangeUtc, toOrekaStamp } from "@/lib/oreka-format";
import { getOrekaToken, refreshOrekaToken } from "@/lib/oreka";
import type { AccountId, OrekaRecording } from "@/lib/oreka";

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

async function fetchPage(
  pageNum: number,
  startUtc: string,
  endUtc: string,
  accountId: AccountId,
  token: string
): Promise<{ recs: OrekaRecording[]; hasMore: boolean; token: string }> {
  const url =
    `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
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

async function fetchRecordingsByPhone(
  startUtc: string,
  endUtc: string,
  normalizedPhone: string,
  accountId: AccountId
): Promise<OrekaRecording[]> {
  let token = await getOrekaToken(accountId);
  const matched: OrekaRecording[] = [];
  let page = 1;

  while (page <= 20) {
    const { recs, hasMore, token: newToken } = await fetchPage(page, startUtc, endUtc, accountId, token);
    token = newToken;
    for (const r of recs) {
      if (normalizePhone(r.remoteParty) === normalizedPhone) {
        matched.push(r);
      }
    }
    if (!hasMore) break;
    page++;
  }

  return matched;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone");
  const date = req.nextUrl.searchParams.get("date");
  const daysParam = req.nextUrl.searchParams.get("days");

  if (!phone) return Response.json({ error: "Provide ?phone=..." }, { status: 400 });
  if (!BASE) return Response.json({ error: "Oreka not configured" }, { status: 503 });

  const normalizedPhone = normalizePhone(phone);

  // Two modes:
  //  - multi-day (when ?days= present): a rolling N-day window, paged back via
  //    ?weekOffset=K. Sorted newest→oldest, includes callCount. Used by the
  //    add-customer customer cards.
  //  - single-day (default): one Thai day (?date=YYYY-MM-DD or today), oldest→newest.
  //    Backward-compatible with the customers-list recordings player.
  const days = daysParam ? Math.max(1, Math.min(31, parseInt(daysParam) || 0)) : 0;
  const multiDay = days > 0;

  let startUtc: string;
  let endUtc: string;
  let dateKey: string;
  let weekOffset = 0;

  if (multiDay) {
    weekOffset = Math.max(0, parseInt(req.nextUrl.searchParams.get("weekOffset") ?? "0") || 0);
    const now = Date.now();
    const dayMs = 86_400_000;
    const end = new Date(now - weekOffset * days * dayMs);
    const start = new Date(now - (weekOffset + 1) * days * dayMs);
    startUtc = toOrekaStamp(start);
    endUtc = toOrekaStamp(end);
    dateKey = "";
  } else {
    // Default to today (Thai time)
    dateKey = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (() => {
      const thai = new Date(Date.now() + 7 * 3600_000);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
    })();
    ({ startUtc, endUtc } = thaiDateRangeUtc(dateKey));
  }

  const ACCOUNTS: AccountId[] = ["gosell", "hopeful"];

  try {
    const results = await Promise.allSettled(
      ACCOUNTS.map((acct) => fetchRecordingsByPhone(startUtc, endUtc, normalizedPhone, acct))
    );

    // Both Oreka accounts (gosell + hopeful) return the same shared recording pool,
    // so the same recording id can come back from each. Dedupe by id to avoid showing
    // every call twice.
    const byId = new Map<number, OrekaRecording>();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const rec of r.value) byId.set(rec.id, rec);
    }

    const recordings = [...byId.values()].sort((a, b) =>
      multiDay
        ? b.timestamp.localeCompare(a.timestamp)  // newest → oldest
        : a.timestamp.localeCompare(b.timestamp)  // oldest → newest
    );

    return Response.json({
      recordings,
      date: dateKey,
      callCount: recordings.length,
      ...(multiDay ? { weekOffset, days } : {}),
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
