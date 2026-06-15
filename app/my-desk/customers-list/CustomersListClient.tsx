"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SaleRow } from "@/lib/db";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";
import { formatTalkTime } from "@/lib/oreka-format";

type View = "overall" | "gosell" | "hopeful";
type MainTab = "registered" | "new_contacts";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  closed:           { label: "โอนแล้ว",        color: "#3D9B3A" },
  pending_transfer: { label: "รอโอน",          color: "#C48A00" },
  follow_up:        { label: "ติดตาม",         color: "#0E8FA8" },
  in_progress:      { label: "กำลังดำเนินการ", color: "#7B5EA7" },
  lost:             { label: "หลุด",           color: "#CC3333" },
};

function rowTotal(r: SaleRow) {
  return r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
}

function rowViewTotal(r: SaleRow, view: View) {
  if (view === "gosell")  return r.phoneClose + r.upsell + r.crm;
  if (view === "hopeful") return r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
  return rowTotal(r);
}

function parseStatus(note: string): string {
  const n = note.toLowerCase();
  if (n.includes("โอนแล้ว")) return "closed";
  if (n.includes("รอโอน") || n.includes("รอสลิป")) return "pending_transfer";
  if (n.includes("ติดตาม") || n.includes("นัด")) return "follow_up";
  if (n.includes("หลุด")) return "lost";
  return "in_progress";
}

interface CustomerGroup {
  key: string;
  name: string;
  phone: string;
  address: string;
  purchases: SaleRow[];
  totalValue: number;
  isReturning: boolean;
}

interface OrekaContact {
  phone: string;
  callCount: number;
  totalDuration: number;
  lastCalledAt: string;
}

interface SavedSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

// ── Call Summary Section ───────────────────────────────────────────────────────
function CallSummarySection({ phone, hasOrekaExt }: { phone: string; hasOrekaExt: boolean }) {
  const [summaries, setSummaries] = useState<SavedSummary[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ summary: string; coachingTips: string[]; duration: number; calledAt: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/call-summary?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => setSummaries(d.summaries ?? []))
      .catch(() => setSummaries([]));
  }, [phone]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/call-summary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_recording") setGenError("ไม่พบการโทรล่าสุดในระบบ Oreka (7 วันที่ผ่านมา)");
        else setGenError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      setGenResult(data);
      const refreshed = await fetch(`/api/call-summary?phone=${encodeURIComponent(phone)}`).then((r) => r.json());
      setSummaries(refreshed.summaries ?? []);
    } catch {
      setGenError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setGenerating(false);
    }
  }

  const displaySummary = genResult ?? (summaries && summaries.length > 0 ? summaries[0] : null);

  return (
    <div className="px-5 py-4 border-t border-[#E8E8E8] space-y-3">
      {hasOrekaExt && !genResult && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/40 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 rounded-xl py-2.5 transition-colors disabled:opacity-60"
        >
          {generating ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              กำลังสรุป...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              สรุปการโทรล่าสุด
            </>
          )}
        </button>
      )}

      {genError && (
        <p className="text-[11px] text-[#CC3333] text-center">{genError}</p>
      )}

      {displaySummary && (() => {
        const s = displaySummary;
        const durationStr = s.duration ? formatTalkTime(s.duration) : null;
        const rawCalledAt = "calledAt" in s ? s.calledAt : null;
        const dateStr = rawCalledAt
          ? new Date(rawCalledAt + (rawCalledAt.includes("T") ? "" : " UTC")).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
          : null;
        const tips: string[] = "coachingTips" in s ? s.coachingTips : [];

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">สรุปการโทรล่าสุด</span>
              {dateStr && <span className="text-[10px] text-[#C0C0C0]">{dateStr}</span>}
              {durationStr && <span className="text-[10px] text-[#C0C0C0]">({durationStr})</span>}
            </div>
            <p className="text-[12px] text-[#3D3D3D] leading-relaxed">{s.summary}</p>
            {tips.length > 0 && (
              <div className="bg-[#87DE81]/8 border border-[#87DE81]/20 rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] font-semibold text-[#3D9B3A] flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  คำแนะนำ
                </div>
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-[#3D3D3D]">
                    <span className="text-[#87DE81] font-bold shrink-0 mt-px">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {summaries !== null && summaries.length === 0 && !genResult && !hasOrekaExt && (
        <p className="text-[11px] text-[#C0C0C0] text-center">ยังไม่มีสรุปการโทร</p>
      )}
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function CustomerProfile({ group, hasOrekaExt, onClose, onAddNew, onEdit }: {
  group: CustomerGroup;
  hasOrekaExt: boolean;
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (r: SaleRow) => void;
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
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#3D3D3D] truncate">{group.name}</span>
              {group.isReturning && (
                <span className="text-[10px] bg-[#022EE8]/15 text-[#0E8FA8] px-2 py-0.5 rounded-full font-semibold shrink-0">ลูกค้าเก่า</span>
              )}
            </div>
            {group.phone && <div className="text-[12px] text-[#8B8E8F]">📞 {group.phone}</div>}
          </div>
          <button onClick={onAddNew} className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#87DE81] text-white px-3 py-1.5 rounded-lg hover:bg-[#6BC965] transition-colors shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            เพิ่มรายการใหม่
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
                <div key={r.id ?? i} className="flex items-center gap-3 px-5 py-3">
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

          {group.phone && (
            <CallSummarySection phone={group.phone} hasOrekaExt={hasOrekaExt} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── New Contact Card ───────────────────────────────────────────────────────────
function NewContactCard({ contact, onRegister }: {
  contact: OrekaContact;
  onRegister: (phone: string) => void;
}) {
  const lastCalled = contact.lastCalledAt
    ? new Date(contact.lastCalledAt + " UTC").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
    : null;

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[#F7F7F7] border border-[#E8E8E8] flex items-center justify-center text-[#C0C0C0] shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#3D3D3D]">{contact.phone}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-[#8B8E8F]">โทร {contact.callCount} ครั้ง</span>
          <span className="text-[11px] text-[#8B8E8F]">รวม {formatTalkTime(contact.totalDuration)}</span>
          {lastCalled && <span className="text-[10px] text-[#C0C0C0]">ล่าสุด {lastCalled}</span>}
        </div>
      </div>
      <button
        onClick={() => onRegister(contact.phone)}
        className="text-[11px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/30 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        กรอกข้อมูล →
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CustomersListClient({
  rows,
  allRows,
  hasOrekaExt,
}: {
  rows: SaleRow[];
  allRows: SaleRow[];
  hasOrekaExt: boolean;
}) {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>("registered");
  const [view, setView] = useState<View>("overall");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CustomerGroup | null>(null);
  const [editRow, setEditRow] = useState<SaleRow | null>(null);
  const [newContacts, setNewContacts] = useState<OrekaContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  const knownPhones = new Set(allRows.map((r) => r.phone?.trim()).filter(Boolean));

  useEffect(() => {
    if (mainTab !== "new_contacts" || !hasOrekaExt) return;
    if (newContacts !== null) return;
    setContactsLoading(true);
    fetch("/api/oreka/contacts")
      .then((r) => r.json())
      .then((d) => {
        const all: OrekaContact[] = d.contacts ?? [];
        setNewContacts(all.filter((c) => !knownPhones.has(c.phone)));
      })
      .catch(() => setNewContacts([]))
      .finally(() => setContactsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, hasOrekaExt]);

  const q = search.trim().toLowerCase();

  const grouped = (() => {
    const map = new Map<string, CustomerGroup>();
    for (const r of rows) {
      if (view === "gosell"  && r.phoneClose + r.upsell + r.crm <= 0) continue;
      if (view === "hopeful" && r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell <= 0) continue;
      const key = r.phone?.trim() || r.name;
      if (!map.has(key)) {
        map.set(key, {
          key, name: r.name, phone: r.phone ?? "",
          address: r.address ?? "", purchases: [], totalValue: 0, isReturning: false,
        });
      }
      const g = map.get(key)!;
      g.purchases.push(r);
      g.totalValue += rowViewTotal(r, view);
      if (r.address && !g.address) g.address = r.address;
    }
    for (const g of map.values()) g.isReturning = g.purchases.length > 1;
    return [...map.values()];
  })();

  const filtered = q
    ? grouped.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone.toLowerCase().includes(q) ||
        g.purchases.some((r) => r.product.toLowerCase().includes(q) || r.note.toLowerCase().includes(q))
      )
    : grouped;

  const totalSales = filtered.reduce((s, g) => s + g.totalValue, 0);
  const isHopeful = view === "hopeful";

  const VIEWS: { key: View; label: string; activeClass: string }[] = [
    { key: "overall", label: "ทั้งหมด", activeClass: "bg-[#3D3D3D] text-white" },
    { key: "gosell",  label: "GoSell",  activeClass: "bg-[#87DE81] text-[#3D9B3A]" },
    { key: "hopeful", label: "Hopeful", activeClass: "bg-[#022EE8] text-[#0E8FA8]" },
  ];

  const newContactsFiltered = q && newContacts
    ? newContacts.filter((c) => c.phone.includes(q))
    : (newContacts ?? []);

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
            const params = new URLSearchParams({
              phone: activeGroup.phone,
              name: activeGroup.name,
              ...(activeGroup.address ? { address: activeGroup.address } : {}),
            });
            router.push(`/my-desk/add-customer?${params.toString()}`);
          }}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รายชื่อลูกค้า</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">
              {mainTab === "registered" ? "ลูกค้าที่ชำระเงินแล้ว / ปิดการขายแล้ว" : "เบอร์จาก Oreka ที่ยังไม่ได้บันทึก"}
            </p>
          </div>
          {mainTab === "registered" && (
            <div className="flex items-center gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1">
              {VIEWS.map((v) => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${view === v.key ? v.activeClass : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main tabs */}
        {hasOrekaExt && (
          <div className="flex gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1">
            <button
              onClick={() => setMainTab("registered")}
              className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition-all ${mainTab === "registered" ? "bg-white text-[#3D3D3D] shadow-sm" : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}
            >
              ลูกค้า
            </button>
            <button
              onClick={() => setMainTab("new_contacts")}
              className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === "new_contacts" ? "bg-white text-[#3D3D3D] shadow-sm" : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}
            >
              ติดต่อใหม่
              {newContacts && newContacts.length > 0 && (
                <span className="text-[10px] bg-[#58CEE8] text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                  {newContacts.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={mainTab === "registered" ? "ค้นหาชื่อ เบอร์โทร หรือสินค้า..." : "ค้นหาเบอร์โทร..."}
            className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* ── REGISTERED TAB ── */}
        {mainTab === "registered" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
                <div className="text-[11px] text-[#8B8E8F] mb-1">ยอดปิดการขาย{view === "gosell" ? " (GoSell)" : view === "hopeful" ? " (Hopeful)" : "รวม"}</div>
                <div className={`text-[22px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D9B3A]"}`}>฿{totalSales.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
                <div className="text-[11px] text-[#8B8E8F] mb-1">จำนวนลูกค้า</div>
                <div className="text-[22px] font-bold text-[#3D3D3D]">{filtered.length} ราย</div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีลูกค้าที่ปิดการขาย</p>
                <p className="text-[12px] text-[#8B8E8F] mt-1">เมื่ออัปเดตสถานะเป็น &ldquo;โอนแล้ว&rdquo; รายการจะย้ายมาที่นี่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((group) => (
                  <div
                    key={group.key}
                    onClick={() => setActiveGroup(group)}
                    className={`bg-white border rounded-xl p-4 cursor-pointer hover:bg-[#F7F7F7] transition-colors ${
                      isHopeful ? "border-[#022EE8]/30" : "border-[#87DE81]/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                        isHopeful ? "bg-[#022EE8]/20 text-[#0E8FA8]" : "bg-[#87DE81]/20 text-[#3D9B3A]"
                      }`}>
                        {group.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#3D3D3D]">{group.name}</span>
                          {group.isReturning && (
                            <span className="text-[9px] bg-[#022EE8]/15 text-[#0E8FA8] px-1.5 py-0.5 rounded-full font-semibold border border-[#022EE8]/20">
                              ลูกค้าเก่า {group.purchases.length} ครั้ง
                            </span>
                          )}
                          {group.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {group.phone}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.purchases
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((r, idx) => {
                              const amt = rowViewTotal(r, view);
                              return (
                                <div key={r.id ?? idx} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${
                                  isHopeful
                                    ? "bg-[#022EE8]/5 border-[#022EE8]/20 text-[#0E8FA8]"
                                    : "bg-[#87DE81]/5 border-[#87DE81]/20 text-[#3D9B3A]"
                                }`}>
                                  <span className="text-[9px] font-bold opacity-50">#{idx + 1}</span>
                                  {r.product && <span className="font-medium">{r.product}</span>}
                                  {amt > 0 && <span className="font-semibold">฿{amt.toLocaleString()}</span>}
                                  <span className="text-[9px] opacity-50">{r.date}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-[16px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D3D3D]"}`}>
                          ฿{group.totalValue.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#C0C0C0] mt-0.5">ดูประวัติ →</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── NEW CONTACTS TAB ── */}
        {mainTab === "new_contacts" && (
          <>
            {contactsLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl p-4 animate-pulse h-16" />
                ))}
              </div>
            )}
            {!contactsLoading && newContactsFiltered.length === 0 && (
              <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">📞</div>
                <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีเบอร์ใหม่จาก Oreka</p>
                <p className="text-[12px] text-[#8B8E8F] mt-1">เบอร์ที่โทรออกทั้งหมดถูกบันทึกแล้ว</p>
              </div>
            )}
            {!contactsLoading && newContactsFiltered.length > 0 && (
              <div className="space-y-3">
                {newContactsFiltered.map((contact) => (
                  <NewContactCard
                    key={contact.phone}
                    contact={contact}
                    onRegister={(phone) => {
                      router.push(`/my-desk/add-customer?phone=${encodeURIComponent(phone)}`);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
