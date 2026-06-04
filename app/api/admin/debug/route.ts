import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, nickname, role");
  return NextResponse.json({ profiles: data, error });
}

export async function POST(req: Request) {
  const { id, role } = await req.json();
  const { data, error } = await adminClient
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .select();
  return NextResponse.json({ updated: data, error });
}
