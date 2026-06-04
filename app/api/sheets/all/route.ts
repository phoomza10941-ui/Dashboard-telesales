import { NextResponse } from "next/server";
import { getAllAgentsData } from "@/lib/google-sheets";

// GET /api/sheets/all — ใช้ใน War Room + Supervisor
export async function GET() {
  try {
    const data = await getAllAgentsData();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("Sheets API error:", err);
    return NextResponse.json({ error: "Failed to fetch sheet data" }, { status: 500 });
  }
}
