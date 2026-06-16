import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const caller = await getCurrentUser();
  if (!caller || caller.role !== "supervisor")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fullName, nickname, username, password, role, team } = await req.json();

  if (!fullName || !nickname || !username || !password)
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ error: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

  const { data: existingNick } = await adminClient.from("profiles").select("id").eq("nickname", nickname).single();
  if (existingNick) return NextResponse.json({ error: "Nickname นี้ถูกใช้แล้ว" }, { status: 409 });

  const agentCode = `tele-${nickname}`;
  const userRole = role === "supervisor" ? "supervisor" : "agent";

  const { data, error } = await adminClient.auth.admin.createUser({
    email: `${username}@telesales.internal`,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, nickname, agent_code: agentCode, team: team ?? "", role: userRole },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data.user) {
    const { error: upsertError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      nickname,
      agent_code: agentCode,
      team: team ?? "",
      role: userRole,
    }, { onConflict: "id" });
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
