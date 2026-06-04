import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("id, nickname, full_name, role, team, agent_code, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 500 });
  const banMap: Record<string, string | null> = {};
  for (const u of authUsers?.users ?? []) {
    banMap[u.id] = (u as { banned_until?: string }).banned_until ?? null;
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    banned: !!(banMap[p.id] && new Date(banMap[p.id]!) > new Date()),
  }));

  return NextResponse.json({ users });
}
