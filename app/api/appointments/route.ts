import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAppointments, createAppointment } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  const appointments = await getAppointments(user.id, { date, month });
  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { customerName, customerPhone, appointmentDate, preSuggestion } = body;

  if (!customerName || !appointmentDate) {
    return NextResponse.json({ error: "customerName and appointmentDate are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return NextResponse.json({ error: "appointmentDate must be YYYY-MM-DD" }, { status: 400 });
  }

  const appointment = await createAppointment(user.id, {
    customerName,
    customerPhone: customerPhone ?? "",
    appointmentDate,
    preSuggestion: preSuggestion ?? "",
  });

  return NextResponse.json({ appointment }, { status: 201 });
}
