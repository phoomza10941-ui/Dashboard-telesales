// Quick probe of the Oreka OrkTrack REST API.
// Reads OREKA_* from .env.local, logs in, fetches one page of today's
// recordings, and prints the field names + a redacted sample so we can
// confirm the JSON shape (esp. the local-party field) before coding lib/oreka.ts.
//
// Run: node scripts/test-oreka.mjs
import { readFileSync } from "node:fs";

// --- load .env.local (minimal parser) ---
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

// --- pick account: default "gosell" (OREKA_USER/PASSWORD), or --hopeful (OREKA_HOPEFUL_*) ---
const account = process.argv.includes("--hopeful") ? "hopeful" : "gosell";
const BASE = env.OREKA_BASE_URL;
const USER = account === "hopeful" ? env.OREKA_HOPEFUL_USER : env.OREKA_USER;
const PASS = account === "hopeful" ? env.OREKA_HOPEFUL_PASSWORD : env.OREKA_PASSWORD;
console.log(`account: ${account}  user: ${USER ? `${USER.slice(0, 5)}***` : "(missing)"}`);
if (!BASE || !USER || !PASS) {
  console.error(`Missing OREKA creds for "${account}" in .env.local`);
  process.exit(1);
}

// Thai "today" start -> UTC (UTC+7): subtract 7h
function thaiTodayStartUtc() {
  const now = new Date();
  // shift to Thai time, floor to midnight, shift back to UTC
  const thai = new Date(now.getTime() + 7 * 3600_000);
  const y = thai.getUTCFullYear();
  const mo = String(thai.getUTCMonth() + 1).padStart(2, "0");
  const d = String(thai.getUTCDate()).padStart(2, "0");
  const thaiMidnightUtc = new Date(`${y}-${mo}-${d}T00:00:00Z`).getTime() - 7 * 3600_000;
  const u = new Date(thaiMidnightUtc);
  const fmt = (n) => String(n).padStart(2, "0");
  return `${u.getUTCFullYear()}${fmt(u.getUTCMonth() + 1)}${fmt(u.getUTCDate())}_${fmt(u.getUTCHours())}${fmt(u.getUTCMinutes())}${fmt(u.getUTCSeconds())}`;
}

async function main() {
  // 1) login
  const basic = Buffer.from(`${USER}:${PASS}`).toString("base64");
  const loginUrl = `${BASE}/orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true`;
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });
  console.log("login status:", loginRes.status);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const jsession = (setCookie.match(/JSESSIONID=([^;]+)/) || [])[1];
  const login = await loginRes.json();
  const token = login.accesstoken;
  console.log("login keys:", Object.keys(login));
  console.log("accesstoken present:", !!token, " jsessionid present:", !!jsession);
  if (!token) { console.error("no accesstoken"); process.exit(1); }

  // 2) recordings (today, page 1)
  const start = thaiTodayStartUtc();
  const recUrl = `${BASE}/orktrack/rest/recordings?range=custom&startdate=${start}&sort=&page=1&pagesize=5&maxresults=0&includetags=true&includemetadata=true&includeprograms=true`;
  console.log("\nrecordings url:", recUrl);
  const recRes = await fetch(recUrl, {
    headers: {
      Authorization: token,
      ...(jsession ? { Cookie: `JSESSIONID=${jsession}` } : {}),
      Accept: "application/json",
    },
  });
  console.log("recordings status:", recRes.status);
  const data = await recRes.json();
  console.log("top-level keys:", Object.keys(data));
  const objs = data.objects || [];
  console.log("objects count (page):", objs.length, " limitReached:", data.limitReached);
  if (objs[0]) {
    console.log("\n=== recordingDto field names ===");
    console.log(Object.keys(objs[0]));
    // print a redacted sample: keep numeric/short fields, mask phone-like values
    const sample = {};
    for (const [k, v] of Object.entries(objs[0])) {
      sample[k] = typeof v === "string" && /\+?\d{6,}/.test(v) ? `${String(v).slice(0, 4)}***` : v;
    }
    console.log("\n=== sample (phones masked) ===");
    console.log(JSON.stringify(sample, null, 2));
  }
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
