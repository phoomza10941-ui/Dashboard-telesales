// Apply the master-sheet phone mapping to profiles.oreka_ext / oreka_ext_hopeful.
// DRY-RUN by default (prints the plan). Pass --apply to actually PATCH.
// Non-destructive: only SETS the fields listed below; never clears a column.
//
// Run: node scripts/apply-oreka-ext.mjs          (dry run)
//      node scripts/apply-oreka-ext.mjs --apply   (write)
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing Supabase env"); process.exit(1); }
const APPLY = process.argv.includes("--apply");

// nickname -> { g: oreka_ext (Gosell), h: oreka_ext_hopeful }. Omit a field = leave it alone.
// (พี่จ๊อบ excluded by request. ต่อ forced to Hopeful by request. ก๊อฟ typo fixed 09->06.)
const MAP = {
  "มิ้ม":    { g: "+66617547495" },
  "โบว์":    { g: "+66618833224", h: "+66945556905" },
  "ดาด้า":   { g: "+66805971882" },
  "นัท":     { g: "+66992510495" },
  "อาตูน":   { g: "+66824562221", h: "+66949998575" },
  "ปุ้ม":    { g: "+66661161793", h: "+66992492041" },
  "เต้ย":    { g: "+66990588826" },
  "เมย์":    { g: "+66944218494" },
  "โอ๋":     { g: "+66617715866" },
  "ตั้ม":    { g: "+66618838246" },
  "มด":      { h: "+66949998570" },
  "มาร์ค":   { h: "+66626294095" },
  "การ์ตูน": { h: "+66661316872" },
  "แฟรงค์":  { h: "+66944907614" },
  "ติ๊ก":    { g: "+66990479038" },
  "มีน":     { g: "+66991312233" },
  "ต่อ":     { h: "+66633547226" },
  "ก๊อฟ":    { h: "+66626207877" },
};

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const res = await fetch(`${URL}/rest/v1/profiles?select=id,nickname,role,oreka_ext,oreka_ext_hopeful`, { headers });
if (!res.ok) { console.error("profiles query failed:", res.status, await res.text()); process.exit(1); }
const profiles = await res.json();
const byNick = new Map(profiles.map((p) => [String(p.nickname ?? "").trim(), p]));

console.log(`mode: ${APPLY ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);
const unmatched = [];
let changes = 0;

for (const [nick, want] of Object.entries(MAP)) {
  const p = byNick.get(nick);
  if (!p) { unmatched.push(nick); continue; }

  const patch = {};
  const log = [];
  if (want.g !== undefined && p.oreka_ext !== want.g) { patch.oreka_ext = want.g; log.push(`oreka_ext: ${p.oreka_ext ?? "∅"} → ${want.g}`); }
  if (want.h !== undefined && p.oreka_ext_hopeful !== want.h) { patch.oreka_ext_hopeful = want.h; log.push(`oreka_ext_hopeful: ${p.oreka_ext_hopeful ?? "∅"} → ${want.h}`); }

  if (log.length === 0) { console.log(`= ${nick.padEnd(9)} already correct`); continue; }
  changes++;
  console.log(`${APPLY ? "✎" : "·"} ${nick.padEnd(9)} ${log.join("  |  ")}`);

  if (APPLY) {
    const u = await fetch(`${URL}/rest/v1/profiles?id=eq.${p.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    if (!u.ok) console.error(`   ✖ failed ${nick}: ${u.status} ${await u.text()}`);
  }
}

console.log(`\n${changes} agent(s) ${APPLY ? "updated" : "would change"}.`);
if (unmatched.length) console.log(`⚠️ ไม่เจอ profile ชื่อ: ${unmatched.join(", ")} (ข้าม — ต้องเช็คชื่อใน DB)`);
