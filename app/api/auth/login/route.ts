import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password)
    return NextResponse.json({ error: "กรุณากรอก Username และ Password" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${username.toLowerCase().trim()}@telesales.internal`,
    password,
  });

  if (error || !data.user)
    return NextResponse.json({ error: "Username หรือ Password ไม่ถูกต้อง" }, { status: 401 });

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role ?? "agent";

  // Keep user_metadata.role in sync so proxy can read it from the JWT
  if (data.user.user_metadata?.role !== role) {
    await adminClient.auth.admin.updateUserById(data.user.id, {
      user_metadata: { ...data.user.user_metadata, role },
    });
  }

  const res = NextResponse.json({ success: true, role });
  res.cookies.set("user-role", role, { path: "/", httpOnly: false, sameSite: "lax" });
  return res;
}
