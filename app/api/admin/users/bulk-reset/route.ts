import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser();
  if (!caller || caller.role !== "supervisor")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { password } = await req.json();
  if (!password || password.length < 6)
    return NextResponse.json({ error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

  const { data: authUsers, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 500 });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const results = await Promise.allSettled(
    (authUsers?.users ?? []).map((u) =>
      adminClient.auth.admin.updateUserById(u.id, { password })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0)
    return NextResponse.json({ error: `Reset ล้มเหลว ${failed} บัญชี` }, { status: 500 });

  return NextResponse.json({ success: true, count: results.length });
}
