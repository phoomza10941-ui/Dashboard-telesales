"use client";

import { useState } from "react";
import type { SaleRow } from "@/lib/db";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";

const FOLLOW_UP_PRESETS = ["โอนแล้ว", "นัดโทรพรุ่งนี้", "ไม่รับสาย", "ติดตามอีกครั้ง", "ยกเลิก"];

function SmsButton({ phone }: { phone: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    // On mobile: opens SMS app. On desktop: fallback to copying the number.
    if (/Mobi|Android/i.test(navigator.userAgent)) {
      window.location.href = `sms:${phone}`;
    } else {
      navigator.clipboard.writeText(phone).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <button
      onClick={handleClick}
      className="bg-[#022EE8]/15 text-[#0E8FA8] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#022EE8]/25 transition-colors"
    >
      {copied ? "✓ คัดลอกแล้ว" : "ส่งข้อความ"}
    </button>
  );
}

export default function FollowUpClient({ followUpRows }: { followUpRows: SaleRow[] }) {
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<SaleRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? followUpRows.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q)
      )
    : followUpRows;

  return (
    <>
    {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Follow-up</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            รายการที่หมายเหตุระบุว่าต้องติดตาม / นัดโทร
          </p>
        </div>
        <div className="text-[12px] text-[#8B8E8F] bg-white border border-[#E8E8E8] rounded-lg px-3 py-1.5">
          ทั้งหมด <span className="font-semibold text-[#3D3D3D]">{followUpRows.length} เคส</span>
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
          className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8] focus:bg-white transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {followUpRows.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#022EE8]/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#022EE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีรายการ Follow-up</p>
          <p className="text-[12px] text-[#8B8E8F] mt-1">
            รายการที่หมายเหตุมีคำว่า &ldquo;ติดตาม&rdquo; หรือ &ldquo;นัด&rdquo; จะแสดงที่นี่
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#8B8E8F]">ไม่พบรายการที่ตรงกับ &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row, i) => {
            const total = row.phoneClose + row.upsell + row.crm + row.hopefulPhoneClose + row.hopefulCrm + row.hopefulUpsell;
            return (
              <div key={i} className="bg-white border border-[#022EE8]/25 rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#0E8FA8] text-[12px] font-bold shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-[#3D3D3D]">{row.name}</span>
                      <span className="text-[10px] bg-[#022EE8]/10 text-[#0E8FA8] px-2 py-0.5 rounded-full">
                        ติดตาม
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-1.5">
                      {row.product && <span className="text-[11px] text-[#8B8E8F]">📦 {row.product}</span>}
                      {row.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</span>}
                      {total > 0 && <span className="text-[11px] font-semibold text-[#3D9B3A]">฿{total.toLocaleString()}</span>}
                      <span className="text-[11px] text-[#C0C0C0]">{row.date}</span>
                    </div>
                    {row.note && (
                      <div className="bg-[#F7F7F7] rounded-lg px-3 py-2">
                        <p className="text-[11px] text-[#8B8E8F]">📝 {row.note}</p>
                      </div>
                    )}
                    {row.id && (
                      <UpdateNotePanel
                        saleId={row.id}
                        currentNote={row.note}
                        presets={FOLLOW_UP_PRESETS}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {row.phone ? (
                      <a
                        href={`tel:${row.phone}`}
                        className="block text-center bg-[#87DE81] text-white text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#6BC965] transition-colors"
                      >
                        โทร
                      </a>
                    ) : (
                      <button disabled className="bg-[#E8E8E8] text-[#C0C0C0] text-[12px] font-medium px-4 py-1.5 rounded-lg cursor-not-allowed">
                        โทร
                      </button>
                    )}
                    {row.phone ? (
                      <SmsButton phone={row.phone} />
                    ) : (
                      <button disabled className="bg-[#E8E8E8] text-[#C0C0C0] text-[12px] font-medium px-4 py-1.5 rounded-lg cursor-not-allowed">
                        ส่งข้อความ
                      </button>
                    )}
                    {row.id && (
                      <button
                        onClick={() => setEditRow(row)}
                        className="bg-[#F7F7F7] border border-[#E8E8E8] text-[#8B8E8F] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#E8E8E8] transition-colors"
                      >
                        แก้ไข
                      </button>
                    )}
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
