"use client";

import { useState } from "react";
import type { SaleRow } from "@/lib/db";
import { rowObjection } from "@/lib/note-utils";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";

const RECOVER_PRESETS = ["ติดตาม", "นัดโทรพรุ่งนี้", "รอโอน"];

function daysSince(dateStr: string): number {
  const parts = dateStr.split("/");
  if (parts.length < 3) return 0;
  const [d, m, y] = parts;
  let year = parseInt(y);
  if (year > 2500) year -= 543;
  const date = new Date(year, parseInt(m) - 1, parseInt(d));
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

function cancelReason(note: string): string {
  const n = note.toLowerCase();
  if (n.includes("ไม่สนใจ")) return "ไม่สนใจ";
  if (n.includes("ยกเลิก")) return "ยกเลิก";
  if (n.includes("หลุด")) return "หลุด";
  return "ยกเลิก";
}

export default function CanceledClient({ lostRows }: { lostRows: SaleRow[] }) {
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<SaleRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? lostRows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.product.toLowerCase().includes(q) ||
          r.note.toLowerCase().includes(q)
      )
    : lostRows;

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  // Objection breakdown for summary
  const objectionCount: Record<string, number> = {};
  lostRows.forEach((r) => {
    const obj = rowObjection(r) ?? cancelReason(r.note);
    objectionCount[obj] = (objectionCount[obj] ?? 0) + 1;
  });
  const topObjections = Object.entries(objectionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <>
      {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#3D3D3D]">ยกเลิก</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">
              เคสที่หลุด / ยกเลิก — แก้ไขสถานะเพื่อฟื้นฟู
            </p>
          </div>
          <div className="text-[12px] text-[#8B8E8F] bg-white border border-[#E8E8E8] rounded-lg px-3 py-1.5">
            ทั้งหมด <span className="font-semibold text-[#3D3D3D]">{lostRows.length} เคส</span>
          </div>
        </div>

        {/* Objection summary */}
        {topObjections.length > 0 && (
          <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
            <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
              สาเหตุที่พบบ่อย
            </div>
            <div className="flex flex-wrap gap-2">
              {topObjections.map(([label, count]) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 bg-[#FF6B6B]/8 border border-[#FF6B6B]/20 rounded-lg px-3 py-1.5"
                >
                  <span className="text-[12px] font-semibold text-[#FF6B6B]">{label}</span>
                  <span className="text-[10px] text-[#FF6B6B]/70">{count} เคส</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ เบอร์โทร สินค้า หรือหมายเหตุ..."
            className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#FF6B6B] focus:bg-white transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Empty states */}
        {lostRows.length === 0 ? (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#87DE81]/10 flex items-center justify-center text-2xl">
              🎉
            </div>
            <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีเคสที่ยกเลิก</p>
            <p className="text-[12px] text-[#8B8E8F] mt-1">
              รายการที่อัปเดตสถานะเป็น &ldquo;หลุด&rdquo; หรือ &ldquo;ยกเลิก&rdquo; จะแสดงที่นี่
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-10 text-center">
            <p className="text-[13px] text-[#8B8E8F]">ไม่พบรายการที่ตรงกับ &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((row, i) => {
              const total = row.phoneClose + row.upsell + row.crm + row.hopefulPhoneClose + row.hopefulCrm + row.hopefulUpsell;
              const days = daysSince(row.date);
              const objection = rowObjection(row);
              const reason = cancelReason(row.note);

              return (
                <div key={row.id ?? i} className="bg-white border border-[#FF6B6B]/20 rounded-xl overflow-hidden flex">
                  <div className="w-1 shrink-0 bg-[#FF6B6B]/40" />
                  <div className="flex-1 p-4">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B] text-[12px] font-bold shrink-0">
                        {row.name.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[13px] font-semibold text-[#3D3D3D]">{row.name}</span>
                          <span className="text-[10px] bg-[#FF6B6B]/10 text-[#FF6B6B] px-2 py-0.5 rounded-full font-medium">
                            {reason}
                          </span>
                          {objection && (
                            <span className="text-[10px] bg-[#F7F7F7] text-[#8B8E8F] border border-[#E8E8E8] px-2 py-0.5 rounded-full">
                              {objection}
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                          {row.product && <span className="text-[11px] text-[#8B8E8F]">📦 {row.product}</span>}
                          {row.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</span>}
                          {total > 0 && (
                            <span className="text-[11px] font-semibold text-[#8B8E8F] line-through">
                              ฿{total.toLocaleString()}
                            </span>
                          )}
                          <span className="text-[11px] text-[#C0C0C0]">
                            {days === 0 ? "วันนี้" : days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`}
                          </span>
                        </div>

                        {row.note && (
                          <div className="bg-[#F7F7F7] rounded-lg px-3 py-1.5 mb-2">
                            <p className="text-[11px] text-[#8B8E8F]">📝 {row.note}</p>
                          </div>
                        )}

                        {/* Update note panel — recovering a case means picking a new status */}
                        {row.id && (
                          <UpdateNotePanel
                            saleId={row.id}
                            currentNote={row.note}
                            presets={RECOVER_PRESETS}
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {row.phone && (
                          <a
                            href={`tel:${row.phone}`}
                            className="block text-center bg-[#F7F7F7] border border-[#E8E8E8] text-[#8B8E8F] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#E8E8E8] transition-colors"
                          >
                            โทร
                          </a>
                        )}
                        {row.id && (
                          <button
                            onClick={() => setEditRow(row)}
                            className="bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#FF6B6B]/20 transition-colors"
                          >
                            แก้ไข
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
