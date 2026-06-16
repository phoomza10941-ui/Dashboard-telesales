import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayRecordingsForExts } from "@/lib/oreka";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exts = req.nextUrl.searchParams.get("exts") ?? "";
  const extList = exts.split(",").map((e) => e.trim()).filter(Boolean);
  if (extList.length === 0) return NextResponse.json({ recordings: [] });

  try {
    const recordings = await getTodayRecordingsForExts(extList);
    return NextResponse.json({ recordings });
  } catch {
    return NextResponse.json({ recordings: [] });
  }
}
