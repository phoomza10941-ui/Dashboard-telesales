"use client";
import type { SaleRow } from "@/lib/db";
import type { CustomerGroup } from "./types";
import { STATUS_LABEL } from "./types";
import { rowTotal, parseStatus } from "./group";
import { ChannelBadge } from "./ChannelBadge";
import { RecordingsPlayer } from "./RecordingsPlayer";
import { CallSummarySection } from "./CallSummarySection";

// Full customer profile modal: stats, products, purchase history (newest first),
// 7-day call history, and AI call summary.
export function CustomerProfile({ group, hasOrekaExt, onClose, onAddNew, onEdit, showCalls = true }: {
  group: CustomerGroup;
  hasOrekaExt: boolean;
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (r: SaleRow) => void;
  showCalls?: boolean; // false on add-customer (call log lives in customers-list)
}) {
  const history = [...group.purchases].sort((a, b) => b.date.localeCompare(a.date));
  const products = [...new Set(history.map((r) => r.product).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8E8E8]">
          <div className="w-10 h-10 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#0E8FA8] text-[14px] font-bold shrink-0">
            {group.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-[#3D3D3D] truncate">{group.name}</span>
              <ChannelBadge channels={group.channels} />
              {group.isReturning && (
                <span className="text-[10px] bg-[#022EE8]/15 text-[#0E8FA8] px-2 py-0.5 rounded-full font-semibold shrink-0">ลูกค้าเก่า</span>
              )}
            </div>
            {group.phone && <div className="text-[12px] text-[#8B8E8F]">📞 {group.phone}</div>}
          </div>
          <button onClick={onAddNew} className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#87DE81] text-white px-3 py-1.5 rounded-lg hover:bg-[#6BC965] transition-colors shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            บันทึกการขาย
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F7F7F7] text-[#8B8E8F] shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-[#E8E8E8] border-b border-[#E8E8E8]">
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">ซื้อทั้งหมด</div>
            <div className="text-[16px] font-bold text-[#3D3D3D]">{history.length} ครั้ง</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">ยอดรวม</div>
            <div className="text-[16px] font-bold text-[#3D9B3A]">฿{group.totalValue.toLocaleString()}</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">สินค้า</div>
            <div className="text-[16px] font-bold text-[#3D3D3D]">{products.length} ชนิด</div>
          </div>
        </div>

        {products.length > 0 && (
          <div className="px-5 py-3 border-b border-[#E8E8E8]">
            <div className="text-[10px] text-[#8B8E8F] mb-2 uppercase tracking-wide">สินค้าที่เคยซื้อ</div>
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => (
                <span key={p} className="text-[11px] bg-[#87DE81]/10 text-[#3D9B3A] border border-[#87DE81]/20 px-2.5 py-1 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-[#F7F7F7]">
            {history.map((r, i) => {
              const st = parseStatus(r.note);
              const stInfo = STATUS_LABEL[st] ?? { label: st, color: "#8B8E8F" };
              const total = rowTotal(r);
              return (
                <div key={`${r.id ?? 'row'}-${i}`} className="flex items-center gap-3 px-5 py-3">
                  <div className="text-[11px] text-[#C0C0C0] w-20 shrink-0">{r.date}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.product || "—"}</div>
                    {r.note && <div className="text-[10px] text-[#8B8E8F] truncate">{r.note}</div>}
                  </div>
                  <span className="text-[10px] font-medium shrink-0" style={{ color: stInfo.color }}>{stInfo.label}</span>
                  {total > 0 && <span className="text-[12px] font-semibold text-[#3D3D3D] shrink-0">฿{total.toLocaleString()}</span>}
                  {r.id && (
                    <button
                      onClick={() => onEdit(r)}
                      className="p-1 rounded-lg text-[#C0C0C0] hover:text-[#8B8E8F] hover:bg-[#F7F7F7] transition-colors shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {showCalls && group.phone && hasOrekaExt && (
            <RecordingsPlayer phone={group.phone} hasOrekaExt={hasOrekaExt} />
          )}
          {showCalls && group.phone && (
            <CallSummarySection phone={group.phone} hasOrekaExt={hasOrekaExt} />
          )}
        </div>
      </div>
    </div>
  );
}
