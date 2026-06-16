// scripts/test-transcript-quality.ts
// Run with: npx --yes tsx scripts/test-transcript-quality.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isLikelyHallucination } from "../lib/transcript-quality";

// ─── LEGIT transcripts — must NOT be flagged ───────────────────────────────
const legitSpaced =
  "สวัสดี ค่ะ ลูกค้า สนใจ อาหารเสริม ตัว ไหน ค่ะ ตอนนี้ มี โปรโมชั่น ซื้อสองแถมหนึ่ง ค่ะ " +
  "ราคา หนึ่งพันเก้าร้อยเก้าสิบ บาท ค่ะ คุณ มี โรคประจำตัว ไหม ค่ะ เบาหวาน ใช่ไหม ค่ะ " +
  "เดี๋ยว แนะนำ สูตร ที่ เหมาะ ค่ะ ทาน วันละ สองเม็ด นะคะ ขอบคุณ ค่ะ";

const legitUnspaced =
  "สวัสดีค่ะลูกค้าสนใจอาหารเสริมตัวไหนคะตอนนี้มีโปรโมชั่นพิเศษราคาหนึ่งพันเก้าร้อยบาทค่ะ" +
  "คุณมีโรคประจำตัวไหมคะเบาหวานใช่ไหมคะเดี๋ยวแนะนำสูตรที่เหมาะค่ะ";

// ─── HALLUCINATIONS — must be flagged ──────────────────────────────────────
const empty = "";
const halSpaced =
  "ขอบคุณค่ะ ขอบคุณค่ะ ขอบคุณค่ะ ขอบคุณค่ะ ขอบคุณค่ะ ขอบคุณค่ะ ขอบคุณค่ะ";
const halUnspaced = "ขอบคุณค่ะ".repeat(25);
const halParticle = "ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ ค่ะ";

test("legitSpaced — real spaced Thai call MUST NOT be flagged", () => {
  assert.equal(isLikelyHallucination(legitSpaced), false);
});

test("legitUnspaced — real unspaced Thai call MUST NOT be flagged", () => {
  assert.equal(isLikelyHallucination(legitUnspaced), false);
});

test("empty — empty string MUST be flagged", () => {
  assert.equal(isLikelyHallucination(empty), true);
});

test("halSpaced — spaced loop phrase MUST be flagged", () => {
  assert.equal(isLikelyHallucination(halSpaced), true);
});

test("halUnspaced — unspaced repeat x25 MUST be flagged", () => {
  assert.equal(isLikelyHallucination(halUnspaced), true);
});

test("halParticle — particle-only loop MUST be flagged", () => {
  assert.equal(isLikelyHallucination(halParticle), true);
});
