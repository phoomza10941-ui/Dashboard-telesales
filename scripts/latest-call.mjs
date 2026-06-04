// Show the most recent call(s) from Oreka for an account.
// Run: node scripts/latest-call.mjs [--hopeful] [count]
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

const account = process.argv.includes("--hopeful") ? "hopeful" : "gosell";
const count = Number(process.argv.find((a) => /^\d+$/.test(a))) || 5;
const BASE = env.OREKA_BASE_URL;
const USER = account === "hopeful" ? env.OREKA_HOPEFUL_USER : env.OREKA_USER;
const PASS = account === "hopeful" ? env.OREKA_HOPEFUL_PASSWORD : env.OREKA_PASSWORD;

// Thai "today" start -> UTC
function thaiTodayStartUtc() {
  const now = new Date();
  const thai = new Date(now.getTime() + 7 * 3600_000);
  const y = thai.getUTCFullYear();
  const mo = String(thai.getUTCMonth() + 1).padStart(2, "0");
  const d = String(thai.getUTCDate()).padStart(2, "0");
  const mid = new Date(`${y}-${mo}-${d}T00:00:00Z`).getTime() - 7 * 3600_000;
  const u = new Date(mid);
  const f = (n) => String(n).padStart(2, "0");
  return `${u.getUTCFullYear()}${f(u.getUTCMonth() + 1)}${f(u.getUTCDate())}_${f(u.getUTCHours())}${f(u.getUTCMinutes())}${f(u.getUTCSeconds())}`;
}

function fmtDur(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
// UTC "YYYY-MM-DD HH:MM:SS" -> Thai time (+7) string
function toThai(ts) {
  const d = new Date(ts.replace(" ", "T") + "Z");
  const t = new Date(d.getTime() + 7 * 3600_000);
  const f = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${f(t.getUTCMonth() + 1)}-${f(t.getUTCDate())} ${f(t.getUTCHours())}:${f(t.getUTCMinutes())}:${f(t.getUTCSeconds())}`;
}

const basic = Buffer.from(`${USER}:${PASS}`).toString("base64");
const login = await (await fetch(`${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`, {
  method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
})).json();
const token = login.accesstoken;
if (!token) { console.error("login failed"); process.exit(1); }

const start = thaiTodayStartUtc();
const data = await (await fetch(
  `${BASE}/orktrack/rest/recordings?range=custom&startdate=${start}&sort=&page=1&pagesize=500&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`,
  { headers: { Authorization: token, Accept: "application/json" } }
)).json();

const objs = data.objects || [];
// sort by timestamp (UTC string sorts chronologically), newest last -> reverse
const sorted = [...objs].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
const latest = sorted.slice(-count).reverse();

console.log(`account: ${account} · สายวันนี้ทั้งหมด: ${objs.length} · แสดงล่าสุด ${latest.length} สาย (เวลาไทย)\n`);
for (const r of latest) {
  const name = [r.userDto?.firstname, r.userDto?.lastname].filter(Boolean).join(" ").trim() || "(ไม่มีชื่อ)";
  console.log(`เวลา       : ${toThai(r.timestamp)}`);
  console.log(`agent      : ${r.localParty}  (${name})`);
  console.log(`ลูกค้า     : ${r.remoteParty}`);
  console.log(`ทิศทาง     : ${r.direction}   ระยะเวลา: ${fmtDur(r.duration)} (${r.duration}s)`);
  console.log(`recording  : id ${r.id}`);
  console.log("-".repeat(50));
}
