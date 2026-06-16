import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateSale, deleteSale } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";

async function broadcast() {
  const ch = adminClient.channel("sales-update");
  await new Promise<void>((resolve) => {
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "sale_added", payload: {} }).then(() => {
          adminClient.removeChannel(ch);
          resolve();
        });
      }
    });
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  await updateSale(id, user.id, {
    date: body.date ?? "",
    name: body.name ?? "",
    phone: body.phone ?? "",
    address: body.address ?? "",
    product: body.product ?? "",
    phoneClose: parseFloat(body.phoneClose) || 0,
    upsell: parseFloat(body.upsell) || 0,
    crm: parseFloat(body.crm) || 0,
    hopefulPhoneClose: parseFloat(body.hopefulPhoneClose) || 0,
    hopefulCrm: parseFloat(body.hopefulCrm) || 0,
    hopefulUpsell: parseFloat(body.hopefulUpsell) || 0,
    note: body.note ?? "",
    channel: body.channel === "gosell" || body.channel === "hopeful" ? body.channel : undefined,
  });

  await broadcast();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteSale(id, user.id);
  await broadcast();
  return NextResponse.json({ ok: true });
}
