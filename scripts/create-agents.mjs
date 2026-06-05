// Create the 18 telesales agents from the master sheet (auth user + profile),
// and set oreka_ext / oreka_ext_hopeful in the same pass.
// DRY-RUN by default; pass --apply to actually create.
//
//   node scripts/create-agents.mjs          (preview)
//   node scripts/create-agents.mjs --apply  (create)
//
// Decisions (confirmed): same password for all, team blank, full_name = nickname.
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

// password is NOT hardcoded (keep secrets out of git). Provide via env or CLI:
//   AGENT_DEFAULT_PASSWORD=... node scripts/create-agents.mjs --apply
//   node scripts/create-agents.mjs --apply --password=...
const PASSWORD =
  process.env.AGENT_DEFAULT_PASSWORD ||
  (process.argv.find((a) => a.startsWith("--password=")) || "").split("=")[1] ||
  "";
if (APPLY && (!PASSWORD || PASSWORD.length < 6)) {
  console.error("Set a password (≥6 chars) via AGENT_DEFAULT_PASSWORD=... or --password=...");
  process.exit(1);
}
const TEAM = "";
const DOMAIN = "telesales.internal";

// username(latin for email) · nickname(thai) · g=oreka_ext(Gosell) · h=oreka_ext_hopeful
const AGENTS = [
  { u: "mim",    n: "มิ้ม",    g: "+66617547495", h: null },
  { u: "bow",    n: "โบว์",    g: "+66618833224", h: "+66945556905" },
  { u: "dada",   n: "ดาด้า",   g: "+66805971882", h: null },
  { u: "nut",    n: "นัท",     g: "+66992510495", h: null },
  { u: "atoon",  n: "อาตูน",   g: "+66824562221", h: "+66949998575" },
  { u: "poom",   n: "ปุ้ม",    g: "+66661161793", h: "+66992492041" },
  { u: "toey",   n: "เต้ย",    g: "+66990588826", h: null },
  { u: "may",    n: "เมย์",    g: "+66944218494", h: null },
  { u: "oh",     n: "โอ๋",     g: "+66617715866", h: null },
  { u: "tum",    n: "ตั้ม",    g: "+66618838246", h: null },
  { u: "mod",    n: "มด",      g: null,           h: "+66949998570" },
  { u: "mark",   n: "มาร์ค",   g: null,           h: "+66626294095" },
  { u: "katoon", n: "การ์ตูน", g: null,           h: "+66661316872" },
  { u: "frank",  n: "แฟรงค์",  g: null,           h: "+66944907614" },
  { u: "tik",    n: "ติ๊ก",    g: "+66990479038", h: null },
  { u: "meen",   n: "มีน",     g: "+66991312233", h: null },
  { u: "tor",    n: "ต่อ",     g: null,           h: "+66633547226" },
  { u: "gof",    n: "ก๊อฟ",    g: null,           h: "+66626207877" },
];

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// existing nicknames + emails (skip collisions)
const profRes = await fetch(`${URL}/rest/v1/profiles?select=nickname`, { headers: h });
const existingNicks = new Set((await profRes.json()).map((p) => String(p.nickname ?? "").trim()));
const usrRes = await fetch(`${URL}/auth/v1/admin/users?per_page=1000`, { headers: h });
const existingEmails = new Set(((await usrRes.json()).users ?? []).map((u) => (u.email ?? "").toLowerCase()));

console.log(`mode: ${APPLY ? "APPLY (creating)" : "DRY RUN"}  ·  password(all): ${PASSWORD}\n`);
console.log("username".padEnd(9), "nickname".padEnd(9), "email".padEnd(26), "oreka_ext".padEnd(15), "oreka_ext_hopeful");
console.log("-".repeat(90));

let created = 0, skipped = 0;
for (const a of AGENTS) {
  const email = `${a.u}@${DOMAIN}`;
  const collide = existingNicks.has(a.n) || existingEmails.has(email.toLowerCase());
  console.log(
    a.u.padEnd(9), a.n.padEnd(9), email.padEnd(26),
    (a.g ?? "–").padEnd(15), (a.h ?? "–"),
    collide ? "  ⟵ มีอยู่แล้ว ข้าม" : ""
  );
  if (collide) { skipped++; continue; }
  if (!APPLY) { created++; continue; }

  // 1) create auth user
  const cu = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST", headers: h,
    body: JSON.stringify({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: a.n, nickname: a.n, agent_code: `tele-${a.n}`, team: TEAM, role: "agent" },
    }),
  });
  if (!cu.ok) { console.error(`   ✖ createUser ${a.u}: ${cu.status} ${await cu.text()}`); continue; }
  const id = (await cu.json()).id;

  // 2) upsert profile (merge with any trigger-created row) incl. oreka numbers
  const up = await fetch(`${URL}/rest/v1/profiles?on_conflict=id`, {
    method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id, full_name: a.n, nickname: a.n, agent_code: `tele-${a.n}`, team: TEAM, role: "agent",
      oreka_ext: a.g, oreka_ext_hopeful: a.h,
    }),
  });
  if (!up.ok) { console.error(`   ✖ profile ${a.u}: ${up.status} ${await up.text()}`); continue; }
  created++;
}

console.log(`\n${APPLY ? "created" : "would create"}: ${created}  ·  skipped(existing): ${skipped}`);
