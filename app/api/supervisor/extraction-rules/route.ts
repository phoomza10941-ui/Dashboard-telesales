import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setExtractionRules } from "@/lib/db";
import type { ExtractionRules } from "@/lib/extraction-config";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as ExtractionRules;
    await setExtractionRules({
      fieldRules: body.fieldRules ?? {},
      extraRules: body.extraRules ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[extraction-rules POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
