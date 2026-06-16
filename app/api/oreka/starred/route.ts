import { NextRequest } from "next/server";
import { getCurrentUser, getStarredRecordings, addStar, removeStar } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone") ?? undefined;
  const starred = await getStarredRecordings(user.id, phone);
  return Response.json({ starred });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { recordingId, phone, duration, direction, calledAt } = body as {
    recordingId?: string;
    phone?: string;
    duration?: number;
    direction?: string;
    calledAt?: string;
  };
  if (!recordingId) return Response.json({ error: "recordingId required" }, { status: 400 });

  await addStar(user.id, {
    recordingId,
    phone: phone ?? "",
    duration: Number(duration) || 0,
    direction: direction ?? "",
    calledAt: calledAt ?? "",
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { recordingId } = body as { recordingId?: string };
  if (!recordingId) return Response.json({ error: "recordingId required" }, { status: 400 });

  await removeStar(user.id, recordingId);
  return Response.json({ ok: true });
}
