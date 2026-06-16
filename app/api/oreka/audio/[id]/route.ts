import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrekaToken, refreshOrekaToken } from "@/lib/oreka";
import type { AccountId } from "@/lib/oreka";

export const dynamic = "force-dynamic";

const BASE = process.env.OREKA_BASE_URL ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const account = (req.nextUrl.searchParams.get("account") ?? "gosell") as AccountId;

  if (!BASE) return new Response("Oreka not configured", { status: 503 });

  const audioUrl = `${BASE}/orktrack/rest/mediastream/${id}`;

  async function tryAccount(acct: AccountId) {
    const headers: Record<string, string> = { Authorization: await getOrekaToken(acct) };
    const range = req.headers.get("range");
    if (range) headers["Range"] = range;
    let upstream = await fetch(audioUrl, { headers });
    // Re-login once on 401/403
    if (upstream.status === 401 || upstream.status === 403) {
      headers["Authorization"] = await refreshOrekaToken(acct);
      upstream = await fetch(audioUrl, { headers });
    }
    return upstream;
  }

  const alt: AccountId = account === "gosell" ? "hopeful" : "gosell";
  let upstream = await tryAccount(account);

  if (!upstream.ok && upstream.status !== 206) {
    upstream = await tryAccount(alt);
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(`Oreka returned ${upstream.status}`, { status: upstream.status });
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") ?? "audio/x-wav");
  const len = upstream.headers.get("content-length");
  if (len) responseHeaders.set("Content-Length", len);
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);
  responseHeaders.set("Accept-Ranges", "bytes");
  // Allow browser to cache recordings (they're immutable once recorded)
  responseHeaders.set("Cache-Control", "private, max-age=3600");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
