import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, setExtractionRules } from "@/lib/db";
import type { ExtractionRules } from "@/lib/extraction-config";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as ExtractionRules;
  await setExtractionRules({
    fieldRules: body.fieldRules ?? {},
    extraRules: body.extraRules ?? "",
  });
  return NextResponse.json({ ok: true });
}
