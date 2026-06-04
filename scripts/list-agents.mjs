// List agent profiles (nickname + oreka_ext) so we can see who exists and who's
// already matched to an Oreka Local Party number.
// Run: node scripts/list-agents.mjs
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
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const res = await fetch(`${URL}/rest/v1/profiles?select=nickname,role,oreka_ext&order=nickname.asc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error("profiles query failed:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
const agents = rows.filter((r) => r.role === "agent");
console.log(`total profiles: ${rows.length} · agents: ${agents.length}\n`);
console.log("nickname".padEnd(16), "oreka_ext");
console.log("-".repeat(40));
for (const r of agents) {
  console.log(String(r.nickname ?? "").padEnd(16), r.oreka_ext ?? "(ยังไม่ผูก)");
}
