import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";

function normalizeExt(val: string): string | null {
  const s = val.trim();
  if (!s) return null;
  if (s.startsWith("+66")) return s;
  if (s.startsWith("66")) return "+" + s;
  if (s.startsWith("0")) return "+66" + s.slice(1);
  return s;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orekaExtGosell, orekaExtHopeful } = body as Record<string, string>;

  const { error } = await adminClient.from("profiles").update({
    oreka_ext: normalizeExt(orekaExtGosell ?? ""),
    oreka_ext_hopeful: normalizeExt(orekaExtHopeful ?? ""),
  }).eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
