import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProductKnowledge } from "@/lib/notion";

// Lazy preview of the product knowledge the AI sees. Kept off the bot-config
// page's server render so the page loads instantly; fetched only when the
// supervisor expands "ดูตัวอย่างที่ AI เห็น".
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const preview = await getProductKnowledge();
  return NextResponse.json({ preview: preview ?? "" });
}
