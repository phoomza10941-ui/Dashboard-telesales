// app/api/call-summary/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";
import { generateSummaryForPhone } from "@/lib/call-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { phone } = body as { phone?: string };
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaExtGosell, orekaExtHopeful } = currentUser;
  if (!orekaExtGosell && !orekaExtHopeful) {
    return NextResponse.json({ error: "no_oreka_ext" }, { status: 400 });
  }

  try {
    const result = await generateSummaryForPhone(user.id, orekaExtGosell, orekaExtHopeful, phone);
    if (!result) return NextResponse.json({ error: "no_recording" }, { status: 404 });

    return NextResponse.json({
      summary: result.summary,
      coachingTips: result.coachingTips,
      duration: result.duration,
      calledAt: result.calledAt,
      transcript: result.transcript ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "AUDIO_UNCLEAR" || msg === "whisper_hallucination") {
      return NextResponse.json({ error: "audio_unclear" }, { status: 422 });
    }
    console.error("[call-summary/generate]", e);
    return NextResponse.json({ error: "pipeline_failed" }, { status: 500 });
  }
}
