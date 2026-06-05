// Read-only probe: list every localParty that actually appears in the GOSELL
// Oreka account over the last N days, then compare against the Gosell numbers
// from the master sheet. Tells us which sheet numbers are NOT in Gosell.
//
// Run: node scripts/check-gosell-numbers.mjs [days]   (default 30)
import { readFileSync } from "node:fs";

// --- load .env.local ---
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

const DAYS = Number(process.argv[2]) || 30;
const BASE = env.OREKA_BASE_URL;
const USER = env.OREKA_USER;
const PASS = env.OREKA_PASSWORD;
if (!BASE || !USER || !PASS) { console.error("Missing Gosell OREKA creds in .env.local"); process.exit(1); }

// Sheet Gosell numbers (left table, excluding "ว่าง")
const SHEET_GOSELL = [
  ["พี่จ๊อบ", "099 251 0495"],
  ["มิ้ม", "061 754 7495"],
  ["โบว์", "061 883 3224"],
  ["ดาด้า", "080 597 1882"],
  ["นัท", "099 251 0495"],
  ["อาตูน", "082 456 2221"],
  ["ปุ้ม", "066 116 1793"],
  ["เต้ย", "099 058 8826"],
  ["เมย์", "094 421 8494"],
  ["โอ๋", "061 771 5866"],
  ["ตั้ม", "061 883 8246"],
  ["ติ๊ก", "099 047 9038"],
  ["มีน", "099 131 2233"],
];

// canonical key: digits only, normalize to "66XXXXXXXXX"
function canon(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("66")) return d;
  if (d.startsWith("0")) return "66" + d.slice(1);
  return d;
}

const pad = (n) => String(n).padStart(2, "0");
const toStamp = (dt) =>
  `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}_${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}`;

async function main() {
  // login
  const basic = Buffer.from(`${USER}:${PASS}`).toString("base64");
  const loginRes = await fetch(`${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`, {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const token = (await loginRes.json()).accesstoken;
  if (!token) { console.error("login failed:", loginRes.status); process.exit(1); }

  const now = new Date();
  const start = toStamp(new Date(now.getTime() - DAYS * 24 * 3600_000));
  const end = toStamp(now);

  // collect distinct localParty -> {count, name}
  const seen = new Map();
  let page = 1, total = 0;
  const PAGE_SIZE = 1000, MAX_PAGES = 80;
  while (page <= MAX_PAGES) {
    const url = `${BASE}/orktrack/rest/recordings?range=custom&startdate=${start}&enddate=${end}` +
      `&sort=&page=${page}&pagesize=${PAGE_SIZE}&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;
    const res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
    if (!res.ok) { console.error(`page ${page} HTTP ${res.status}`); break; }
    const data = await res.json();
    const objs = data.objects || [];
    for (const r of objs) {
      const lp = r.localParty;
      if (!lp) continue;
      const k = canon(lp);
      const e = seen.get(k) || { count: 0, raw: lp, name: "" };
      e.count++;
      if (!e.name && r.userDto) e.name = [r.userDto.firstname, r.userDto.lastname].filter(Boolean).join(" ").trim();
      seen.set(k, e);
    }
    total += objs.length;
    if (objs.length < PAGE_SIZE || !data.nextPageUri) break;
    page++;
  }

  console.log(`\nGosell: scanned ${total} recordings over ${DAYS} days, ${seen.size} distinct localParty numbers\n`);

  // 1) sheet numbers vs reality
  console.log("=== เทียบเบอร์ในชีต (Gosell) กับที่มีจริงในระบบ ===");
  for (const [name, num] of SHEET_GOSELL) {
    const k = canon(num);
    const hit = seen.get(k);
    console.log(`${hit ? "✅" : "❌ ไม่มีในระบบ"}  ${name.padEnd(8)} ${num}  ${hit ? `(${hit.count} สาย, oreka="${hit.name}")` : ""}`);
  }

  // 2) numbers active in Gosell but NOT in the sheet
  const sheetKeys = new Set(SHEET_GOSELL.map(([, n]) => canon(n)));
  const extras = [...seen.entries()].filter(([k]) => !sheetKeys.has(k)).sort((a, b) => b[1].count - a[1].count);
  console.log(`\n=== เบอร์ที่มีสายจริงใน Gosell แต่ไม่อยู่ในชีต (${extras.length}) ===`);
  for (const [k, e] of extras) {
    console.log(`   ${e.raw.padEnd(14)} ${String(e.count).padStart(4)} สาย  oreka="${e.name}"`);
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
