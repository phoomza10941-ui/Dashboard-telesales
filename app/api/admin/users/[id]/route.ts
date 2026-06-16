import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await getCurrentUser();
  if (!caller || caller.role !== "supervisor")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, value } = body as { action: string; value?: string };

  if (action === "reset-password") {
    if (!value || value.length < 6)
      return NextResponse.json({ error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    const { error } = await adminClient.auth.admin.updateUserById(id, { password: value });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "change-role") {
    if (value !== "agent" && value !== "supervisor")
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    const [profileRes, metaRes] = await Promise.all([
      adminClient.from("profiles").update({ role: value }).eq("id", id),
      adminClient.auth.admin.updateUserById(id, { user_metadata: { role: value } }),
    ]);
    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    if (metaRes.error) return NextResponse.json({ error: metaRes.error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "deactivate") {
    const { error } = await adminClient.auth.admin.updateUserById(id, { ban_duration: "87600h" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "reactivate") {
    const { error } = await adminClient.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
