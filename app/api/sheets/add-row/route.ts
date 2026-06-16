import { NextRequest, NextResponse } from "next/server";
import { addSale, getCurrentUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const body = await req.json();
    const { date, name, phone, address, product, quantity, phoneClose, upsell, crm, hopefulPhoneClose, hopefulCrm, hopefulUpsell, note, channel } = body;
    if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อลูกค้า" }, { status: 400 });

    await addSale(user.id, {
      date: date || "",
      name: name || "",
      phone: phone || "",
      address: address || "",
      product: product || "",
      quantity: parseInt(quantity) || 1,
      phoneClose: parseFloat(phoneClose) || 0,
      upsell: parseFloat(upsell) || 0,
      crm: parseFloat(crm) || 0,
      hopefulPhoneClose: parseFloat(hopefulPhoneClose) || 0,
      hopefulCrm: parseFloat(hopefulCrm) || 0,
      hopefulUpsell: parseFloat(hopefulUpsell) || 0,
      note: note || "",
      channel: channel === "gosell" || channel === "hopeful" ? channel : "",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("add sale error:", err);
    return NextResponse.json({ error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
