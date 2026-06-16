import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiExtractionFields } from "@/lib/db";
import { getProductKnowledge } from "@/lib/notion";
import { extractCustomerInfo } from "@/lib/call-summary";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript } = await req.json() as { transcript: string };
  if (!transcript?.trim()) return NextResponse.json({ error: "transcript required" }, { status: 400 });

  const [fields, productKnowledge] = await Promise.all([
    getAiExtractionFields(),
    getProductKnowledge(),
  ]);

  const extracted = await extractCustomerInfo(transcript, fields as unknown as Record<string, boolean>, productKnowledge);
  return NextResponse.json({ extracted });
}
