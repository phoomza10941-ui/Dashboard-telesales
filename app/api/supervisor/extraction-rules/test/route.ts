import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getAiExtractionFields } from "@/lib/db";
import { extractCustomerInfo } from "@/lib/call-summary";
import type { ExtractionRules } from "@/lib/extraction-config";

export const maxDuration = 60;

// Run extraction with the supervisor's (possibly unsaved) rules against a pasted
// transcript, so they can preview the result before saving. Product knowledge is
// skipped here — this tool is for verifying the field rules, and skipping it keeps
// the preview fast.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { transcript, rules } = (await req.json()) as {
    transcript: string;
    rules: ExtractionRules;
  };
  if (!transcript || !transcript.trim()) {
    return NextResponse.json({ error: "กรุณาวางบทสนทนาก่อนทดสอบ" }, { status: 400 });
  }
  try {
    const enabledFields = await getAiExtractionFields();
    const fields = await extractCustomerInfo(
      transcript,
      enabledFields as unknown as Record<string, boolean>,
      "",
      rules ?? { fieldRules: {}, extraRules: "" },
    );
    return NextResponse.json({ fields });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
