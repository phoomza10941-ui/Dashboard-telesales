"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SaleRow } from "@/lib/db";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";
import { formatTalkTime } from "@/lib/oreka-format";
import type { CustomerGroup, View } from "@/app/my-desk/components/customer-cards/types";
import { STATUS_LABEL } from "@/app/my-desk/components/customer-cards/types";
import { groupRows, rowViewTotal, parseStatus } from "@/app/my-desk/components/customer-cards/group";
import { RecordingsPlayer } from "@/app/my-desk/components/customer-cards/RecordingsPlayer";
import { CustomerProfile } from "@/app/my-desk/components/customer-cards/CustomerProfile";

type MainTab = "registered" | "new_contacts";

interface OrekaContact {
  phone: string;
  callCount: number;
  totalDuration: number;
  lastCalledAt: string;
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const grouped = groupRows(rows, view);

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
            router.push(`/my-desk/add-customer/new?${params.toString()}`);
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
                {filtered.map((group) => {
                  const isExpanded = expandedKey === group.key;
                  const sortedPurchases = group.purchases
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <div
                      key={group.key}
                      className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                        isHopeful ? "border-[#022EE8]/20" : "border-[#87DE81]/20"
                      }`}
                    >
                      {/* Main row — click to open profile modal */}
                      <div
                        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F7F7F7] transition-colors"
                        onClick={() => setActiveGroup(group)}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                          isHopeful ? "bg-[#022EE8]/15 text-[#0E8FA8]" : "bg-[#87DE81]/20 text-[#3D9B3A]"
                        }`}>
                          {group.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-semibold text-[#3D3D3D]">{group.name}</span>
                            {group.isReturning && (
                              <span className="text-[9px] bg-[#022EE8]/10 text-[#0E8FA8] px-1.5 py-0.5 rounded-full font-semibold">
                                ลูกค้าเก่า
                              </span>
                            )}
                          </div>
                          {group.phone && (
                            <div className="text-[11px] text-[#8B8E8F] mt-0.5">{group.phone}</div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`text-[15px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D3D3D]"}`}>
                            ฿{group.totalValue.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Toggle history row */}
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                        className={`w-full flex items-center justify-between px-4 py-2 border-t text-[11px] font-medium transition-colors ${
                          isExpanded
                            ? "bg-[#F7F7F7] text-[#3D3D3D] border-[#E8E8E8]"
                            : "text-[#8B8E8F] border-[#F7F7F7] hover:bg-[#F7F7F7] hover:text-[#3D3D3D]"
                        }`}
                      >
                        <span>ประวัติ {group.purchases.length} ครั้ง</span>
                        <svg
                          width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {/* Expandable history list */}
                      {isExpanded && (
                        <div className="border-t border-[#F7F7F7]">
                          <div className="divide-y divide-[#F7F7F7]">
                            {sortedPurchases.map((r, idx) => {
                              const amt = rowViewTotal(r, view);
                              const st = parseStatus(r.note);
                              const stInfo = STATUS_LABEL[st] ?? { label: st, color: "#8B8E8F" };
                              return (
                                <div key={`${r.id ?? 'row'}-${idx}`} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className={`text-[10px] font-bold w-5 text-center shrink-0 ${
                                    isHopeful ? "text-[#0E8FA8]/50" : "text-[#87DE81]/70"
                                  }`}>
                                    #{idx + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">
                                      {r.product || "—"}
                                    </div>
                                    <div className="text-[10px] text-[#C0C0C0]">{r.date}</div>
                                  </div>
                                  <span className="text-[10px] font-medium shrink-0" style={{ color: stInfo.color }}>
                                    {stInfo.label}
                                  </span>
                                  {amt > 0 && (
                                    <span className="text-[12px] font-semibold text-[#3D3D3D] shrink-0">
                                      ฿{amt.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {group.phone && (
                            <RecordingsPlayer phone={group.phone} hasOrekaExt={hasOrekaExt} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
                      router.push(`/my-desk/add-customer/new?phone=${encodeURIComponent(phone)}`);
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
