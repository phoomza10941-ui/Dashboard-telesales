import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiExtractionFields, setAiExtractionFields, AiExtractionFields } from "@/lib/db";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fields = await getAiExtractionFields();
  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fields = await req.json() as AiExtractionFields;
  await setAiExtractionFields(fields);
  return NextResponse.json({ ok: true });
}
