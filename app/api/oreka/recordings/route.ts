import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecordingsForExt } from "@/lib/oreka";
import { thaiDateRangeUtc } from "@/lib/oreka-format";
import type { AccountId } from "@/lib/oreka";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ext = req.nextUrl.searchParams.get("ext");
  const account = req.nextUrl.searchParams.get("account") as AccountId | null;
  const date = req.nextUrl.searchParams.get("date");

  if (!ext || !account || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Provide ?ext=+66...&account=gosell|hopeful&date=YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const { startUtc, endUtc } = thaiDateRangeUtc(date);
    const recs = await getRecordingsForExt(startUtc, endUtc, ext, account);
    return Response.json({ recordings: recs });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
