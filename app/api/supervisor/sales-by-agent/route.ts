import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getSalesByAgent } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }

  const rows = await getSalesByAgent(agentId);
  return NextResponse.json({ rows });
}
