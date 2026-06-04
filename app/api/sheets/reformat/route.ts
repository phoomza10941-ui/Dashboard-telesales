import { NextRequest, NextResponse } from "next/server";
import { reformatAgentSheet } from "@/lib/google-sheets";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { nickname } = await req.json();
    const target = nickname ?? session.agentName;
    await reformatAgentSheet(target);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reformat error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
