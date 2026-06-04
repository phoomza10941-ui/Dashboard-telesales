import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getCustomerHistoryByPhone } from "@/lib/db";
import { parseNoteStatus } from "@/lib/note-utils";

function todayDMY() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${now.getUTCFullYear()}`;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";
  if (!phone) return NextResponse.json({ found: false, history: [], hasToday: false });

  const rows = await getCustomerHistoryByPhone(phone, user.id);
  if (rows.length === 0) return NextResponse.json({ found: false, history: [], hasToday: false });

  const today = todayDMY();
  const hasToday = rows.some((r) => r.date === today);

  const history = rows.map((r) => ({
    id: r.id,
    date: r.date,
    product: r.product,
    total: r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell,
    note: r.note,
    status: parseNoteStatus(r.note),
    name: r.name,
    address: r.address,
  }));

  return NextResponse.json({ found: true, history, hasToday });
}
