import { NextRequest, NextResponse } from "next/server";
import { getMyData } from "@/lib/google-sheets";

// GET /api/sheets/agent?name=สมชาย
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  try {
    const data = await getMyData(name);
    if (!data) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("Sheets API error:", err);
    return NextResponse.json({ error: "Failed to fetch sheet data" }, { status: 500 });
  }
}
