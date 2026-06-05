// Read the LIVE assignment from profiles (oreka_ext / oreka_ext_hopeful), probe
// both Oreka accounts, and flag any assigned number that does NOT actually have
// recordings in the account it's assigned to (or isn't in either account).
//
// Run: node scripts/check-assigned.mjs [days]   (default 30)
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = env.OREKA_BASE_URL;
const DAYS = Number(process.argv[2]) || 30;

const canon = (raw) => { if (!raw) return null; let d = String(raw).replace(/\D/g, ""); if (d.startsWith("66")) return d; if (d.startsWith("0")) return "66" + d.slice(1); return d; };
const pad = (n) => String(n).padStart(2, "0");
const toStamp = (dt) => `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}_${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}`;

async function probe(user, pass) {
  if (!user || !pass) return new Map();
  const basic = Buffer.from(`${user}:${pass}`).toString("base64");
  const lr = await fetch(`${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" } });
  const token = (await lr.json()).accesstoken;
  if (!token) return new Map();
  const now = new Date();
  const start = toStamp(new Date(now.getTime() - DAYS * 24 * 3600_000)), end = toStamp(now);
  const seen = new Map();
  let page = 1; const PS = 1000, MAX = 80;
  while (page <= MAX) {
    const url = `${BASE}/orktrack/rest/recordings?range=custom&startdate=${start}&enddate=${end}&sort=&page=${page}&pagesize=${PS}&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;
    const res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
    if (!res.ok) break;
    const data = await res.json(); const objs = data.objects || [];
    for (const r of objs) { if (!r.localParty) continue; const k = canon(r.localParty); seen.set(k, (seen.get(k) || 0) + 1); }
    if (objs.length < PS || !data.nextPageUri) break;
    page++;
  }
  return seen;
}

const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rows = await (await fetch(`${URL}/rest/v1/profiles?select=nickname,oreka_ext,oreka_ext_hopeful&order=nickname.asc`, { headers: h })).json();
const assigned = rows.filter((p) => p.oreka_ext || p.oreka_ext_hopeful);

const [G, H] = [await probe(env.OREKA_USER, env.OREKA_PASSWORD), await probe(env.OREKA_HOPEFUL_USER, env.OREKA_HOPEFUL_PASSWORD)];
console.log(`probed ${DAYS} days · Gosell ${G.size} numbers · Hopeful ${H.size} numbers\n`);

const loc = (k) => `${G.has(k) ? `G(${G.get(k)})` : ""}${H.has(k) ? ` H(${H.get(k)})` : ""}`.trim() || "ไม่เจอเลย";
const problems = [];
console.log("agent      field             number        found            verdict");
console.log("-".repeat(80));
for (const p of assigned) {
  for (const [field, acct] of [["oreka_ext", "G"], ["oreka_ext_hopeful", "H"]]) {
    const num = p[field]; if (!num) continue;
    const k = canon(num);
    const inG = G.has(k), inH = H.has(k);
    const want = acct === "G" ? inG : inH;
    let verdict;
    if (!inG && !inH) { verdict = "❌ ไม่อยู่ทั้ง 2 บัญชี"; problems.push(`${p.nickname} ${num} ไม่อยู่ทั้ง Gosell และ Hopeful`); }
    else if (!want) { verdict = `⚠️ ผูก ${acct === "G" ? "Gosell" : "Hopeful"} แต่สายอยู่อีกบัญชี`; problems.push(`${p.nickname} ${num} ผูก ${field} แต่ไม่มีสายในบัญชีนั้น (อยู่ ${inG ? "Gosell" : "Hopeful"})`); }
    else verdict = "✅";
    console.log(`${String(p.nickname).padEnd(9)} ${field.padEnd(17)} ${String(num).padEnd(13)} ${loc(k).padEnd(16)} ${verdict}`);
  }
}
console.log(`\n${problems.length ? "พบปัญหา " + problems.length + " จุด:\n - " + problems.join("\n - ") : "✅ ทุกเบอร์อยู่ในบัญชีที่ผูกไว้ครบ"}`);
