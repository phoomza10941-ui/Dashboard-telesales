// One-off: estimate OpenAI token/cost usage for a stored call summary.
// Reads the saved transcript+summary from call_summaries and counts tokens with
// the o200k encoding (gpt-4o / gpt-4o-mini). Transcription is billed per audio-minute,
// so we report that from the recording duration.
//
// Run: node scripts/check-tokens.mjs <phone-or-fragment>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { encode } from "gpt-tokenizer/model/gpt-4o";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

const frag = process.argv[2] || "628402082";
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await supabase
  .from("call_summaries")
  .select("recording_id, phone, duration, called_at, transcript, summary, coaching_tips")
  .ilike("phone", `%${frag}%`)
  .order("called_at", { ascending: false });

if (error) { console.error(error); process.exit(1); }
if (!data?.length) { console.error(`No call_summaries row matching "%${frag}%"`); process.exit(1); }

// Must mirror lib/call-summary.ts SUMMARY_PROMPT length for an accurate input count.
const SYSTEM_PROMPT_TOKENS = 230; // approx; system prompt is fixed

// pricing (USD per 1M tokens / per audio-min)
const PRICE = {
  transcribeMin: 0.006,      // gpt-4o-transcribe
  summaryIn: 0.15 / 1e6,     // gpt-4o-mini input
  summaryOut: 0.60 / 1e6,    // gpt-4o-mini output
};
const THB = 36;

for (const r of data) {
  const transcript = r.transcript ?? "";
  const out = JSON.stringify({ summary: r.summary, coaching_tips: r.coaching_tips });

  const inTok = SYSTEM_PROMPT_TOKENS + encode(transcript).length;
  const outTok = encode(out).length;
  const mins = (r.duration ?? 0) / 60;

  const cTranscribe = mins * PRICE.transcribeMin;
  const cSummary = inTok * PRICE.summaryIn + outTok * PRICE.summaryOut;
  const total = cTranscribe + cSummary;

  console.log("─".repeat(60));
  console.log(`recording_id : ${r.recording_id}`);
  console.log(`phone        : ${r.phone}`);
  console.log(`called_at    : ${r.called_at}`);
  console.log(`duration     : ${r.duration}s  (${mins.toFixed(1)} min)`);
  console.log(`transcript   : ${transcript.length} chars`);
  console.log("");
  console.log(`Transcription (gpt-4o-transcribe): billed per audio-minute`);
  console.log(`   ${mins.toFixed(2)} min  →  $${cTranscribe.toFixed(4)}`);
  console.log(`Summary (gpt-4o-mini):`);
  console.log(`   input  ${inTok} tok  →  $${(inTok * PRICE.summaryIn).toFixed(5)}`);
  console.log(`   output ${outTok} tok →  $${(outTok * PRICE.summaryOut).toFixed(5)}`);
  console.log("");
  console.log(`TOTAL this call: $${total.toFixed(4)}  (~฿${(total * THB).toFixed(2)})`);
}
console.log("─".repeat(60));
