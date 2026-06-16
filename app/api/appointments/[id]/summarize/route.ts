import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser, getMyData, updateAppointmentPreSuggestion } from "@/lib/db";
import { getSummariesForPhone } from "@/lib/call-summary";
import { adminClient } from "@/lib/supabase/admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch the appointment (verify ownership)
  const { data: appt, error: apptErr } = await adminClient
    .from("appointments")
    .select("id, customer_name, customer_phone, pre_suggestion")
    .eq("id", id)
    .eq("agent_id", user.id)
    .single();

  if (apptErr || !appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  // Return cached suggestion if already generated
  if (appt.pre_suggestion) {
    return NextResponse.json({ suggestion: appt.pre_suggestion });
  }

  const phone: string = appt.customer_phone ?? "";
  const customerName: string = appt.customer_name ?? "";

  // Gather context: call summaries + sale note history
  const [callSummaries, myData] = await Promise.all([
    phone ? getSummariesForPhone(user.id, phone).catch(() => []) : Promise.resolve([]),
    getMyData(user.id),
  ]);

  const allRows = myData?.rows ?? [];
  const customerRows = allRows.filter(
    (r) =>
      (phone && r.phone?.trim() === phone.trim()) ||
      r.name?.trim().toLowerCase() === customerName.trim().toLowerCase()
  );

  // Build context block for the prompt
  const callSummaryBlock =
    callSummaries.length > 0
      ? callSummaries
          .slice(0, 3)
          .map(
            (s, i) =>
              `[บทสรุปการโทรครั้งที่ ${i + 1} — ${s.calledAt ? new Date(s.calledAt).toLocaleDateString("th-TH") : "ไม่ทราบวันที่"}]\n${s.summary}${s.coachingTips?.length ? `\nCoaching tips: ${s.coachingTips.join(" / ")}` : ""}`
          )
          .join("\n\n")
      : "ไม่มีบทสรุปการโทร";

  const noteBlock =
    customerRows.length > 0
      ? customerRows
          .slice(-5)
          .map((r) => `- [${r.date}] ${r.product || "—"} | note: ${r.note || "—"}`)
          .join("\n")
      : "ไม่มีประวัติในระบบ";

  const prompt = `คุณคือผู้ช่วย AI สำหรับพนักงานขายทางโทรศัพท์ (Telesales) ชาวไทย

ลูกค้า: "${customerName}"${phone ? ` (${phone})` : ""}

ประวัติบทสรุปการโทร:
${callSummaryBlock}

ประวัติการขาย/บันทึก:
${noteBlock}

จากข้อมูลด้านบน กรุณาเขียน "คำแนะนำก่อนโทร" สำหรับพนักงาน เพื่อใช้ในการนัดหมายครั้งนี้
- ความยาว 1-2 ประโยค กระชับ ได้ใจความ
- ระบุว่าลูกค้าสนใจอะไร ติดปัญหาอะไร และควรพูดถึงอะไรในการโทรครั้งนี้
- ตอบเป็นภาษาไทยเท่านั้น ห้ามมีหัวข้อหรือ prefix ใดๆ`;

  let suggestion = "";
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.4,
    });
    suggestion = resp.choices[0]?.message?.content?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "ai_failed" }, { status: 500 });
  }

  if (!suggestion) {
    return NextResponse.json({ error: "empty_response" }, { status: 500 });
  }

  await updateAppointmentPreSuggestion(id, user.id, suggestion);

  return NextResponse.json({ suggestion });
}
