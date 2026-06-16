import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecordingsForExtsOnDate } from "@/lib/oreka";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exts = req.nextUrl.searchParams.get("exts") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Missing or invalid date (expected YYYY-MM-DD)" }, { status: 400 });
  }

  const extList = exts.split(",").map((e) => e.trim()).filter(Boolean);
  if (extList.length === 0) return NextResponse.json({ recordings: [] });

  try {
    const recordings = await getRecordingsForExtsOnDate(extList, date);
    return NextResponse.json({ recordings });
  } catch {
    return NextResponse.json({ recordings: [] });
  }
}
