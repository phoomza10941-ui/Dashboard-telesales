import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const res = NextResponse.json({ success: true });
  res.cookies.set("user-role", "", { path: "/", maxAge: 0 });
  return res;
}
