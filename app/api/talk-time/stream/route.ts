import { NextRequest } from "next/server";
import { streamTalkTimeForRange } from "@/lib/oreka";
import { getOrekaLabels } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function thaiDateRangeUtc(dateKey: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toStamp = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const startMs = new Date(`${dateKey}T00:00:00Z`).getTime() - 7 * 3600_000;
  return { startUtc: toStamp(new Date(startMs)), endUtc: toStamp(new Date(startMs + 24 * 3600_000)) };
}

function thaiMonthRangeUtc(monthKey: string) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toStamp = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const [y, m] = monthKey.split("-").map(Number);
  const startMs = new Date(`${monthKey}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const endMs = new Date(`${nextMonth}-01T00:00:00Z`).getTime() - 7 * 3600_000;
  return { startUtc: toStamp(new Date(startMs)), endUtc: toStamp(new Date(endMs)) };
}

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
