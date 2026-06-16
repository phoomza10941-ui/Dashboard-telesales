import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAiExtractionFields, setAiExtractionFields, AiExtractionFields,
  getCoachingPromptOverride, setCoachingPromptOverride,
} from "@/lib/db";
import { getProductKnowledge, clearProductKnowledgeCache } from "@/lib/notion";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [fields, coachingOverride, notionPreview] = await Promise.all([
    getAiExtractionFields(),
    getCoachingPromptOverride(),
    getProductKnowledge(),
  ]);

  return NextResponse.json({
    fields,
    coachingOverride,
    notionConnected: !!process.env.NOTION_TOKEN,
    notionPreview: notionPreview ? notionPreview.slice(0, 600) : "",
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    fields?: AiExtractionFields;
    coachingOverride?: string;
    forceSync?: boolean;
  };

  if (body.forceSync) {
    clearProductKnowledgeCache();
    const preview = await getProductKnowledge();
    return NextResponse.json({ ok: true, notionPreview: preview.slice(0, 600) });
  }

  const ops: Promise<void>[] = [];
  if (body.fields) ops.push(setAiExtractionFields(body.fields));
  if (body.coachingOverride !== undefined) ops.push(setCoachingPromptOverride(body.coachingOverride));
  await Promise.all(ops);

  return NextResponse.json({ ok: true });
}
