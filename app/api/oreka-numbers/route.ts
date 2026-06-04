import { NextResponse } from "next/server";
import { streamTalkTimeForRange } from "@/lib/oreka";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const toStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;

// Cache in-memory so repeated opens of profile panel don't re-fetch
let cache: { at: number; gosell: { ext: string; name: string }[]; hopeful: { ext: string; name: string }[] } | null = null;
const CACHE_TTL = 60 * 60_000; // 1 hour

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json({ gosell: cache.gosell, hopeful: cache.hopeful });
  }

  // Fetch last 7 days to capture all active numbers
  const now = new Date();
  const start = toStamp(new Date(now.getTime() - 7 * 24 * 3600_000));
  const end = toStamp(now);

  const gosellMap = new Map<string, string>(); // ext -> orekaName
  const hopefulMap = new Map<string, string>();

  await streamTalkTimeForRange(start, end, async (partial) => {
    for (const a of partial) {
      const map = a.account === "hopeful" ? hopefulMap : gosellMap;
      if (!map.has(a.orekaExt)) map.set(a.orekaExt, a.orekaName || "");
    }
  });

  const toList = (m: Map<string, string>) =>
    [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ext, name]) => ({ ext, name }));

  cache = { at: Date.now(), gosell: toList(gosellMap), hopeful: toList(hopefulMap) };
  return NextResponse.json({ gosell: cache.gosell, hopeful: cache.hopeful });
}
