// lib/call-summary.ts
import OpenAI from "openai";
import { adminClient } from "./supabase/admin";
import { getOrekaToken, refreshOrekaToken } from "./oreka";
import type { AccountId } from "./oreka";
import { toOrekaStamp } from "./oreka-format";
import { alaw as alawCodec, mulaw as mulawCodec } from "alawmulaw";
import { getProductKnowledge } from "./notion";

const BASE = process.env.OREKA_BASE_URL ?? "";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Whisper prompt — a SHORT context cue only. A long comma-separated vocab list makes
// Whisper "leak" the prompt words into its output on unclear audio (a documented
// hallucination mode), so keep this to a single natural sentence, not a glossary.
const WHISPER_PROMPT =
  "บทสนทนาทางโทรศัพท์ภาษาไทยระหว่างพนักงานขายกับลูกค้า เกี่ยวกับสินค้า ราคา และการชำระเงิน";

const SUMMARY_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการฝึกอบรมพนักงานขาย Telesales ในประเทศไทย
วิเคราะห์บทสนทนาที่ถอดความมาแล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

กฎสำคัญ:
- สรุปเฉพาะสิ่งที่พูดในบทสนทนาจริง ห้ามเพิ่มข้อมูลที่ไม่มี
- ถ้าบทสนทนาไม่ชัดเจนหรือขาดหาย ให้ระบุว่า "ไม่ชัดเจน" แทนการคาดเดา
- ตัวเลขราคาและชื่อสินค้าต้องตรงตามที่ได้ยิน

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
  transcript: string;
}

export interface SavedCallSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
  transcript: string | null;
}

// Map Oreka Content-Type to a Whisper-safe { ext, mime } pair.
// Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg, flac.
// Oreka typically returns audio/mpeg (MP3) or audio/wav.
function resolveAudioFormat(contentType: string): { ext: string; mime: string } {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  if (ct === "audio/mpeg" || ct === "audio/mp3" || ct === "audio/mpga") return { ext: "mp3", mime: "audio/mpeg" };
  if (ct === "audio/mp4" || ct === "audio/x-m4a" || ct === "audio/m4a")  return { ext: "mp4", mime: "audio/mp4" };
  if (ct === "audio/ogg" || ct === "audio/vorbis")                        return { ext: "ogg", mime: "audio/ogg" };
  if (ct === "audio/webm")                                                 return { ext: "webm", mime: "audio/webm" };
  if (ct === "audio/flac" || ct === "audio/x-flac")                       return { ext: "flac", mime: "audio/flac" };
  // Default: treat as WAV (works for audio/wav, audio/x-wav, audio/pcm, unknown)
  return { ext: "wav", mime: "audio/wav" };
}

// Download audio buffer from Oreka mediastream
export async function downloadAudio(
  recordingId: number | string,
  accountId: AccountId,
): Promise<{ buffer: Buffer; format: { ext: string; mime: string } }> {
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

  const contentType = res.headers.get("content-type") ?? "audio/wav";
  console.log(`[call-summary] Oreka content-type for ${recordingId}: ${contentType}`);

  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), format: resolveAudioFormat(contentType) };
}

// Detect Whisper hallucination. Real transcripts of a sales call are varied; Whisper's
// failure modes on silence/hold-music are (a) one word/phrase looping, (b) very low
// vocabulary diversity, (c) known Thai filler loops. Any of these → treat as unusable.
const HALLUCINATION_PHRASES = [
  "ขอบคุณค่ะ", "ขอบคุณครับ", "สวัสดีค่ะ", "สวัสดีครับ",
  "แล้วเจอกันใหม่", "บ๊ายบาย", "ค่ะค่ะค่ะ",
];

function isHallucination(text: string): boolean {
  const clean = text.trim();
  if (!clean) return true;

  const words = clean.split(/\s+/);
  if (words.length < 6) return false; // too short to judge — let it through

  // (a) any single token repeated a lot
  const seen = new Map<string, number>();
  for (const w of words) {
    const count = (seen.get(w) ?? 0) + 1;
    if (count >= 5) return true;
    seen.set(w, count);
  }

  // (b) low vocabulary diversity (e.g. "ค่ะ ขอบคุณ ค่ะ ขอบคุณ ..." loops)
  const uniqueRatio = seen.size / words.length;
  if (words.length >= 12 && uniqueRatio < 0.25) return true;

  // (c) repeated bigram loop ("ขอบคุณ ค่ะ ขอบคุณ ค่ะ ...")
  const bigrams = new Map<string, number>();
  for (let i = 0; i + 1 < words.length; i++) {
    const bg = words[i] + " " + words[i + 1];
    const c = (bigrams.get(bg) ?? 0) + 1;
    if (c >= 4) return true;
    bigrams.set(bg, c);
  }

  // (d) the whole transcript is just a known filler phrase
  const collapsed = clean.replace(/\s+/g, "");
  if (HALLUCINATION_PHRASES.some((p) => collapsed === p.replace(/\s+/g, "") || collapsed === p.repeat(2))) {
    return true;
  }

  return false;
}

// WAV format tags
const WAV_PCM   = 1;
const WAV_ALAW  = 6;
const WAV_ULAW  = 7;

// Parse a WAV buffer and return its header fields + raw audio data bytes.
function parseWav(buf: Buffer): {
  formatTag: number; channels: number; sampleRate: number;
  bitsPerSample: number; audioData: Buffer;
} | null {
  if (buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let formatTag = 0, channels = 0, sampleRate = 0, bitsPerSample = 0;
  let audioData: Buffer | null = null;

  while (offset + 8 <= buf.length) {
    const chunkId   = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkId === "fmt ") {
      formatTag    = buf.readUInt16LE(offset);
      channels     = buf.readUInt16LE(offset + 2);
      sampleRate   = buf.readUInt32LE(offset + 4);
      bitsPerSample = buf.readUInt16LE(offset + 14);
    } else if (chunkId === "data") {
      audioData = buf.slice(offset, offset + chunkSize);
    }
    offset += chunkSize + (chunkSize % 2); // chunks are word-aligned
  }

  if (!audioData) return null;
  return { formatTag, channels, sampleRate, bitsPerSample, audioData };
}

// Build a minimal PCM WAV file header + data.
function buildPcmWav(samples: Int16Array, sampleRate: number, channels: number): Buffer {
  const dataLen  = samples.length * 2;
  const buf      = Buffer.allocUnsafe(44 + dataLen);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);          // fmt chunk size
  buf.writeUInt16LE(1, 20);           // PCM
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28); // byte rate
  buf.writeUInt16LE(channels * 2, 32); // block align
  buf.writeUInt16LE(16, 34);           // bits per sample
  buf.write("data", 36); buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}

// Convert G.711 (µ-law or A-law) WAV buffer to PCM WAV. Returns original if already PCM.
function decodeG711Wav(input: Buffer): { buffer: Buffer; converted: boolean } {
  const wav = parseWav(input);
  if (!wav) return { buffer: input, converted: false };

  const { formatTag, channels, sampleRate, bitsPerSample, audioData } = wav;
  if (formatTag === WAV_PCM) return { buffer: input, converted: false };

  if (formatTag !== WAV_ULAW && formatTag !== WAV_ALAW) {
    console.log(`[call-summary] WAV format tag ${formatTag} — sending as-is`);
    return { buffer: input, converted: false };
  }

  const codec = formatTag === WAV_ULAW ? "ulaw" : "alaw";
  console.log(`[call-summary] decoding G.711 ${codec} ${sampleRate}Hz ${bitsPerSample}bit`);

  const raw = new Uint8Array(audioData);
  const pcmSamples: Int16Array =
    formatTag === WAV_ULAW
      ? mulawCodec.decode(raw)
      : alawCodec.decode(raw);

  const out = buildPcmWav(pcmSamples, sampleRate, channels);
  return { buffer: out, converted: true };
}

export async function transcribeAudio(
  buffer: Buffer,
  format: { ext: string; mime: string },
  recordingId: string,
): Promise<string> {
  const { buffer: pcm, converted } = decodeG711Wav(buffer);
  if (converted) {
    console.log(`[call-summary] G.711 → PCM WAV conversion done, ${pcm.length} bytes`);
  }

  // gpt-4o-transcribe hallucinates far less than whisper-1 on 8kHz Thai telephony.
  // We try it first and fall back to whisper-1 only if the request itself fails.
  const models = ["gpt-4o-transcribe", "whisper-1"] as const;
  let text = "";
  let lastErr: unknown = null;

  for (const model of models) {
    try {
      const file = new File([new Uint8Array(pcm)], `recording-${recordingId}.wav`, { type: "audio/wav" });
      const result = await openai.audio.transcriptions.create({
        file,
        model,
        language: "th",
        prompt: WHISPER_PROMPT,
        temperature: 0,
      });
      text = result.text;
      console.log(`[call-summary] transcribed ${recordingId} via ${model}, ${text.length} chars`);
      break;
    } catch (e) {
      lastErr = e;
      console.warn(`[call-summary] ${model} failed for ${recordingId}:`, e instanceof Error ? e.message : e);
    }
  }

  if (!text) throw lastErr ?? new Error("transcription_failed");
  if (isHallucination(text)) {
    throw new Error("whisper_hallucination");
  }
  return text;
}

// Summarize transcript with gpt-4o-mini (simple JSON extraction — ~15× cheaper than gpt-4o)
async function summarize(transcript: string, productKnowledge?: string): Promise<{ summary: string; coaching_tips: string[] }> {
  if (!transcript.trim()) {
    return { summary: "ไม่พบเนื้อหาการสนทนา", coaching_tips: [] };
  }
  const systemContent = productKnowledge
    ? `${SUMMARY_PROMPT}\n\nข้อมูลสินค้าของบริษัท (ใช้ชื่อสินค้าจากนี้เสมอ):\n${productKnowledge}`
    : SUMMARY_PROMPT;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
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
      transcript: existing.transcript ?? "",
    };
  }

  // Process new recording
  const { buffer, format } = await downloadAudio(recording.id, recording.accountId);
  const transcript = await transcribeAudio(buffer, format, String(recording.id));
  const productKnowledge = await getProductKnowledge();
  const { summary, coaching_tips } = await summarize(transcript, productKnowledge || undefined);

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
    transcript,
  };
}

// Fetch saved summaries for a customer phone (for customer profile display)
export async function getSummariesForPhone(
  agentId: string,
  phone: string,
): Promise<SavedCallSummary[]> {
  const { data } = await adminClient
    .from("call_summaries")
    .select("id, summary, coaching_tips, duration, called_at, created_at, transcript")
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
    transcript: r.transcript ?? null,
  }));
}

export interface ExtractedCustomerFields {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  diseases?: string;
  symptoms?: string;
  medications?: string;
  consulted_doc?: string;
  patient_type?: string;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  nickname: "ชื่อเล่น",
  diseases: "โรคเป็นอยู่",
  symptoms: "อาการตอนนี้",
  medications: "ยาที่กำลังทานอยู่",
  consulted_doc: "ปรึกษาหมอมั้ย",
  patient_type: "คนที่ทาน",
};

export async function extractCustomerInfo(
  transcript: string,
  enabledFields: Record<string, boolean>,
  productKnowledge: string
): Promise<ExtractedCustomerFields> {
  const activeFields = Object.entries(enabledFields)
    .filter(([, v]) => v)
    .map(([k]) => `- ${FIELD_LABELS[k] ?? k} (field: ${k})`);

  if (activeFields.length === 0) return {};

  const systemPrompt = [
    "คุณเป็น AI ที่ช่วยดึงข้อมูลลูกค้าจากบทสนทนาสายโทรศัพท์ภาษาไทย",
    productKnowledge
      ? `\nข้อมูลสินค้า (context เพิ่มเติม):\n${productKnowledge}`
      : "",
    "\nดึงเฉพาะข้อมูลที่พูดถึงในสายเท่านั้น ถ้าไม่มีการพูดถึง field ใด ให้ละ field นั้นออก",
    "\nส่งกลับเป็น JSON object ที่มี key เป็น field name ด้านล่าง:",
    activeFields.join("\n"),
    "\nกฎ:",
    "- first_name/last_name/nickname: ตรงตามที่พูด",
    "- diseases: คั่นด้วยคอมมา",
    "- medications: ชื่อยา คั่นด้วยคอมมา",
    "- consulted_doc: คำตอบสั้น รวมความถี่ถ้ามี (เช่น 'ใช่ — ทุก 3 เดือน')",
    "- patient_type: 'ตัวเอง' หรือ 'คนในครอบครัว — [ความสัมพันธ์]'",
    "- symptoms: อธิบายสั้น ๆ",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
    temperature: 0,
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? "{}") as ExtractedCustomerFields;
  } catch {
    return {};
  }
}
