import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateAppointmentStatus, deleteAppointment } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  if (status !== "completed" && status !== "cancelled") {
    return NextResponse.json({ error: "status must be completed or cancelled" }, { status: 400 });
  }

  await updateAppointmentStatus(id, user.id, status);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteAppointment(id, user.id);
  return NextResponse.json({ ok: true });
}
