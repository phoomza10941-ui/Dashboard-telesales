"use client";

import { useState } from "react";
import type { SaleRow } from "@/lib/db";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";

const PENDING_PRESETS = ["โอนแล้ว", "รอสลิป", "รอยืนยันอีกครั้ง", "ยกเลิก"];

function rowTotal(r: SaleRow) {
  return r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
}

function CopyButton({ text, label, variant }: { text: string; label: string; variant: "green" | "cyan" }) {
  const [copied, setCopied] = useState(false);
  function handleClick() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  const cls = variant === "green"
    ? "bg-[#87DE81] text-white hover:bg-[#6BC965]"
    : "bg-[#022EE8]/15 text-[#0E8FA8] hover:bg-[#022EE8]/25";
  return (
    <button onClick={handleClick} className={`text-[12px] font-medium px-4 py-1.5 rounded-lg transition-colors ${cls}`}>
      {copied ? "✓ คัดลอกแล้ว" : label}
    </button>
  );
}

export default function PendingPaymentClient({ pendingRows }: { pendingRows: SaleRow[] }) {
  const [search, setSearch] = useState("");
  const [editRow, setEditRow] = useState<SaleRow | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? pendingRows.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q)
      )
    : pendingRows;

  const totalPending = filtered.reduce((s, r) => s + rowTotal(r), 0);

  return (
    <>
    {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รอโอนเงิน</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            รายการที่หมายเหตุระบุว่ารอโอน / รอยืนยัน
          </p>
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
          className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#FF6B6B] focus:bg-white transition-colors"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
          <div className="text-[11px] text-[#8B8E8F] mb-1">ยอดรอรับรวม</div>
          <div className="text-[22px] font-bold text-[#3D9B3A]">฿{totalPending.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
          <div className="text-[11px] text-[#8B8E8F] mb-1">จำนวนเคส</div>
          <div className={`text-[22px] font-bold ${filtered.length > 0 ? "text-[#FF6B6B]" : "text-[#3D3D3D]"}`}>
            {filtered.length} เคส
          </div>
        </div>
      </div>

      {pendingRows.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#87DE81]/15 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#87DE81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีรายการรอโอน</p>
          <p className="text-[12px] text-[#8B8E8F] mt-1">
            รายการที่หมายเหตุมีคำว่า &ldquo;รอโอน&rdquo; หรือ &ldquo;รอยืนยัน&rdquo; จะแสดงที่นี่
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#8B8E8F]">ไม่พบรายการที่ตรงกับ &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row, i) => {
            const total = rowTotal(row);
            const supMsg = `[รอโอน] ${row.name}${row.phone ? ` • ${row.phone}` : ""}${row.product ? ` • ${row.product}` : ""}${total > 0 ? ` • ฿${total.toLocaleString()}` : ""} — ${row.note}`;
            return (
              <div key={i} className="bg-white border border-[#FF6B6B]/25 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#87DE81]/20 flex items-center justify-center text-[#3D9B3A] text-[12px] font-bold shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-[#3D3D3D]">{row.name}</span>
                      <span className="text-[11px] bg-[#FF6B6B]/10 text-[#FF6B6B] px-2 py-0.5 rounded-full font-medium">
                        รอดำเนินการ
                      </span>
                    </div>
                    {row.product && <p className="text-[12px] text-[#8B8E8F] mb-1">📦 {row.product}</p>}
                    {row.phone && <p className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</p>}
                    <div className="mt-2 bg-[#F7F7F7] rounded-lg px-3 py-2">
                      <p className="text-[11px] text-[#8B8E8F]">📝 หมายเหตุ: <span className="text-[#3D3D3D]">{row.note}</span></p>
                    </div>
                    {row.id && (
                      <UpdateNotePanel
                        saleId={row.id}
                        currentNote={row.note}
                        presets={PENDING_PRESETS}
                      />
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[20px] font-bold text-[#3D3D3D] mb-3">
                      {total > 0 ? `฿${total.toLocaleString()}` : "—"}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {/* copies phone number — on mobile opens dialer */}
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone}`}
                          className="block text-center bg-[#87DE81] text-white text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#6BC965] transition-colors"
                        >
                          ตามโอน
                        </a>
                      ) : (
                        <button disabled className="bg-[#E8E8E8] text-[#C0C0C0] text-[12px] font-medium px-4 py-1.5 rounded-lg cursor-not-allowed">
                          ตามโอน
                        </button>
                      )}
                      {/* copies formatted case info for supervisor */}
                      <CopyButton text={supMsg} label="แจ้ง Sup" variant="cyan" />
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
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
