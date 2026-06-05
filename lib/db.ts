import { unstable_noStore as noStore } from "next/cache";
import { adminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
export { parseNoteStatus, parseNoteObjection, type NoteStatus } from "./note-utils";
import { parseNoteStatus, parseNoteObjection } from "./note-utils";

export interface SaleRow {
  id?: string;
  date: string;
  name: string;        // maps to customer_name in DB
  phone: string;
  address: string;
  product: string;
  quantity: number;
  // GoSell channel
  phoneClose: number;
  upsell: number;
  crm: number;
  // Hopeful channel
  hopefulPhoneClose: number;
  hopefulCrm: number;
  hopefulUpsell: number;
  note: string;
}

export interface AgentData {
  agentName: string;
  rows: SaleRow[];
  totalPhoneClose: number;
  totalUpsell: number;
  totalCrm: number;
  totalSales: number;
  orderCount: number;
}

// Get current user's ID and nickname from session
export async function getCurrentUser(): Promise<{
  id: string; nickname: string; fullName: string; agentCode: string;
  team: string; role: "agent" | "supervisor"; avatarUrl: string;
  orekaExtGosell: string; orekaExtHopeful: string;
} | null> {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Critical: resolve role on its own so an optional/missing column (e.g. the
  // talk-time oreka_ext columns) can never break role lookup and silently
  // downgrade a supervisor to "agent". Fall back to user_metadata.role if even
  // this query fails for any reason.
  const { data: roleRow } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (roleRow?.role ?? user.user_metadata.role ?? "agent") as
    | "agent"
    | "supervisor";

  // Optional: talk-time oreka numbers. Tolerate the columns not existing yet.
  const { data: oreka } = await adminClient
    .from("profiles")
    .select("oreka_ext, oreka_ext_hopeful")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    nickname: user.user_metadata.nickname ?? "",
    fullName: user.user_metadata.full_name ?? "",
    agentCode: user.user_metadata.agent_code ?? "",
    team: user.user_metadata.team ?? "",
    role,
    avatarUrl: user.user_metadata.avatar_url ?? "",
    orekaExtGosell: oreka?.oreka_ext ?? "",
    orekaExtHopeful: oreka?.oreka_ext_hopeful ?? "",
  };
}

export async function setMyOrekaExt(userId: string, gosell: string, hopeful: string): Promise<void> {
  const { error } = await adminClient.from("profiles").update({
    oreka_ext: gosell || null,
    oreka_ext_hopeful: hopeful || null,
  }).eq("id", userId);
  if (error) throw new Error(error.message);
}

// Get data for a specific agent by their user ID
export async function getMyData(userId: string): Promise<AgentData | null> {
  // Get nickname for agentName
  const { data: profile } = await adminClient
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  const { data: rows, error } = await adminClient
    .from("sales")
    .select("*")
    .eq("agent_id", userId)
    .order("created_at", { ascending: false });

  if (error || !rows) return null;

  const saleRows: SaleRow[] = rows.map(r => ({
    id: r.id,
    date: r.date,
    name: r.customer_name,
    phone: r.phone ?? "",
    address: r.address ?? "",
    product: r.product ?? "",
    quantity: Number(r.quantity) || 1,
    phoneClose: Number(r.phone_close) || 0,
    upsell: Number(r.upsell) || 0,
    crm: Number(r.crm) || 0,
    hopefulPhoneClose: Number(r.hopeful_phone_close) || 0,
    hopefulCrm: Number(r.hopeful_crm) || 0,
    hopefulUpsell: Number(r.hopeful_upsell) || 0,
    note: r.note ?? "",
  }));

  const closedRows = saleRows.filter((r) => parseNoteStatus(r.note) === "closed");
  const totalPhoneClose = closedRows.reduce((s, r) => s + r.phoneClose + r.hopefulPhoneClose, 0);
  const totalUpsell = closedRows.reduce((s, r) => s + r.upsell + r.hopefulUpsell, 0);
  const totalCrm = closedRows.reduce((s, r) => s + r.crm + r.hopefulCrm, 0);

  return {
    agentName: profile?.nickname ?? "",
    rows: saleRows,
    totalPhoneClose,
    totalUpsell,
    totalCrm,
    totalSales: totalPhoneClose + totalUpsell + totalCrm,
    orderCount: closedRows.length,
  };
}

// Get all agents data (for supervisor/war room)
export async function getAllAgentsData(): Promise<AgentData[]> {
  const { data: profiles } = await adminClient.from("profiles").select("id, nickname").eq("role", "agent");
  if (!profiles) return [];
  return Promise.all(profiles.map(p => getMyData(p.id).then(d => d ?? { agentName: p.nickname, rows: [], totalPhoneClose: 0, totalUpsell: 0, totalCrm: 0, totalSales: 0, orderCount: 0 })));
}

// Add a sale for the current user
export async function addSale(userId: string, row: SaleRow): Promise<void> {
  const { error } = await adminClient.from("sales").insert({
    agent_id: userId,
    date: row.date,
    customer_name: row.name,
    phone: row.phone,
    address: row.address,
    product: row.product,
    quantity: row.quantity || 1,
    phone_close: row.phoneClose || 0,
    upsell: row.upsell || 0,
    crm: row.crm || 0,
    hopeful_phone_close: row.hopefulPhoneClose || 0,
    hopeful_crm: row.hopefulCrm || 0,
    hopeful_upsell: row.hopefulUpsell || 0,
    note: row.note,
  });
  if (error) throw new Error(error.message);
}

// วันนี้ในรูปแบบ DD/MM/YYYY และ DD/MM/YYYY (พ.ศ.) — ใช้เวลาไทย UTC+7
function todayStrings(): string[] {
  const thai = new Date(Date.now() + 7 * 3600000);
  const dd = String(thai.getUTCDate()).padStart(2, "0");
  const mm = String(thai.getUTCMonth() + 1).padStart(2, "0");
  const ce = thai.getUTCFullYear();
  const be = ce + 543;
  return [`${dd}/${mm}/${ce}`, `${dd}/${mm}/${be}`];
}

export function filterToday(rows: SaleRow[]): SaleRow[] {
  const today = todayStrings();
  return rows.filter((r) => today.some((t) => r.date.startsWith(t) || r.date === t));
}

export function filterClosed(rows: SaleRow[]): SaleRow[] {
  return rows.filter((r) => parseNoteStatus(r.note) === "closed");
}

export function filterLost(rows: SaleRow[]): SaleRow[] {
  return rows.filter((r) => parseNoteStatus(r.note) === "lost");
}

// filter rows ที่ note บ่งบอกว่าต้อง follow-up
export function filterFollowUp(rows: SaleRow[]): SaleRow[] {
  const keywords = ["ติดตาม", "follow", "โทรตาม", "ตาม", "รอตาม", "นัด"];
  return rows.filter((r) =>
    keywords.some((k) => r.note.toLowerCase().includes(k.toLowerCase()))
  );
}

// filter rows ที่ note บ่งบอกว่ารอโอน/รอชำระ
export function filterPending(rows: SaleRow[]): SaleRow[] {
  const keywords = ["รอโอน", "รอสลิป", "รอยืนยัน", "รอชำระ", "รอ"];
  return rows.filter((r) =>
    keywords.some((k) => r.note.toLowerCase().includes(k.toLowerCase()))
  );
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getDailyTarget(): Promise<number> {
  noStore();
  try {
    const { data } = await adminClient
      .from("team_config")
      .select("value")
      .eq("key", "daily_target")
      .single();
    return Number(data?.value) || 80000;
  } catch {
    return 80000;
  }
}

export async function setDailyTarget(value: number, userId: string): Promise<void> {
  await adminClient.from("team_config").upsert({
    key: "daily_target",
    value: String(value),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
}

// Per-agent target — falls back to team daily_target if not set
export async function getAgentTarget(agentId: string): Promise<number> {
  try {
    const { data } = await adminClient
      .from("team_config")
      .select("value")
      .eq("key", `agent_target_${agentId}`)
      .single();
    if (data?.value) return Number(data.value);
  } catch { /* no individual target set */ }
  return getDailyTarget();
}

export async function setAgentTarget(agentId: string, value: number, userId: string): Promise<void> {
  await adminClient.from("team_config").upsert({
    key: `agent_target_${agentId}`,
    value: String(value),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
}

// ── Oreka (dtac OneCall) Local Party mapping ──────────────────────────────────
export interface AgentWithOrekaExt {
  agentId: string;
  agentName: string;
  orekaExt: string;        // Gosell "+66..." local-party, "" if unset
  orekaExtHopeful: string; // Hopeful "+66..." local-party, "" if unset
}

export async function getAgentsWithOrekaExt(): Promise<AgentWithOrekaExt[]> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, nickname, oreka_ext, oreka_ext_hopeful")
    .eq("role", "agent");
  if (error || !data) {
    const { data: basic } = await adminClient.from("profiles").select("id, nickname").eq("role", "agent");
    return (basic ?? []).map((p: { id: string; nickname: string }) => ({ agentId: p.id, agentName: p.nickname, orekaExt: "", orekaExtHopeful: "" }));
  }
  return data.map((p: { id: string; nickname: string; oreka_ext: string | null; oreka_ext_hopeful: string | null }) => ({
    agentId: p.id,
    agentName: p.nickname,
    orekaExt: p.oreka_ext ?? "",
    orekaExtHopeful: p.oreka_ext_hopeful ?? "",
  }));
}

export async function setAgentOrekaExt(agentId: string, ext: string): Promise<void> {
  await adminClient.from("profiles").update({ oreka_ext: ext || null }).eq("id", agentId);
}

// Labels for Oreka extensions that aren't tied to a profile (e.g. "ว่าง 1", "เบอร์สำรอง")
// Stored as team_config rows with key = "oreka_label_<ext>"
export async function getOrekaLabels(): Promise<Record<string, string>> {
  const { data } = await adminClient
    .from("team_config")
    .select("key, value")
    .like("key", "oreka_label_%");
  const labels: Record<string, string> = {};
  for (const row of data ?? []) {
    const ext = row.key.replace("oreka_label_", "");
    if (ext && row.value) labels[ext] = row.value;
  }
  return labels;
}

export async function setOrekaLabel(ext: string, label: string, userId: string): Promise<void> {
  const key = `oreka_label_${ext}`;
  if (!label.trim()) {
    await adminClient.from("team_config").delete().eq("key", key);
  } else {
    await adminClient.from("team_config").upsert({ key, value: label.trim(), updated_by: userId });
  }
}

// Closed (excluded) talk-time numbers, per account.
// Stored as team_config rows with key = "oreka_closed_<account>_<ext>".
// Returns keys in "<account>:<ext>" form for the client.
export async function getClosedOrekaExts(): Promise<string[]> {
  const { data } = await adminClient
    .from("team_config")
    .select("key")
    .like("key", "oreka_closed_%");
  const out: string[] = [];
  for (const row of data ?? []) {
    const rest = String(row.key).replace("oreka_closed_", "");
    const i = rest.indexOf("_"); // account has no "_"; ext is "+66…"
    if (i < 0) continue;
    const account = rest.slice(0, i), ext = rest.slice(i + 1);
    if (account && ext) out.push(`${account}:${ext}`);
  }
  return out;
}

export async function setOrekaClosed(account: string, ext: string, closed: boolean, userId: string): Promise<void> {
  const key = `oreka_closed_${account}_${ext}`;
  if (closed) {
    await adminClient.from("team_config").upsert({ key, value: "1", updated_by: userId });
  } else {
    await adminClient.from("team_config").delete().eq("key", key);
  }
}

// Rename an agent by their current (unique) nickname. Updates profiles.nickname —
// the name shown everywhere in the app. Fails if the new name is already taken.
export async function renameAgentNickname(oldNickname: string, newName: string): Promise<{ ok: boolean; error?: string }> {
  const next = newName.trim();
  if (!next) return { ok: false, error: "กรุณากรอกชื่อ" };
  if (next === oldNickname) return { ok: true };

  const { data: clash } = await adminClient.from("profiles").select("id").eq("nickname", next).maybeSingle();
  if (clash) return { ok: false, error: "ชื่อนี้ถูกใช้แล้ว" };

  const { error } = await adminClient.from("profiles").update({ nickname: next }).eq("nickname", oldNickname);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface AgentWithTarget {
  agentId: string;
  agentName: string;
  target: number;
  hasCustomTarget: boolean;
}

export async function getAgentsWithTargets(): Promise<AgentWithTarget[]> {
  noStore();
  const teamTarget = await getDailyTarget();
  const [{ data: profiles }, { data: configRows }] = await Promise.all([
    adminClient.from("profiles").select("id, nickname").eq("role", "agent"),
    adminClient.from("team_config").select("key, value").like("key", "agent_target_%"),
  ]);
  if (!profiles) return [];
  const targetMap: Record<string, number> = {};
  (configRows ?? []).forEach((row: { key: string; value: string }) => {
    const id = row.key.replace("agent_target_", "");
    targetMap[id] = Number(row.value) || 0;
  });
  return profiles.map((p: { id: string; nickname: string }) => ({
    agentId: p.id,
    agentName: p.nickname,
    target: targetMap[p.id] ?? teamTarget,
    hasCustomTarget: !!targetMap[p.id],
  }));
}


// ── Note parsing helpers ── (re-exported from lib/note-utils for client-safe import)

// ── Agent analysis (parses notes for supervisor) ──────────────────────────────

export interface AgentAnalysis {
  agentName: string;
  agentId: string;
  avatarUrl: string;
  todaySales: number;
  todayOrders: number;
  allSales: number;
  allOrders: number;
  pendingTransferRows: SaleRow[];
  followUpRows: SaleRow[];
  objections: Record<string, number>;
  statusCounts: Record<string, number>;
  todayRows: SaleRow[];
  allRows: SaleRow[];
}

export async function getAllAgentsAnalysis(): Promise<AgentAnalysis[]> {
  noStore();
  const { data: profiles } = await adminClient.from("profiles").select("id, nickname").eq("role", "agent");
  if (!profiles || profiles.length === 0) return [];

  // Fetch avatar URLs from auth user metadata
  const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const avatarMap: Record<string, string> = {};
  usersData?.users.forEach((u) => {
    if (u.user_metadata?.avatar_url) avatarMap[u.id] = u.user_metadata.avatar_url;
  });

  const { data: allSalesRaw } = await adminClient
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });

  if (!allSalesRaw) return [];

  const today = todayStrings();

  return profiles.map((profile) => {
    const raw = allSalesRaw.filter((s) => s.agent_id === profile.id);

    const allRows: SaleRow[] = raw.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.customer_name,
      phone: r.phone ?? "",
      address: r.address ?? "",
      product: r.product ?? "",
      quantity: Number(r.quantity) || 1,
      phoneClose: Number(r.phone_close) || 0,
      upsell: Number(r.upsell) || 0,
      crm: Number(r.crm) || 0,
      hopefulPhoneClose: Number(r.hopeful_phone_close) || 0,
      hopefulCrm: Number(r.hopeful_crm) || 0,
      hopefulUpsell: Number(r.hopeful_upsell) || 0,
      note: r.note ?? "",
    }));

    const todayRows = allRows.filter((r) => today.some((t) => r.date.startsWith(t) || r.date === t));
    const todayClosedRows = todayRows.filter((r) => parseNoteStatus(r.note) === "closed");
    const todaySales = todayClosedRows.reduce((s, r) => s + r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell, 0);

    const statusCounts: Record<string, number> = {};
    const objections: Record<string, number> = {};

    allRows.forEach((r) => {
      const st = parseNoteStatus(r.note);
      statusCounts[st] = (statusCounts[st] ?? 0) + 1;
      const obj = parseNoteObjection(r.note);
      if (obj) objections[obj] = (objections[obj] ?? 0) + 1;
    });

    return {
      agentName: profile.nickname,
      agentId: profile.id,
      avatarUrl: avatarMap[profile.id] ?? "",
      todaySales,
      todayOrders: todayClosedRows.length,
      allSales: allRows.filter((r) => parseNoteStatus(r.note) === "closed").reduce((s, r) => s + r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell, 0),
      allOrders: allRows.filter((r) => parseNoteStatus(r.note) === "closed").length,
      pendingTransferRows: allRows.filter((r) => parseNoteStatus(r.note) === "pending_transfer"),
      followUpRows: allRows.filter((r) => parseNoteStatus(r.note) === "follow_up"),
      objections,
      statusCounts,
      todayRows,
      allRows,
    };
  });
}

// ── Coaching sessions ──────────────────────────────────────────────────────────

export interface CoachingSession {
  id: string;
  agentName: string;
  topic: string;
  actionItem: string;
  followUpDate: string;
  result: string;
  createdAt: string;
}

export async function getCoachingSessions(): Promise<CoachingSession[]> {
  const { data } = await adminClient
    .from("coaching_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((d) => ({
    id: d.id,
    agentName: d.agent_name,
    topic: d.topic,
    actionItem: d.action_item ?? "",
    followUpDate: d.follow_up_date ?? "—",
    result: d.result ?? "pending",
    createdAt: d.created_at,
  }));
}

export async function addCoachingSession(
  session: Omit<CoachingSession, "id" | "createdAt"> & { createdBy: string }
): Promise<void> {
  const { error } = await adminClient.from("coaching_sessions").insert({
    agent_name: session.agentName,
    topic: session.topic,
    action_item: session.actionItem,
    follow_up_date: session.followUpDate,
    result: "pending",
    created_by: session.createdBy,
  });
  if (error) throw new Error(error.message);
}

export async function updateCoachingResult(id: string, result: string): Promise<void> {
  await adminClient.from("coaching_sessions").update({ result }).eq("id", id);
}

export async function updateSaleNote(id: string, note: string): Promise<void> {
  const { error } = await adminClient.from("sales").update({ note }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSale(id: string, agentId: string, row: Partial<SaleRow>): Promise<void> {
  const { error } = await adminClient.from("sales").update({
    date: row.date,
    customer_name: row.name,
    phone: row.phone,
    address: row.address,
    product: row.product,
    phone_close: row.phoneClose ?? 0,
    upsell: row.upsell ?? 0,
    crm: row.crm ?? 0,
    hopeful_phone_close: row.hopefulPhoneClose ?? 0,
    hopeful_crm: row.hopefulCrm ?? 0,
    hopeful_upsell: row.hopefulUpsell ?? 0,
    note: row.note,
  }).eq("id", id).eq("agent_id", agentId);
  if (error) throw new Error(error.message);
}

export async function deleteSale(id: string, agentId: string): Promise<void> {
  const { error } = await adminClient.from("sales").delete().eq("id", id).eq("agent_id", agentId);
  if (error) throw new Error(error.message);
}

// ── Daily report (per-agent totals for one specific day) ─────────────────────

export interface DailySalesRow {
  agentId: string;
  agentName: string;
  total: number;
  orders: number;
  phoneClose: number;
  crm: number;
  upsell: number;
}

export async function getDailySalesForDate(dateISO: string): Promise<DailySalesRow[]> {
  const [y, m, d] = dateISO.split("-");
  const ce = Number(y);
  const be = ce + 543;
  const dmyCE = `${d}/${m}/${ce}`;
  const dmyBE = `${d}/${m}/${be}`;

  const [{ data: profiles }, { data: sales }] = await Promise.all([
    adminClient.from("profiles").select("id, nickname").eq("role", "agent"),
    adminClient.from("sales").select("agent_id, phone_close, upsell, crm, hopeful_phone_close, hopeful_crm, hopeful_upsell, note, date"),
  ]);

  if (!profiles || !sales) return [];

  const profileMap: Record<string, string> = {};
  (profiles as { id: string; nickname: string }[]).forEach((p) => { profileMap[p.id] = p.nickname; });

  const agentMap = new Map<string, DailySalesRow>();

  (sales as { agent_id: string; phone_close: number; upsell: number; crm: number; hopeful_phone_close: number; hopeful_crm: number; hopeful_upsell: number; note: string; date: string }[]).forEach((s) => {
    if (s.date !== dmyCE && s.date !== dmyBE) return;
    if (parseNoteStatus(s.note ?? "") !== "closed") return;

    if (!agentMap.has(s.agent_id)) {
      agentMap.set(s.agent_id, {
        agentId: s.agent_id,
        agentName: profileMap[s.agent_id] ?? "—",
        total: 0, orders: 0, phoneClose: 0, crm: 0, upsell: 0,
      });
    }
    const row = agentMap.get(s.agent_id)!;
    const pc = (Number(s.phone_close) || 0) + (Number(s.hopeful_phone_close) || 0);
    const cr = (Number(s.crm) || 0) + (Number(s.hopeful_crm) || 0);
    const up = (Number(s.upsell) || 0) + (Number(s.hopeful_upsell) || 0);
    row.phoneClose += pc;
    row.crm += cr;
    row.upsell += up;
    row.total += pc + cr + up;
    row.orders += 1;
  });

  return Array.from(agentMap.values()).sort((a, b) => b.total - a.total);
}

// ── Monthly report ────────────────────────────────────────────────────────────

export interface MonthlyAgentRow {
  agentId: string;
  agentName: string;
  // combined totals (used by existing ranking table)
  phoneClose: number;
  crm: number;
  upsell: number;
  total: number;
  orders: number;
  // GoSell breakdown (crm + upsell columns only, no hopeful)
  gosellCrm: number;
  gosellUpsell: number;
  gosellTotal: number;
  gosellOrders: number;
  // Hopeful breakdown (hopeful_* columns)
  hopefulPhoneClose: number;
  hopefulCrm: number;
  hopefulUpsell: number;
  hopefulTotal: number;
  hopefulOrders: number;
}

export interface MonthlyReportRow {
  monthKey: string;   // "MM/YYYY" CE
  label: string;      // "ม.ค. 2026"
  phoneClose: number;
  crm: number;
  upsell: number;
  total: number;
  orders: number;
  agents: MonthlyAgentRow[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

function parseDateToMonthKey(dateStr: string): string | null {
  const parts = dateStr.split("/");
  if (parts.length < 3) return null;
  const mm = parts[1].padStart(2, "0");
  let yy = Number(parts[2].slice(0, 4));
  if (yy > 2500) yy -= 543;
  return `${mm}/${yy}`;
}

export async function getMonthlyReport(): Promise<MonthlyReportRow[]> {
  const [{ data: profiles }, { data: allSales }] = await Promise.all([
    adminClient.from("profiles").select("id, nickname").eq("role", "agent"),
    adminClient.from("sales").select("agent_id, date, phone_close, upsell, crm, hopeful_phone_close, hopeful_crm, hopeful_upsell, note").order("date", { ascending: true }),
  ]);
  if (!allSales || !profiles) return [];

  const profileMap: Record<string, string> = {};
  (profiles as { id: string; nickname: string }[]).forEach((p) => { profileMap[p.id] = p.nickname; });

  const monthMap = new Map<string, MonthlyReportRow>();

  (allSales as { agent_id: string; date: string; phone_close: number; upsell: number; crm: number; hopeful_phone_close: number; hopeful_crm: number; hopeful_upsell: number; note: string }[]).forEach((s) => {
    if (parseNoteStatus(s.note ?? "") !== "closed") return;
    const key = parseDateToMonthKey(s.date ?? "");
    if (!key) return;
    const [mm, yyyy] = key.split("/");
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        monthKey: key,
        label: `${MONTH_LABELS[mm] ?? mm} ${yyyy}`,
        phoneClose: 0, crm: 0, upsell: 0, total: 0, orders: 0, agents: [],
      });
    }
    const row = monthMap.get(key)!;
    const phoneCloseVal = (Number(s.phone_close) || 0) + (Number(s.hopeful_phone_close) || 0);
    const crmVal = (Number(s.crm) || 0) + (Number(s.hopeful_crm) || 0);
    const upsellVal = (Number(s.upsell) || 0) + (Number(s.hopeful_upsell) || 0);
    row.phoneClose += phoneCloseVal;
    row.crm += crmVal;
    row.upsell += upsellVal;
    row.total += phoneCloseVal + crmVal + upsellVal;
    row.orders += 1;

    const rawPhoneClose = Number(s.phone_close) || 0;
    const rawCrm = Number(s.crm) || 0;
    const rawUpsell = Number(s.upsell) || 0;
    const rawHopefulPhoneClose = Number(s.hopeful_phone_close) || 0;
    const rawHopefulCrm = Number(s.hopeful_crm) || 0;
    const rawHopefulUpsell = Number(s.hopeful_upsell) || 0;

    const hasGosell = rawCrm + rawUpsell > 0;
    const hasHopeful = rawHopefulPhoneClose + rawHopefulCrm + rawHopefulUpsell > 0;

    let agentRow = row.agents.find((a) => a.agentId === s.agent_id);
    if (!agentRow) {
      agentRow = {
        agentId: s.agent_id, agentName: profileMap[s.agent_id] ?? "—",
        phoneClose: 0, crm: 0, upsell: 0, total: 0, orders: 0,
        gosellCrm: 0, gosellUpsell: 0, gosellTotal: 0, gosellOrders: 0,
        hopefulPhoneClose: 0, hopefulCrm: 0, hopefulUpsell: 0, hopefulTotal: 0, hopefulOrders: 0,
      };
      row.agents.push(agentRow);
    }
    agentRow.phoneClose += phoneCloseVal;
    agentRow.crm += crmVal;
    agentRow.upsell += upsellVal;
    agentRow.total += phoneCloseVal + crmVal + upsellVal;
    agentRow.orders += 1;

    agentRow.gosellCrm += rawCrm;
    agentRow.gosellUpsell += rawUpsell;
    agentRow.gosellTotal += rawCrm + rawUpsell;
    if (hasGosell) agentRow.gosellOrders += 1;

    agentRow.hopefulPhoneClose += rawHopefulPhoneClose;
    agentRow.hopefulCrm += rawHopefulCrm;
    agentRow.hopefulUpsell += rawHopefulUpsell;
    agentRow.hopefulTotal += rawHopefulPhoneClose + rawHopefulCrm + rawHopefulUpsell;
    if (hasHopeful) agentRow.hopefulOrders += 1;
  });

  return Array.from(monthMap.values()).sort((a, b) => {
    const [am, ay] = a.monthKey.split("/").map(Number);
    const [bm, by] = b.monthKey.split("/").map(Number);
    return ay !== by ? ay - by : am - bm;
  });
}

// ── Hourly sales for today (Thailand UTC+7) ───────────────────────────────────

export async function getTodayHourlySales(): Promise<{ hour: number; sales: number; orders: number }[]> {
  noStore();
  const now = new Date();
  // Thai midnight = UTC midnight minus 7 hours
  const thaiMidnightUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + (now.getUTCHours() < 17 ? 0 : 1), // if before 17:00 UTC (00:00 TH) use today, else next UTC day
    -7, 0, 0, 0
  ));
  // Simpler: midnight Thailand = UTC - 7h
  const todayThaiStart = new Date(now);
  const thaiHour = (now.getUTCHours() + 7) % 24;
  const thaiDay = new Date(now.getTime() + 7 * 3600000);
  const midnightThai = new Date(Date.UTC(thaiDay.getUTCFullYear(), thaiDay.getUTCMonth(), thaiDay.getUTCDate()) - 7 * 3600000);

  const { data } = await adminClient
    .from("sales")
    .select("phone_close, upsell, crm, hopeful_phone_close, hopeful_crm, hopeful_upsell, created_at, note")
    .gte("created_at", midnightThai.toISOString());

  if (!data) return Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0 }));

  const hourMap: Record<number, { sales: number; orders: number }> = {};
  (data as { phone_close: number; upsell: number; crm: number; hopeful_phone_close: number; hopeful_crm: number; hopeful_upsell: number; created_at: string; note: string }[]).forEach((s) => {
    if (parseNoteStatus(s.note ?? "") !== "closed") return;
    const h = (new Date(s.created_at).getUTCHours() + 7) % 24;
    if (!hourMap[h]) hourMap[h] = { sales: 0, orders: 0 };
    hourMap[h].sales += Number(s.phone_close) + Number(s.upsell) + Number(s.crm)
                      + Number(s.hopeful_phone_close) + Number(s.hopeful_crm) + Number(s.hopeful_upsell);
    hourMap[h].orders += 1;
  });

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    sales: hourMap[h]?.sales ?? 0,
    orders: hourMap[h]?.orders ?? 0,
  }));
}

// ── Daily heatmap for current Thai month ─────────────────────────────────────

export interface DailyAgentRow {
  agentId: string;
  agentName: string;
  days: Record<number, number>; // day-of-month → total sales
  monthTotal: number;
}

// monthKey format: "MM/YYYY" (CE). When omitted, uses current Thai month.
export async function getDailyAgentSales(monthKey?: string): Promise<{ agents: DailyAgentRow[]; daysInMonth: number; today: number }> {
  const now = new Date(Date.now() + 7 * 3600000); // Thai time
  const thaiYear = now.getUTCFullYear();
  const thaiMonth = now.getUTCMonth() + 1;
  const thaiDay = now.getUTCDate();

  let targetMM: string;
  let targetCE: number;
  if (monthKey) {
    const [mm, yyyy] = monthKey.split("/");
    targetMM = mm.padStart(2, "0");
    targetCE = Number(yyyy);
  } else {
    targetMM = String(thaiMonth).padStart(2, "0");
    targetCE = thaiYear;
  }

  const daysInMonth = new Date(targetCE, Number(targetMM), 0).getDate();
  const ceCE = targetCE;
  const beBE = targetCE + 543;
  const beMM = targetMM;
  const mm = targetMM;

  const isCurrentMonth = !monthKey || (targetCE === thaiYear && Number(targetMM) === thaiMonth);
  const todayDisplay = isCurrentMonth ? thaiDay : daysInMonth;

  const [{ data: profiles }, { data: allSales }] = await Promise.all([
    adminClient.from("profiles").select("id, nickname").eq("role", "agent"),
    adminClient.from("sales").select("agent_id, date, phone_close, upsell, crm, hopeful_phone_close, hopeful_crm, hopeful_upsell, note"),
  ]);
  if (!allSales || !profiles) return { agents: [], daysInMonth, today: todayDisplay };

  const profileMap: Record<string, string> = {};
  (profiles as { id: string; nickname: string }[]).forEach((p) => { profileMap[p.id] = p.nickname; });

  const agentMap = new Map<string, DailyAgentRow>();

  (allSales as { agent_id: string; date: string; phone_close: number; upsell: number; crm: number; hopeful_phone_close: number; hopeful_crm: number; hopeful_upsell: number; note: string }[]).forEach((s) => {
    if (parseNoteStatus(s.note ?? "") !== "closed") return;
    const parts = (s.date ?? "").split("/");
    if (parts.length < 3) return;
    const day = Number(parts[0]);
    const mon = parts[1].padStart(2, "0");
    const yr = Number(parts[2].slice(0, 4));
    const isCE = yr === ceCE && mon === beMM;
    const isBE = yr === beBE && mon === beMM;
    if (!isCE && !isBE) return;

    const id = s.agent_id;
    if (!agentMap.has(id)) {
      agentMap.set(id, { agentId: id, agentName: profileMap[id] ?? "—", days: {}, monthTotal: 0 });
    }
    const row = agentMap.get(id)!;
    const val = (Number(s.phone_close) || 0) + (Number(s.crm) || 0) + (Number(s.upsell) || 0)
              + (Number(s.hopeful_phone_close) || 0) + (Number(s.hopeful_crm) || 0) + (Number(s.hopeful_upsell) || 0);
    row.days[day] = (row.days[day] ?? 0) + val;
    row.monthTotal += val;
  });

  const agents = Array.from(agentMap.values()).sort((a, b) => b.monthTotal - a.monthTotal);
  return { agents, daysInMonth, today: todayDisplay };
}

// ── Customer history ──────────────────────────────────────────────────────────

export async function getCustomerHistoryByPhone(phone: string, agentId: string): Promise<SaleRow[]> {
  const trimmed = phone.trim();
  if (!trimmed) return [];
  const { data } = await adminClient
    .from("sales")
    .select("*")
    .eq("agent_id", agentId)
    .eq("phone", trimmed)
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    date: r.date,
    name: r.customer_name,
    phone: r.phone ?? "",
    address: r.address ?? "",
    product: r.product ?? "",
    quantity: Number(r.quantity) || 1,
    phoneClose: Number(r.phone_close) || 0,
    upsell: Number(r.upsell) || 0,
    crm: Number(r.crm) || 0,
    hopefulPhoneClose: Number(r.hopeful_phone_close) || 0,
    hopefulCrm: Number(r.hopeful_crm) || 0,
    hopefulUpsell: Number(r.hopeful_upsell) || 0,
    note: r.note ?? "",
  }));
}

// ── Monthly targets per agent ─────────────────────────────────────────────────

export interface AgentWithMonthlyTarget {
  agentId: string;
  agentName: string;
  monthlyTarget: number | null;
}

export async function getAgentsWithMonthlyTargets(monthKey: string): Promise<AgentWithMonthlyTarget[]> {
  const [{ data: profiles }, { data: configRows }] = await Promise.all([
    adminClient.from("profiles").select("id, nickname").eq("role", "agent"),
    adminClient.from("team_config").select("key, value").like("key", `agent_monthly_%_${monthKey}`),
  ]);
  if (!profiles) return [];
  const targetMap: Record<string, number> = {};
  const prefix = "agent_monthly_";
  (configRows ?? []).forEach((row: { key: string; value: string }) => {
    const rest = row.key.slice(prefix.length);
    const lastUnderscore = rest.lastIndexOf("_");
    const agentId = rest.slice(0, lastUnderscore);
    targetMap[agentId] = Number(row.value) || 0;
  });
  return (profiles as { id: string; nickname: string }[]).map((p) => ({
    agentId: p.id,
    agentName: p.nickname,
    monthlyTarget: targetMap[p.id] ?? null,
  }));
}

export async function setAgentMonthlyTarget(agentId: string, monthKey: string, value: number, userId: string): Promise<void> {
  await adminClient.from("team_config").upsert({
    key: `agent_monthly_${agentId}_${monthKey}`,
    value: String(value),
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
}

export async function getAgentMonthlyTarget(agentId: string, monthKey: string): Promise<number | null> {
  const { data } = await adminClient
    .from("team_config")
    .select("value")
    .eq("key", `agent_monthly_${agentId}_${monthKey}`)
    .single();
  return data?.value ? Number(data.value) : null;
}

export async function getAgentMonthlySales(userId: string, monthKey: string): Promise<number> {
  const [year, month] = monthKey.split("-");
  const ceYear = Number(year);
  const beYear = ceYear + 543;
  // Fetch all sales for the agent and filter in JS — avoids PostgREST ilike/slash parsing issues
  const { data } = await adminClient
    .from("sales")
    .select("phone_close, upsell, crm, hopeful_phone_close, hopeful_crm, hopeful_upsell, note, date")
    .eq("agent_id", userId);
  if (!data) return 0;
  return (data as { phone_close: number; upsell: number; crm: number; hopeful_phone_close: number; hopeful_crm: number; hopeful_upsell: number; note: string; date: string }[]).reduce((sum, s) => {
    if (parseNoteStatus(s.note ?? "") !== "closed") return sum;
    const parts = (s.date ?? "").split("/");
    if (parts.length < 3) return sum;
    const mon = parts[1].padStart(2, "0");
    const yr = Number(parts[2].slice(0, 4));
    if (mon !== month || (yr !== ceYear && yr !== beYear)) return sum;
    return sum + (Number(s.phone_close) || 0) + (Number(s.upsell) || 0) + (Number(s.crm) || 0)
              + (Number(s.hopeful_phone_close) || 0) + (Number(s.hopeful_crm) || 0) + (Number(s.hopeful_upsell) || 0);
  }, 0);
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<string[]> {
  const { data } = await adminClient
    .from("products")
    .select("name")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: { name: string }) => r.name);
}

export async function addProduct(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("ชื่อสินค้าว่างเปล่า");
  const { error } = await adminClient.from("products").insert({ name: trimmed, active: true });
  if (error) throw new Error(error.message);
}

export async function deleteProduct(name: string): Promise<void> {
  const { error } = await adminClient.from("products").delete().eq("name", name);
  if (error) throw new Error(error.message);
}

// ── สร้าง trend ยอดขายรายวัน (28 วันล่าสุด)
export function buildTrend(rows: SaleRow[]): { day: string; sales: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const key = r.date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + r.phoneClose + r.upsell + r.crm);
  });

  const result: { day: string; sales: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const ce = d.getFullYear();
    const be = ce + 543;
    const keyCE = `${dd}/${mm}/${ce}`;
    const keyBE = `${dd}/${mm}/${be}`;
    const sales = map.get(keyCE) ?? map.get(keyBE) ?? 0;
    result.push({ day: `${dd}/${mm}`, sales });
  }
  return result;
}
