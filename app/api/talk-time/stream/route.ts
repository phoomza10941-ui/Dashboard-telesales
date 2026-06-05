import { NextRequest } from "next/server";
import { streamTalkTimeForRange } from "@/lib/oreka";
import { thaiDateRangeUtc, thaiMonthRangeUtc } from "@/lib/oreka-format";
import { getOrekaLabels } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const dateKey = req.nextUrl.searchParams.get("date");
  const monthKey = req.nextUrl.searchParams.get("month");

  let range: { startUtc: string; endUtc: string } | null = null;
  if (dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) range = thaiDateRangeUtc(dateKey);
  else if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) range = thaiMonthRangeUtc(monthKey);
  else return new Response("Provide ?date=YYYY-MM-DD or ?month=YYYY-MM", { status: 400 });

  const labels = await getOrekaLabels();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      try {
        await streamTalkTimeForRange(range!.startUtc, range!.endUtc, async (partial, pages) => {
          send({ agents: partial, pages, labels, done: false });
        });
        send({ done: true });
      } catch (e) {
        send({ error: e instanceof Error ? e.message : "unknown error", done: true });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
