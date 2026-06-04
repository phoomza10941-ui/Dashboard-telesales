import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateSaleNote } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, note } = await req.json();
  if (!id || typeof note !== "string") {
    return NextResponse.json({ error: "Missing id or note" }, { status: 400 });
  }

  await updateSaleNote(id, note);

  // broadcast to all open tabs so War Room / Supervisor refresh instantly
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

  return NextResponse.json({ ok: true });
}
