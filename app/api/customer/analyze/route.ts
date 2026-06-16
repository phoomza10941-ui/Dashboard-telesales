import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, downloadAudio, extractCustomerInfo } from "@/lib/call-summary";
import { getAiExtractionFields } from "@/lib/db";
import { getProductKnowledge } from "@/lib/notion";
import type { AccountId } from "@/lib/oreka";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaRecordingId, account } = (await req.json()) as {
    orekaRecordingId: string;
    account?: AccountId;
  };
  if (!orekaRecordingId) {
    return NextResponse.json({ error: "orekaRecordingId required" }, { status: 400 });
  }

  try {
    const { buffer, format } = await downloadAudio(
      orekaRecordingId,
      account ?? "gosell",
    );
    const transcript = await transcribeAudio(buffer, format, orekaRecordingId);
    if (!transcript) {
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const [enabledFields, productKnowledge] = await Promise.all([
      getAiExtractionFields(),
      getProductKnowledge(),
    ]);

    const fields = await extractCustomerInfo(
      transcript,
      enabledFields as unknown as Record<string, boolean>,
      productKnowledge,
    );

    return NextResponse.json({ fields, transcript });
  } catch (err) {
    console.error("[customer/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
