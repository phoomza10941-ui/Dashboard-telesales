import { NextRequest } from "next/server";
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
  if (!user) {
    return new Response(JSON.stringify({ type: "error", message: "Unauthorized" }), { status: 401 });
  }

  const { orekaRecordingId, account } = (await req.json()) as {
    orekaRecordingId: string;
    account?: AccountId;
  };
  if (!orekaRecordingId) {
    return new Response(JSON.stringify({ type: "error", message: "orekaRecordingId required" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        send({ type: "progress", pct: 5, label: "⬇️ ดาวน์โหลดเสียง..." });
        const { buffer, format } = await downloadAudio(orekaRecordingId, account ?? "gosell");

        send({ type: "progress", pct: 33, label: "📝 ถอดเสียงด้วย Whisper..." });
        const transcript = await transcribeAudio(buffer, format, orekaRecordingId);
        if (!transcript) {
          send({ type: "error", message: "ถอดเสียงไม่สำเร็จ" });
          controller.close();
          return;
        }

        send({ type: "progress", pct: 70, label: "🧠 วิเคราะห์ด้วย AI..." });
        const [enabledFields, productKnowledge] = await Promise.all([
          getAiExtractionFields(),
          getProductKnowledge(),
        ]);
        const fields = await extractCustomerInfo(
          transcript,
          enabledFields as unknown as Record<string, boolean>,
          productKnowledge,
        );

        send({ type: "done", pct: 100, fields, transcript });
        controller.close();
      } catch (err) {
        console.error("[customer/analyze]", err);
        send({ type: "error", message: err instanceof Error ? err.message : "Analysis failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
