// lib/transcript-quality.ts
// Pure functions — ZERO imports. Safe to use in Node test runners without Next.js context.

// Known filler phrases that Whisper loops on silence/hold-music
const HALLUCINATION_PHRASES = [
  "ขอบคุณค่ะ", "ขอบคุณครับ", "สวัสดีค่ะ", "สวัสดีครับ",
  "แล้วเจอกันใหม่", "บ๊ายบาย", "ค่ะค่ะค่ะ",
];

/**
 * Detect whether a transcript is likely a Whisper/GPT-4o hallucination loop
 * rather than genuine speech.
 *
 * CALIBRATION NOTES (Thai telephony):
 *   - Polite particles (ค่ะ, ครับ, นะคะ) repeat many times in a real call —
 *     do NOT penalise raw frequency of individual tokens.
 *   - Real hallucinations are: empty output, unspaced loops (same unit repeated
 *     back-to-back covering almost the whole text), long runs of identical
 *     consecutive tokens/bigrams, or extreme dominance when the token count is
 *     large enough that particle frequency alone is meaningful.
 */
export function isLikelyHallucination(text: string): boolean {
  const clean = text.trim();

  // Rule 0 — empty output
  if (clean.length === 0) return true;

  // Rule 1 — collapsed text is too short to contain real content
  const collapsed = clean.replace(/\s+/g, "");
  if (collapsed.length < 8) return true;

  // Rule 2 — unspaced repetition loop (catches "ขอบคุณค่ะ".repeat(25))
  // Scan unit lengths 1..min(15, floor(collapsed.length/4))
  const maxUnit = Math.min(15, Math.floor(collapsed.length / 4));
  for (let u = 1; u <= maxUnit; u++) {
    const unit = collapsed.slice(0, u);
    let reps = 0;
    let pos = 0;
    while (pos + u <= collapsed.length && collapsed.slice(pos, pos + u) === unit) {
      reps++;
      pos += u;
    }
    // If the repeated prefix covers ≥80 % of the string and repeats ≥5 times → loop
    if (reps >= 5 && pos / collapsed.length >= 0.8) return true;
  }

  // Rules 3-5 only apply when there are real whitespace-separated tokens
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length < 8) return false; // too short to judge via token statistics

  // Rule 3 — longest run of identical CONSECUTIVE tokens ≥ 6
  // (catches "ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ...")
  let maxRun = 1;
  let curRun = 1;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      curRun++;
      if (curRun > maxRun) maxRun = curRun;
    } else {
      curRun = 1;
    }
  }
  if (maxRun >= 6) return true;

  // Rule 4 — token dominance: most-frequent token makes up ≥60 % of a ≥12-token sequence
  // In real Thai sales calls, ค่ะ/ครับ top out around 30–40 % even in short transcripts.
  if (tokens.length >= 12) {
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
    const maxFreq = Math.max(...freq.values());
    if (maxFreq / tokens.length >= 0.6) return true;
  }

  // Rule 5 — longest run of identical CONSECUTIVE bigrams ≥ 5
  // (catches "ขอบคุณ ค่ะ ขอบคุณ ค่ะ ..." loops)
  let bgRun = 1;
  let bgCur = 1;
  for (let i = 1; i + 1 < tokens.length; i++) {
    const prev = tokens[i - 1] + " " + tokens[i];
    const curr = tokens[i] + " " + tokens[i + 1];
    if (curr === prev) {
      bgCur++;
      if (bgCur > bgRun) bgRun = bgCur;
    } else {
      bgCur = 1;
    }
  }
  if (bgRun >= 5) return true;

  // Edge case: whole transcript collapses to a single known filler (or doubled)
  if (HALLUCINATION_PHRASES.some(
    (p) => collapsed === p.replace(/\s+/g, "") || collapsed === p.repeat(2),
  )) return true;

  return false;
}
