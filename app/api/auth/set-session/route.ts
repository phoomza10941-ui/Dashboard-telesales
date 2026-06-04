import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { adminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json();
  if (!access_token || !refresh_token)
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Set the session server-side so cookies are stored properly
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !data.user)
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // Read role from profiles
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role ?? "agent";
  console.log("[set-session] user:", data.user.id, "role from DB:", role);

  const res = NextResponse.json({ success: true, role });
  res.cookies.set("user-role", role, { path: "/", httpOnly: false, sameSite: "lax" });
  return res;
}
