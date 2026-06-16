"use client";

import { useState, useMemo } from "react";
import type { SaleRow } from "@/lib/db";
import { parseNoteStatus, parseNoteObjection, saleTotal } from "@/lib/note-utils";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";

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
  const parts = dateStr.split("/");
  if (parts.length < 3) return 0;
  const dd = parseInt(parts[0]);
  const mm = parseInt(parts[1]) - 1;
  let yy = parseInt(parts[2]);
  if (yy > 2400) yy -= 543;
  const date = new Date(yy, mm, dd);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function scoreRow(row: SaleRow): ScoredRow {
  const status = parseNoteStatus(row.note);
  const objection = parseNoteObjection(row.note);
  const note = row.note.toLowerCase();
  const total = saleTotal(row);
  const days = daysSince(row.date);

  let score = 0;
  let reason = "รายการทั่วไป";

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

  if (HOT_KEYWORDS.some((k) => note.includes(k))) { score += 20; reason = "สนใจสูง — ถามราคา/โปร"; }
  if (PAIN_KEYWORDS.some((k) => note.includes(k))) { score += 15; if (score < 25) reason = "มี Pain ชัด"; }
  if (objection && ["ขอคิดก่อน", "ถามญาติ", "ถามหมอ"].includes(objection)) { score += 10; if (score < 20) reason = `ลังเล — ${objection}`; }

  if (total >= 5000) score += 10;
  else if (total >= 2000) score += 5;

  if (days >= 14) score -= 20;
  else if (days >= 7) score -= 10;

  let group: 1 | 2 | 3;
  let accentColor: string;

  if (status === "pending_transfer" || score >= 40) { group = 1; accentColor = "#FF6B6B"; }
  else if (score >= 20) { group = 2; accentColor = "#F5A623"; }
  else { group = 3; accentColor = "#C0C0C0"; }

  return { row, score, reason, group, accentColor };
}

const GROUP_META = {
  1: { label: "ต้องทำทันที", emoji: "🔴", desc: "Pending payment และเคสที่เสี่ยงหลุด" },
  2: { label: "ควรทำต่อ", emoji: "🟡", desc: "เคสที่มีโอกาสปิดสูง" },
  3: { label: "ทำเมื่อเคลียร์แล้ว", emoji: "⚪", desc: "Follow-up เย็น และ lead ที่ยังต้อง nurture" },
} as const;

export default function PriorityQueueClient({ activeRows }: { activeRows: SaleRow[] }) {
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<SaleRow | null>(null);

  const q = search.trim().toLowerCase();

  const scored = useMemo(() => {
    const rows = q
      ? activeRows.filter((r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q)
        )
      : activeRows;
    return rows.map(scoreRow).sort((a, b) => b.score - a.score);
  }, [activeRows, q]);

  const groups = {
    1: scored.filter((s) => s.group === 1),
    2: scored.filter((s) => s.group === 2),
    3: scored.filter((s) => s.group === 3),
  } as const;

  return (
    <>
    {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">คิวสำคัญ</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">เรียงจากเคสที่ใกล้ปิดการขายมากที่สุด</p>
        </div>
        <div className="text-[12px] text-[#8B8E8F] bg-white border border-[#E8E8E8] rounded-lg px-3 py-1.5">
          เคสที่ active <span className="font-semibold text-[#3D3D3D]">{activeRows.length} รายการ</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ เบอร์โทร สินค้า หรือหมายเหตุ..."
          className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
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
      ) : scored.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#8B8E8F]">ไม่พบเคสที่ตรงกับ &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        ([1, 2, 3] as const).map((g) => {
          const items = groups[g];
          if (items.length === 0) return null;
          const meta = GROUP_META[g];
          return (
            <section key={g}>
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
                  const total = saleTotal(row);
                  const days = daysSince(row.date);
                  return (
                    <div key={row.id} className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden flex">
                      <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[12px] font-bold text-[#8B8E8F] shrink-0">
                            {row.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[13px] font-semibold text-[#3D3D3D]">{row.name}</span>
                              {row.product && (
                                <span className="text-[10px] bg-[#87DE81]/10 text-[#3D9B3A] px-2 py-0.5 rounded-full">
                                  {row.product}
                                </span>
                              )}
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
                          <div className="shrink-0 text-right flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                              >
                                {score} pts
                              </div>
                              {row.id && (
                                <button
                                  onClick={() => setEditRow(row)}
                                  className="p-1.5 rounded-lg hover:bg-[#F7F7F7] text-[#C0C0C0] hover:text-[#8B8E8F] transition-colors"
                                  title="แก้ไข"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                            {row.phoneClose > 0 && <div className="text-[11px] text-[#FFBA49]">เบอร์ ฿{row.phoneClose.toLocaleString()}</div>}
                            {row.upsell > 0 && <div className="text-[11px] text-[#3D9B3A]">฿{row.upsell.toLocaleString()}</div>}
                            {row.crm > 0 && <div className="text-[11px] text-[#0E8FA8]">CRM ฿{row.crm.toLocaleString()}</div>}
                            {total > 0 && <div className="text-[15px] font-bold text-[#3D3D3D]">฿{total.toLocaleString()}</div>}
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
    </>
  );
}
