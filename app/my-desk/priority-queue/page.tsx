import { getMyData, getCurrentUser, parseNoteStatus, parseNoteObjection, type SaleRow } from "@/lib/db";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";

const PAIN_KEYWORDS = ["เวียนหัว", "ปวดท้ายทอย", "มือชา", "เท้าชา", "ไขมัน", "ความดัน", "ค่าไต", "บวม", "อ่อนเพลีย", "นอนไม่หลับ", "ขับถ่าย", "เบาหวาน", "อ้วน", "น้ำหนัก"];
const HOT_KEYWORDS = ["ถามราคา", "ถามโปร", "วิธีสั่ง", "เลขบัญชี", "เก็บปลายทาง", "กี่วันเห็นผล", "กินยังไง", "กี่กล่อง"];
const UPDATE_PRESETS = ["โอนแล้ว", "นัดโทรพรุ่งนี้", "ไม่รับสาย", "ติดตามอีกครั้ง", "รอสลิป", "ยกเลิก"];

interface ScoredRow {
  row: SaleRow;
  score: number;
  reason: string;
  group: 1 | 2 | 3;
  accentColor: string;
}

function daysSince(dateStr: string): number {
  // dateStr is DD/MM/YYYY or DD/MM/YYYY (BE)
  const parts = dateStr.split("/");
  if (parts.length < 3) return 0;
  const dd = parseInt(parts[0]);
  const mm = parseInt(parts[1]) - 1;
  let yy = parseInt(parts[2]);
  if (yy > 2400) yy -= 543; // convert BE to CE
  const date = new Date(yy, mm, dd);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function scoreRow(row: SaleRow): ScoredRow {
  const status = parseNoteStatus(row.note);
  const objection = parseNoteObjection(row.note);
  const note = row.note.toLowerCase();
  const total = row.phoneClose + row.upsell + row.crm;
  const days = daysSince(row.date);

  let score = 0;
  let reason = "รายการทั่วไป";

  // Base score by status
  if (status === "pending_transfer") {
    score += 30;
    reason = "รอโอน — ใกล้ปิด";
    if (days === 0) { score += 20; reason = "รอโอนวันนี้ — เสี่ยงหลุด"; }
  } else if (status === "follow_up") {
    score += 15;
    reason = "ติดตาม";
    if (days >= 1) { score += 15; reason = "Follow-up เลยเวลาแล้ว"; }
  } else if (status === "in_progress") {
    score += 5;
    reason = "อยู่ระหว่างดำเนินการ";
  }

  // Hot keywords
  if (HOT_KEYWORDS.some((k) => note.includes(k))) {
    score += 20;
    reason = "สนใจสูง — ถามราคา/โปร";
  }

  // Pain keywords
  if (PAIN_KEYWORDS.some((k) => note.includes(k))) {
    score += 15;
    if (score < 25) reason = "มี Pain ชัด";
  }

  // High intent objection (still wants to buy)
  if (objection && ["ขอคิดก่อน", "ถามญาติ", "ถามหมอ"].includes(objection)) {
    score += 10;
    if (score < 20) reason = `ลังเล — ${objection}`;
  }

  // Order value bonus
  if (total >= 5000) score += 10;
  else if (total >= 2000) score += 5;

  // Time decay
  if (days >= 14) score -= 20;
  else if (days >= 7) score -= 10;

  // Group & color
  let group: 1 | 2 | 3;
  let accentColor: string;

  if (status === "pending_transfer" || score >= 40) {
    group = 1;
    accentColor = "#FF6B6B";
  } else if (score >= 20) {
    group = 2;
    accentColor = "#F5A623";
  } else {
    group = 3;
    accentColor = "#C0C0C0";
  }

  return { row, score, reason, group, accentColor };
}

const GROUP_META = {
  1: { label: "ต้องทำทันที", emoji: "🔴", desc: "Pending payment และเคสที่เสี่ยงหลุด" },
  2: { label: "ควรทำต่อ", emoji: "🟡", desc: "เคสที่มีโอกาสปิดสูง" },
  3: { label: "ทำเมื่อเคลียร์แล้ว", emoji: "⚪", desc: "Follow-up เย็น และ lead ที่ยังต้อง nurture" },
} as const;

export default async function PriorityQueuePage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];

  // Exclude closed and lost — those belong in Customers List
  const activeRows = allRows.filter((r) => {
    const s = parseNoteStatus(r.note);
    return s !== "closed" && s !== "lost";
  });

  const scored = activeRows
    .map(scoreRow)
    .sort((a, b) => b.score - a.score);

  const groups = {
    1: scored.filter((s) => s.group === 1),
    2: scored.filter((s) => s.group === 2),
    3: scored.filter((s) => s.group === 3),
  } as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Priority Queue</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">เรียงจากเคสที่ใกล้ปิดการขายมากที่สุด</p>
        </div>
        <div className="text-[12px] text-[#8B8E8F] bg-white border border-[#E8E8E8] rounded-lg px-3 py-1.5">
          เคสที่ active <span className="font-semibold text-[#3D3D3D]">{activeRows.length} รายการ</span>
        </div>
      </div>

      {activeRows.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F7F7F7] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีเคสที่ active</p>
          <p className="text-[12px] text-[#8B8E8F] mt-1">กรอกข้อมูลลูกค้าแล้วรีเฟรชหน้านี้</p>
        </div>
      ) : (
        ([1, 2, 3] as const).map((g) => {
          const items = groups[g];
          if (items.length === 0) return null;
          const meta = GROUP_META[g];
          return (
            <section key={g}>
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[14px]">{meta.emoji}</span>
                <span className="text-[13px] font-semibold text-[#3D3D3D]">{meta.label}</span>
                <span className="text-[11px] text-[#8B8E8F]">— {meta.desc}</span>
                <span className="ml-auto text-[11px] bg-[#F7F7F7] border border-[#E8E8E8] text-[#8B8E8F] px-2 py-0.5 rounded-full">
                  {items.length} เคส
                </span>
              </div>

              <div className="space-y-3">
                {items.map(({ row, score, reason, accentColor }) => {
                  const total = row.phoneClose + row.upsell + row.crm;
                  const days = daysSince(row.date);
                  return (
                    <div key={row.id} className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden flex">
                      <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[12px] font-bold text-[#8B8E8F] shrink-0">
                            {row.name.charAt(0)}
                          </div>

                          {/* Main info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[13px] font-semibold text-[#3D3D3D]">{row.name}</span>
                              {row.product && (
                                <span className="text-[10px] bg-[#87DE81]/10 text-[#3D9B3A] px-2 py-0.5 rounded-full">
                                  {row.product}
                                </span>
                              )}
                              {/* Priority reason badge */}
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                              >
                                {reason}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap mb-1.5">
                              {row.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</span>}
                              <span className="text-[11px] text-[#C0C0C0]">
                                {days === 0 ? "วันนี้" : days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`}
                              </span>
                            </div>

                            {row.note && (
                              <div className="bg-[#F7F7F7] rounded-lg px-3 py-1.5 mb-2">
                                <p className="text-[11px] text-[#8B8E8F]">📝 {row.note}</p>
                              </div>
                            )}

                            {row.id && (
                              <UpdateNotePanel
                                saleId={row.id}
                                currentNote={row.note}
                                presets={UPDATE_PRESETS}
                              />
                            )}
                          </div>

                          {/* Score + value */}
                          <div className="shrink-0 text-right flex flex-col items-end gap-1">
                            <div
                              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                            >
                              {score} pts
                            </div>
                            {row.phoneClose > 0 && (
                              <div className="text-[11px] text-[#FFBA49]">เบอร์ ฿{row.phoneClose.toLocaleString()}</div>
                            )}
                            {row.upsell > 0 && (
                              <div className="text-[11px] text-[#3D9B3A]">฿{row.upsell.toLocaleString()}</div>
                            )}
                            {row.crm > 0 && (
                              <div className="text-[11px] text-[#0E8FA8]">CRM ฿{row.crm.toLocaleString()}</div>
                            )}
                            {total > 0 && (
                              <div className="text-[15px] font-bold text-[#3D3D3D]">฿{total.toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
