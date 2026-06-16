"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SaleRow } from "@/lib/db";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";
import NewSaleModal from "@/app/my-desk/components/NewSaleModal";
import type { CustomerGroup, View } from "@/app/my-desk/components/customer-cards/types";
import { groupRows, rowViewTotal } from "@/app/my-desk/components/customer-cards/group";
import { ChannelBadge } from "@/app/my-desk/components/customer-cards/ChannelBadge";
import { CustomerProfile } from "@/app/my-desk/components/customer-cards/CustomerProfile";

const NOTE_STATUSES = [
  { note: "โอนแล้ว",        label: "โอนแล้ว",  icon: "✅", color: "#3D9B3A" },
  { note: "รอโอน",          label: "รอโอน",    icon: "⏳", color: "#C48A00" },
  { note: "ติดตาม",         label: "ติดตาม",   icon: "📞", color: "#0E8FA8" },
  { note: "นัดโทรพรุ่งนี้", label: "นัดโทร",   icon: "📅", color: "#7B5EA7" },
  { note: "หลุด",           label: "หลุด",     icon: "❌", color: "#CC3333" },
  { note: "ของแถม",         label: "ของแถม",   icon: "🎁", color: "#E07C30" },
] as const;

function statusColor(note: string): string {
  return NOTE_STATUSES.find((s) => s.note === note)?.color ?? "#8B8E8F";
}

const VIEWS: { key: View; label: string; activeClass: string }[] = [
  { key: "overall", label: "ทั้งหมด", activeClass: "bg-[#3D3D3D] text-white" },
  { key: "gosell",  label: "GoSell",  activeClass: "bg-[#87DE81] text-[#3D9B3A]" },
  { key: "hopeful", label: "Hopeful", activeClass: "bg-[#022EE8] text-[#0E8FA8]" },
];

// ── Inline history row with status dropdown + appointment calendar ─────────────
function HistoryRow({
  row, idx, view, isHopeful, onEdit,
}: {
  row: SaleRow; idx: number; view: View; isHopeful: boolean; onEdit: (r: SaleRow) => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [apptDate, setApptDate] = useState("");
  const [apptSaving, setApptSaving] = useState(false);
  const [apptSaved, setApptSaved] = useState(false);
  const [apptError, setApptError] = useState<string | null>(null);

  const amt = rowViewTotal(row, view);
  const isScheduled = note === "นัดโทรพรุ่งนี้";
  const presetMatch = NOTE_STATUSES.some((s) => s.note === note);

  async function changeStatus(newNote: string) {
    if (!row.id) return;
    const prevNote = note;
    setNote(newNote);
    setSaving(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/sales/update-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, note: newNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      router.refresh();
    } catch (e) {
      setNote(prevNote);
      setStatusError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function saveAppointment() {
    if (!apptDate) return;
    setApptSaving(true);
    setApptError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: row.name,
          customerPhone: row.phone,
          appointmentDate: apptDate,
          preSuggestion: row.product || "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "บันทึกนัดหมายไม่สำเร็จ ลองใหม่อีกครั้ง");
      setApptSaved(true);
    } catch (e) {
      setApptError(e instanceof Error ? e.message : "บันทึกนัดหมายไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setApptSaving(false);
    }
  }

  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        {/* # */}
        <span className={`text-[10px] font-bold w-5 text-center shrink-0 ${isHopeful ? "text-[#0E8FA8]/50" : "text-[#87DE81]/70"}`}>
          #{idx + 1}
        </span>

        {/* Product + date */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{row.product || "—"}</div>
          <div className="text-[10px] text-[#C0C0C0]">{row.date}</div>
        </div>

        {/* Status dropdown */}
        <div className="relative shrink-0">
          <select
            value={note}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={saving}
            className="text-[10px] font-semibold border border-[#E8E8E8] rounded-lg pl-2 pr-6 py-1 bg-[#F7F7F7] focus:outline-none focus:border-[#87DE81] cursor-pointer appearance-none transition-colors disabled:opacity-60"
            style={{ color: statusColor(note) }}
          >
            {NOTE_STATUSES.map((s) => (
              <option key={s.note} value={s.note}>{s.icon} {s.label}</option>
            ))}
            {!presetMatch && note && (
              <option value={note}>{note}</option>
            )}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B8E8F]"
            width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Price */}
        {amt > 0 && (
          <span className="text-[12px] font-semibold text-[#3D3D3D] shrink-0">฿{amt.toLocaleString()}</span>
        )}

        {/* Edit button */}
        <button
          onClick={() => onEdit(row)}
          className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-[#8B8E8F] hover:text-[#3D9B3A] px-2 py-1 rounded-lg hover:bg-[#87DE81]/10 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          แก้ไข
        </button>
      </div>
      {statusError && (
        <p className="ml-7 text-[10px] text-[#FF6B6B]">{statusError}</p>
      )}

      {/* Calendar picker shown when status is "นัดโทรพรุ่งนี้" */}
      {isScheduled && (
        <div className="ml-7 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] text-[#7B5EA7] font-medium shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            วันนัดหมาย
          </div>
          <input
            type="date"
            value={apptDate}
            onChange={(e) => { setApptDate(e.target.value); setApptSaved(false); setApptError(null); }}
            className="text-[11px] border border-[#7B5EA7]/30 rounded-lg px-2 py-1 bg-[#7B5EA7]/5 focus:outline-none focus:border-[#7B5EA7] text-[#7B5EA7] transition-colors"
          />
          {apptDate && !apptSaved && (
            <button
              onClick={saveAppointment}
              disabled={apptSaving}
              className="text-[10px] font-semibold bg-[#7B5EA7] text-white px-2.5 py-1 rounded-lg hover:bg-[#6A4F96] disabled:opacity-50 transition-colors"
            >
              {apptSaving ? "..." : "บันทึกนัดหมาย"}
            </button>
          )}
          {apptSaved && (
            <span className="text-[10px] text-[#7B5EA7] font-medium">✓ นัดหมายแล้ว</span>
          )}
          {apptError && (
            <span className="text-[10px] text-[#FF6B6B]">{apptError}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AddCustomerCardsClient({
  rows,
  hasOrekaExt,
  agentName,
  products,
}: {
  rows: SaleRow[];
  hasOrekaExt: boolean;
  agentName: string;
  products: string[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("overall");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CustomerGroup | null>(null);
  const [editRow, setEditRow] = useState<SaleRow | null>(null);
  const [newSaleGroup, setNewSaleGroup] = useState<CustomerGroup | null>(null);
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
      {newSaleGroup && (
        <NewSaleModal
          group={newSaleGroup}
          agentName={agentName}
          products={products}
          onClose={() => setNewSaleGroup(null)}
        />
      )}
      {activeGroup && (
        <CustomerProfile
          group={activeGroup}
          hasOrekaExt={hasOrekaExt}
          onClose={() => setActiveGroup(null)}
          onEdit={(r) => setEditRow(r)}
          showCalls={false}
          onAddNew={() => {
            setNewSaleGroup(activeGroup);
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
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
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F7F7F7] transition-colors"
                    onClick={() => setActiveGroup(group)}
                  >
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
                        <div className={`text-[15px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D3D3D]"}`}>
                          ฿{group.totalValue.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="flex items-stretch border-t border-[#F7F7F7]">
                    {/* History toggle */}
                    <button
                      onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                      className={`flex-1 flex items-center justify-between px-4 py-2 text-[11px] font-medium transition-colors ${isExpanded ? "bg-[#F7F7F7] text-[#3D3D3D]" : "text-[#8B8E8F] hover:bg-[#F7F7F7] hover:text-[#3D3D3D]"}`}
                    >
                      <span>ประวัติ {group.purchases.length} ครั้ง</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>

                    {/* + บันทึกการขาย — adds a NEW order */}
                    <button
                      onClick={() => setNewSaleGroup(group)}
                      className="flex items-center gap-1.5 px-4 py-2 border-l border-[#F7F7F7] text-[11px] font-semibold text-[#3D9B3A] hover:bg-[#87DE81]/10 transition-colors shrink-0"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      บันทึกการขาย
                    </button>
                  </div>

                  {/* Expandable history */}
                  {isExpanded && (
                    <div className="border-t border-[#F7F7F7] divide-y divide-[#F7F7F7]">
                      {sortedPurchases.map((r, idx) => (
                        <HistoryRow
                          key={`${r.id ?? "row"}-${idx}`}
                          row={r}
                          idx={idx}
                          view={view}
                          isHopeful={isHopeful}
                          onEdit={(row) => setEditRow(row)}
                        />
                      ))}
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
