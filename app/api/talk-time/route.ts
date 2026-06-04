import { NextRequest, NextResponse } from "next/server";
import { getTalkTimeByDateSafe, getTalkTimeByMonthSafe } from "@/lib/oreka";
import { getOrekaLabels } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dateKey = req.nextUrl.searchParams.get("date");
  const monthKey = req.nextUrl.searchParams.get("month");

  if (monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return NextResponse.json({ error: "Invalid month — use YYYY-MM" }, { status: 400 });
    }
    const [talkTime, labels] = await Promise.all([getTalkTimeByMonthSafe(monthKey), getOrekaLabels()]);
    return NextResponse.json({ ...talkTime, labels });
  }

  if (dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return NextResponse.json({ error: "Invalid date — use YYYY-MM-DD" }, { status: 400 });
    }
    const [talkTime, labels] = await Promise.all([getTalkTimeByDateSafe(dateKey), getOrekaLabels()]);
    return NextResponse.json({ ...talkTime, labels });
  }

  return NextResponse.json({ error: "Provide ?date=YYYY-MM-DD or ?month=YYYY-MM" }, { status: 400 });
}
