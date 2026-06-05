// Read-only reconciliation: probe BOTH Oreka accounts (Gosell + Hopeful),
// collect every localParty that actually records calls, then for each agent in
// the master sheet show WHERE their Gosell# / Hopeful# actually appear.
//
// Run: node scripts/check-numbers.mjs [days]   (default 30)
import { readFileSync } from "node:fs";

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
const ACCOUNTS = [
  { id: "gosell", user: env.OREKA_USER, pass: env.OREKA_PASSWORD },
  { id: "hopeful", user: env.OREKA_HOPEFUL_USER, pass: env.OREKA_HOPEFUL_PASSWORD },
];

// Sheet left table (excluding "ว่าง"). null = blank cell.
const SHEET = [
  ["พี่จ๊อบ", "099 251 0495", "094 555 6907"],
  ["มิ้ม", "061 754 7495", null],
  ["โบว์", "061 883 3224", "094 555 6905"],
  ["ดาด้า", "080 597 1882", null],
  ["นัท", "099 251 0495", null],
  ["อาตูน", "082 456 2221", "094 999 8575"],
  ["ปุ้ม", "066 116 1793", "099 249 2041"],
  ["เต้ย", "099 058 8826", null],
  ["ต่อ", null, "063 354 7226"],
  ["เมย์", "094 421 8494", null],
  ["โอ๋", "061 771 5866", null],
  ["มาร์ค", null, "062 629 4095"],
  ["ตั้ม", "061 883 8246", null],
  ["การ์ตูน", null, "066 131 6872"],
  ["มด", null, "094 999 8570"],
  ["แฟรงค์", null, "094 490 7614"],
  ["ก๊อฟ", null, "092 620 7877"],
  ["ติ๊ก", "099 047 9038", null],
  ["มีน", "099 131 2233", null],
];

function canon(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("66")) return d;
  if (d.startsWith("0")) return "66" + d.slice(1);
  return d;
}
const pad = (n) => String(n).padStart(2, "0");
const toStamp = (dt) =>
  `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}_${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}`;

async function probe(acct) {
  if (!acct.user || !acct.pass) { console.error(`(skip ${acct.id}: no creds)`); return new Map(); }
  const basic = Buffer.from(`${acct.user}:${acct.pass}`).toString("base64");
  const lr = await fetch(`${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`, {
    method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  const token = (await lr.json()).accesstoken;
  if (!token) { console.error(`login failed ${acct.id}: ${lr.status}`); return new Map(); }

  const now = new Date();
  const start = toStamp(new Date(now.getTime() - DAYS * 24 * 3600_000));
  const end = toStamp(now);
  const seen = new Map();
  let page = 1, total = 0;
  const PAGE_SIZE = 1000, MAX_PAGES = 80;
  while (page <= MAX_PAGES) {
    const url = `${BASE}/orktrack/rest/recordings?range=custom&startdate=${start}&enddate=${end}` +
      `&sort=&page=${page}&pagesize=${PAGE_SIZE}&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;
    const res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
    if (!res.ok) { console.error(`${acct.id} page ${page} HTTP ${res.status}`); break; }
    const data = await res.json();
    const objs = data.objects || [];
    for (const r of objs) {
      if (!r.localParty) continue;
      const k = canon(r.localParty);
      const e = seen.get(k) || { count: 0, raw: r.localParty, name: "" };
      e.count++;
      if (!e.name && r.userDto) e.name = [r.userDto.firstname, r.userDto.lastname].filter(Boolean).join(" ").trim();
      seen.set(k, e);
    }
    total += objs.length;
    if (objs.length < PAGE_SIZE || !data.nextPageUri) break;
    page++;
  }
  console.log(`${acct.id}: scanned ${total} recordings, ${seen.size} distinct numbers`);
  return seen;
}

async function main() {
  const [G, H] = [await probe(ACCOUNTS[0]), await probe(ACCOUNTS[1])];
  const where = (k) => (k && G.has(k) ? `G(${G.get(k).count})` : "") + (k && H.has(k) ? ` H(${H.get(k).count})` : "");

  console.log("\n=== per agent: เบอร์ในชีต → จริง ๆ บันทึกที่บัญชีไหน (G=Gosell, H=Hopeful) ===");
  console.log("agent      | Gosell#        loc      | Hopeful#       loc");
  for (const [name, g, h] of SHEET) {
    const gk = canon(g), hk = canon(h);
    const gLoc = g ? (where(gk) || "❌ ไม่เจอ") : "-";
    const hLoc = h ? (where(hk) || "❌ ไม่เจอ") : "-";
    console.log(`${name.padEnd(9)} | ${(g || "-").padEnd(13)} ${gLoc.padEnd(11)} | ${(h || "-").padEnd(13)} ${hLoc}`);
  }

  // numbers active in each account that the sheet never lists (any column)
  const sheetKeys = new Set();
  for (const [, g, h] of SHEET) { if (canon(g)) sheetKeys.add(canon(g)); if (canon(h)) sheetKeys.add(canon(h)); }
  for (const [label, m] of [["Gosell", G], ["Hopeful", H]]) {
    const extras = [...m.entries()].filter(([k]) => !sheetKeys.has(k)).sort((a, b) => b[1].count - a[1].count);
    console.log(`\n=== มีสายจริงใน ${label} แต่ไม่อยู่ในชีตเลย (${extras.length}) ===`);
    for (const [, e] of extras) console.log(`   ${e.raw.padEnd(14)} ${String(e.count).padStart(4)} สาย  "${e.name}"`);
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
