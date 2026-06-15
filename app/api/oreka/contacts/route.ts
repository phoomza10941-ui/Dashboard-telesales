// app/api/oreka/contacts/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";
import { getOrekaToken, refreshOrekaToken } from "@/lib/oreka";
import type { AccountId } from "@/lib/oreka";
import { toOrekaStamp } from "@/lib/oreka-format";

export const dynamic = "force-dynamic";

export interface OrekaContact {
  phone: string;
  callCount: number;
  totalDuration: number;
  lastCalledAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaExtGosell, orekaExtHopeful } = currentUser;
  if (!orekaExtGosell && !orekaExtHopeful) {
    return NextResponse.json({ contacts: [] });
  }

  const BASE = process.env.OREKA_BASE_URL ?? "";
  if (!BASE) return NextResponse.json({ contacts: [] });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);
  const startUtc = toOrekaStamp(thirtyDaysAgo);
  const endUtc = toOrekaStamp(now);

  const contactMap = new Map<string, OrekaContact>();

  const pairs: Array<{ ext: string; accountId: AccountId }> = [];
  if (orekaExtGosell)  pairs.push({ ext: orekaExtGosell,  accountId: "gosell" });
  if (orekaExtHopeful) pairs.push({ ext: orekaExtHopeful, accountId: "hopeful" });

  for (const { ext, accountId } of pairs) {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url =
          `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
          `&page=${page}&pagesize=1000&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;

        let token = await getOrekaToken(accountId);
        let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        if (res.status === 401 || res.status === 403) {
          token = await refreshOrekaToken(accountId);
          res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        }
        if (!res.ok) break;

        const data = await res.json();
        const recs = (data?.objects ?? []) as Array<{
          localParty: string; remoteParty: string;
          duration: number; timestamp: string;
        }>;

        for (const r of recs) {
          if (r.localParty !== ext || !r.remoteParty) continue;
          const phone = r.remoteParty;
          const existing = contactMap.get(phone);
          if (!existing) {
            contactMap.set(phone, {
              phone,
              callCount: 1,
              totalDuration: Number(r.duration) || 0,
              lastCalledAt: r.timestamp,
            });
          } else {
            existing.callCount += 1;
            existing.totalDuration += Number(r.duration) || 0;
            if (r.timestamp > existing.lastCalledAt) existing.lastCalledAt = r.timestamp;
          }
        }

        hasMore = recs.length >= 1000 && !!data?.nextPageUri;
        page++;
      }
    } catch (e) {
      console.error(`[oreka/contacts] account ${accountId} failed:`, e);
    }
  }

  const contacts = [...contactMap.values()]
    .sort((a, b) => b.lastCalledAt.localeCompare(a.lastCalledAt));

  return NextResponse.json({ contacts });
}
