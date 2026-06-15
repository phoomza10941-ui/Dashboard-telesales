// lib/call-summary.ts
import OpenAI from "openai";
import { adminClient } from "./supabase/admin";
import { getOrekaToken, refreshOrekaToken } from "./oreka";
import type { AccountId } from "./oreka";
import { toOrekaStamp } from "./oreka-format";

const BASE = process.env.OREKA_BASE_URL ?? "";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการฝึกอบรมพนักงานขาย Telesales ในประเทศไทย
วิเคราะห์บทสนทนาที่ถอดความมาแล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

รูปแบบ JSON:
{
  "summary": "สรุปบทสนทนา 2-3 ประโยค: ลูกค้าสนใจอะไร มีข้อโต้แย้งอะไร ผลลัพธ์คืออะไร",
  "coaching_tips": [
    "คำแนะนำที่ 1 (เฉพาะเจาะจง เช่น วิธีตอบข้อโต้แย้ง หรือเทคนิคปิดการขาย)",
    "คำแนะนำที่ 2"
  ]
}

coaching_tips ต้องมี 2-3 ข้อ เป็นคำแนะนำที่ปฏิบัติได้จริง ไม่ใช่คำทั่วไป`;

export interface CallSummaryResult {
  recordingId: string;
  phone: string;
  summary: string;
  coachingTips: string[];
  duration: number;
  calledAt: string;
}

export interface SavedCallSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

// Download audio buffer from Oreka mediastream
async function downloadAudio(recordingId: number | string, accountId: AccountId): Promise<Buffer> {
  if (!BASE) throw new Error("OREKA_BASE_URL not configured");
  const url = `${BASE}/orktrack/rest/mediastream/${recordingId}`;

  async function doFetch(token: string) {
    return fetch(url, { headers: { Authorization: token } });
  }

  let token = await getOrekaToken(accountId);
  let res = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    token = await refreshOrekaToken(accountId);
    res = await doFetch(token);
  }
  if (!res.ok) throw new Error(`Oreka audio download failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Transcribe audio buffer with OpenAI Whisper
async function transcribe(audioBuffer: Buffer, recordingId: string): Promise<string> {
  const file = new File([new Uint8Array(audioBuffer)], `recording-${recordingId}.wav`, { type: "audio/wav" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "th",
  });
  return result.text;
}

// Summarize transcript with GPT-4o
async function summarize(transcript: string): Promise<{ summary: string; coaching_tips: string[] }> {
  if (!transcript.trim()) {
    return { summary: "ไม่พบเนื้อหาการสนทนา", coaching_tips: [] };
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SUMMARY_PROMPT },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary ?? "ไม่สามารถสรุปได้",
      coaching_tips: Array.isArray(parsed.coaching_tips) ? parsed.coaching_tips : [],
    };
  } catch {
    return { summary: raw, coaching_tips: [] };
  }
}

// Find the most recent Oreka recording between this agent and the given customer phone (last 7 days)
async function findLatestRecording(
  orekaExtGosell: string,
  orekaExtHopeful: string,
  customerPhone: string,
): Promise<{ id: number; duration: number; calledAt: string; accountId: AccountId } | null> {
  if (!BASE) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const startUtc = toOrekaStamp(sevenDaysAgo);
  const endUtc = toOrekaStamp(now);

  const pairs: Array<{ ext: string; accountId: AccountId }> = [];
  if (orekaExtGosell)  pairs.push({ ext: orekaExtGosell,  accountId: "gosell" });
  if (orekaExtHopeful) pairs.push({ ext: orekaExtHopeful, accountId: "hopeful" });

  let best: { id: number; duration: number; calledAt: string; accountId: AccountId } | null = null;

  for (const { ext, accountId } of pairs) {
    try {
      const url =
        `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
        `&page=1&pagesize=1000&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;

      let token = await getOrekaToken(accountId);
      let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
      if (res.status === 401 || res.status === 403) {
        token = await refreshOrekaToken(accountId);
        res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
      }
      if (!res.ok) continue;

      const data = await res.json();
      for (const r of data?.objects ?? []) {
        if (r.localParty !== ext || r.remoteParty !== customerPhone) continue;
        if (!best || r.timestamp > best.calledAt) {
          best = { id: r.id, duration: Number(r.duration) || 0, calledAt: r.timestamp, accountId };
        }
      }
    } catch (e) {
      console.error(`[call-summary] findLatestRecording (${accountId}) failed:`, e);
    }
  }

  return best;
}

// Main entry: generate summary for a customer phone number (manual trigger)
export async function generateSummaryForPhone(
  agentId: string,
  orekaExtGosell: string,
  orekaExtHopeful: string,
  customerPhone: string,
): Promise<CallSummaryResult | null> {
  const recording = await findLatestRecording(orekaExtGosell, orekaExtHopeful, customerPhone);
  if (!recording) return null;

  // Return cached result if already processed
  const { data: existing } = await adminClient
    .from("call_summaries")
    .select("*")
    .eq("recording_id", String(recording.id))
    .single();

  if (existing) {
    return {
      recordingId: existing.recording_id,
      phone: existing.phone,
      summary: existing.summary,
      coachingTips: Array.isArray(existing.coaching_tips) ? existing.coaching_tips : [],
      duration: existing.duration ?? 0,
      calledAt: existing.called_at ?? "",
    };
  }

  // Process new recording
  const audioBuffer = await downloadAudio(recording.id, recording.accountId);
  const transcript = await transcribe(audioBuffer, String(recording.id));
  const { summary, coaching_tips } = await summarize(transcript);

  const { error: insertError } = await adminClient.from("call_summaries").insert({
    agent_id: agentId,
    recording_id: String(recording.id),
    phone: customerPhone,
    duration: recording.duration,
    called_at: recording.calledAt,
    transcript,
    summary,
    coaching_tips,
  });
  if (insertError) console.error("[call-summary] insert failed:", insertError);

  return {
    recordingId: String(recording.id),
    phone: customerPhone,
    summary,
    coachingTips: coaching_tips,
    duration: recording.duration,
    calledAt: recording.calledAt,
  };
}

// Fetch saved summaries for a customer phone (for customer profile display)
export async function getSummariesForPhone(
  agentId: string,
  phone: string,
): Promise<SavedCallSummary[]> {
  const { data } = await adminClient
    .from("call_summaries")
    .select("id, summary, coaching_tips, duration, called_at, created_at")
    .eq("agent_id", agentId)
    .eq("phone", phone)
    .not("transcript", "is", null)
    .order("called_at", { ascending: false })
    .limit(5);

  return (data ?? []).map((r) => ({
    id: r.id,
    summary: r.summary,
    coachingTips: Array.isArray(r.coaching_tips) ? r.coaching_tips : [],
    duration: r.duration,
    calledAt: r.called_at,
    createdAt: r.created_at,
  }));
}
