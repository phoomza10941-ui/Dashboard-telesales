import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isMyDesk = pathname.startsWith("/my-desk");
  const isSupervisor = pathname.startsWith("/supervisor");
  const isAdmin = pathname.startsWith("/admin");
  const isWarRoom = pathname.startsWith("/war-room");

  // Not logged in — send to /login
  if (!user && (isMyDesk || isSupervisor || isAdmin || isWarRoom)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Already logged in — skip /login, route by role
  if (user && pathname === "/login") {
    const role = user.user_metadata?.role ?? "agent";
    const dest = role === "supervisor" ? "/supervisor/team-performance" : "/my-desk/today-command";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/my-desk/:path*", "/supervisor/:path*", "/admin/:path*", "/war-room/:path*", "/login"],
};
