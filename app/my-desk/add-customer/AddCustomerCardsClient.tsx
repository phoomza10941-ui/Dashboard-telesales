"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SaleRow } from "@/lib/db";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";
import type { CustomerGroup, View } from "@/app/my-desk/components/customer-cards/types";
import { STATUS_LABEL } from "@/app/my-desk/components/customer-cards/types";
import { groupRows, rowViewTotal, parseStatus } from "@/app/my-desk/components/customer-cards/group";
import { ChannelBadge } from "@/app/my-desk/components/customer-cards/ChannelBadge";
import { RecordingsPlayer } from "@/app/my-desk/components/customer-cards/RecordingsPlayer";
import { CustomerProfile } from "@/app/my-desk/components/customer-cards/CustomerProfile";

// Most recent purchase row for a customer (used as the target for "record a sale").
function latestRow(group: CustomerGroup): SaleRow {
  return [...group.purchases].sort((a, b) => b.date.localeCompare(a.date))[0];
}

const VIEWS: { key: View; label: string; activeClass: string }[] = [
  { key: "overall", label: "ทั้งหมด", activeClass: "bg-[#3D3D3D] text-white" },
  { key: "gosell",  label: "GoSell",  activeClass: "bg-[#87DE81] text-[#3D9B3A]" },
  { key: "hopeful", label: "Hopeful", activeClass: "bg-[#022EE8] text-[#0E8FA8]" },
];

export default function AddCustomerCardsClient({
  rows,
  hasOrekaExt,
}: {
  rows: SaleRow[];
  hasOrekaExt: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("overall");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CustomerGroup | null>(null);
  const [editRow, setEditRow] = useState<SaleRow | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const grouped = groupRows(rows, view);
  const filtered = q
    ? grouped.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone.toLowerCase().includes(q) ||
        g.purchases.some((r) => r.product.toLowerCase().includes(q) || r.note.toLowerCase().includes(q))
      )
    : grouped;

  const isHopeful = view === "hopeful";

  return (
    <>
      {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}
      {activeGroup && (
        <CustomerProfile
          group={activeGroup}
          hasOrekaExt={hasOrekaExt}
          onClose={() => setActiveGroup(null)}
          onEdit={(r) => setEditRow(r)}
          onAddNew={() => {
            // "บันทึกการขาย" — record a sale by editing the customer's latest row.
            setEditRow(latestRow(activeGroup));
            setActiveGroup(null);
          }}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-[#3D3D3D]">เพิ่มลูกค้า</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">การ์ดลูกค้า — ประวัติการโทร และบันทึกการขาย</p>
          </div>
          <button
            onClick={() => router.push("/my-desk/add-customer/new")}
            className="flex items-center gap-2 bg-[#87DE81] text-white font-semibold text-[12px] px-4 py-2.5 rounded-xl hover:bg-[#6BC965] transition-colors shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            กรอกข้อมูล
          </button>
        </div>

        {/* View tabs */}
        <div className="flex items-center gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1 w-fit">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${view === v.key ? v.activeClass : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ เบอร์โทร หรือสินค้า..."
            className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีลูกค้า</p>
            <p className="text-[12px] text-[#8B8E8F] mt-1">กด &ldquo;กรอกข้อมูล&rdquo; เพื่อเพิ่มลูกค้าใหม่</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((group) => {
              const isExpanded = expandedKey === group.key;
              const sortedPurchases = group.purchases.slice().sort((a, b) => a.date.localeCompare(b.date));
              return (
                <div
                  key={group.key}
                  className={`bg-white border rounded-xl overflow-hidden transition-colors ${isHopeful ? "border-[#022EE8]/20" : "border-[#87DE81]/20"}`}
                >
                  {/* Main row — click to open profile */}
                  <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F7F7F7] transition-colors" onClick={() => setActiveGroup(group)}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${isHopeful ? "bg-[#022EE8]/15 text-[#0E8FA8]" : "bg-[#87DE81]/20 text-[#3D9B3A]"}`}>
                      {group.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#3D3D3D]">{group.name}</span>
                        <ChannelBadge channels={group.channels} />
                        {group.isReturning && (
                          <span className="text-[9px] bg-[#022EE8]/10 text-[#0E8FA8] px-1.5 py-0.5 rounded-full font-semibold">ลูกค้าเก่า</span>
                        )}
                      </div>
                      {group.phone && <div className="text-[11px] text-[#8B8E8F] mt-0.5">{group.phone}</div>}
                    </div>
                    {group.totalValue > 0 && (
                      <div className="shrink-0 text-right">
                        <div className={`text-[15px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D3D3D]"}`}>฿{group.totalValue.toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-stretch border-t border-[#F7F7F7]">
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                      className={`flex-1 flex items-center justify-between px-4 py-2 text-[11px] font-medium transition-colors ${isExpanded ? "bg-[#F7F7F7] text-[#3D3D3D]" : "text-[#8B8E8F] hover:bg-[#F7F7F7] hover:text-[#3D3D3D]"}`}
                    >
                      <span>ประวัติ {group.purchases.length} ครั้ง</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditRow(latestRow(group))}
                      className="flex items-center gap-1.5 px-4 py-2 border-l border-[#F7F7F7] text-[11px] font-semibold text-[#3D9B3A] hover:bg-[#87DE81]/10 transition-colors shrink-0"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      บันทึกการขาย
                    </button>
                  </div>

                  {/* Expandable history + call recordings */}
                  {isExpanded && (
                    <div className="border-t border-[#F7F7F7]">
                      <div className="divide-y divide-[#F7F7F7]">
                        {sortedPurchases.map((r, idx) => {
                          const amt = rowViewTotal(r, view);
                          const st = parseStatus(r.note);
                          const stInfo = STATUS_LABEL[st] ?? { label: st, color: "#8B8E8F" };
                          return (
                            <div key={`${r.id ?? "row"}-${idx}`} className="flex items-center gap-3 px-4 py-2.5">
                              <span className={`text-[10px] font-bold w-5 text-center shrink-0 ${isHopeful ? "text-[#0E8FA8]/50" : "text-[#87DE81]/70"}`}>#{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.product || "—"}</div>
                                <div className="text-[10px] text-[#C0C0C0]">{r.date}</div>
                              </div>
                              <span className="text-[10px] font-medium shrink-0" style={{ color: stInfo.color }}>{stInfo.label}</span>
                              {amt > 0 && <span className="text-[12px] font-semibold text-[#3D3D3D] shrink-0">฿{amt.toLocaleString()}</span>}
                            </div>
                          );
                        })}
                      </div>
                      {group.phone && hasOrekaExt && (
                        <RecordingsPlayer phone={group.phone} hasOrekaExt={hasOrekaExt} days={7} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
