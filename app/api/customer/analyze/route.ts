import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeAudio, downloadAudio, extractCustomerInfo } from "@/lib/call-summary";
import { getAiExtractionFields, getExtractionRules } from "@/lib/db";
import { getProductKnowledge } from "@/lib/notion";
import type { AccountId } from "@/lib/oreka";

// Audio download + Whisper transcription of a long call can take well over a
// minute; give the function room so Vercel doesn't kill it mid-transcription.
export const maxDuration = 300;

/** Map internal error messages to actionable Thai for the agent. */
function friendlyErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return "ใช้เวลาประมวลผลนานเกินไป กรุณาลองใหม่อีกครั้ง";
  }
  if (
    raw.includes("AUDIO_UNCLEAR") ||
    raw.includes("whisper") ||
    raw.includes("hallucinat") ||
    raw === "transcription_failed"
  ) {
    return "สายนี้เสียงไม่ชัดหรือไม่มีบทสนทนา — ลองเลือกสายอื่น";
  }
  if (raw.includes("download failed") || raw.includes("HTTP")) {
    return "ดึงไฟล์เสียงจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
  return raw;
}

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
          send({ type: "error", message: "สายนี้เสียงไม่ชัดหรือไม่มีบทสนทนา — ลองเลือกสายอื่น" });
          controller.close();
          return;
        }

        send({ type: "progress", pct: 70, label: "🧠 วิเคราะห์ด้วย AI..." });
        console.log("[customer/analyze] fetching AI context (fields + product knowledge)...");
        const [enabledFields, productKnowledge, extractionRules] = await Promise.all([
          getAiExtractionFields(),
          getProductKnowledge(),
          getExtractionRules(),
        ]);
        console.log(`[customer/analyze] AI context ready (fields=${Object.keys(enabledFields).length}, pk=${productKnowledge.length} chars); extracting...`);
        const fields = await extractCustomerInfo(
          transcript,
          enabledFields as unknown as Record<string, boolean>,
          productKnowledge,
          extractionRules,
        );
        console.log("[customer/analyze] extraction complete:", Object.keys(fields));

        send({ type: "done", pct: 100, fields, transcript });
        controller.close();
      } catch (err) {
        console.error("[customer/analyze]", err);
        const raw = err instanceof Error ? err.message : "Analysis failed";
        const message = friendlyErrorMessage(raw);
        send({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
