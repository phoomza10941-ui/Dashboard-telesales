"use client";

import { useState, useTransition, useCallback } from "react";
import type { SaleRow } from "@/lib/db";
import { rowStatus } from "@/lib/note-utils";
import { reassignSalesAction } from "./actions";

interface AgentProfile { id: string; nickname: string; }

interface Props {
  agents: AgentProfile[];
}

const STATUS_LABELS: Record<string, string> = {
  closed: "ปิดแล้ว",
  pending_transfer: "รอโอน",
  follow_up: "ติดตาม",
  lost: "หลุด",
  in_progress: "กำลังดำเนิน",
};

const STATUS_STYLES: Record<string, string> = {
  closed: "bg-green-50 text-[#3D9B3A]",
  pending_transfer: "bg-amber-50 text-amber-600",
  follow_up: "bg-blue-50 text-blue-600",
  lost: "bg-red-50 text-red-500",
  in_progress: "bg-[#F7F7F7] text-[#8B8E8F]",
};

function fmtAmount(row: SaleRow): string {
  const total =
    row.phoneClose + row.upsell + row.crm +
    row.hopefulPhoneClose + row.hopefulCrm + row.hopefulUpsell;
  if (total === 0) return "—";
  return "฿" + total.toLocaleString();
}

export default function ReassignmentClient({ agents }: Props) {
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadSales = useCallback(async (agentId: string) => {
    setLoading(true);
    setSelected(new Set());
    setSales([]);
    try {
      const res = await fetch(`/api/supervisor/sales-by-agent?agentId=${agentId}`);
      const data = await res.json();
      setSales(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSourceChange(id: string) {
    setSourceId(id);
    setTargetId((prev) => (prev === id ? "" : prev));
    if (id) loadSales(id);
    else { setSales([]); setSelected(new Set()); }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === sales.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sales.map((r) => r.id!).filter(Boolean)));
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function handleReassign() {
    const ids = [...selected];
    if (!ids.length || !targetId) return;
    startTransition(async () => {
      const result = await reassignSalesAction(ids, targetId);
      if (result.error) {
        showToast("เกิดข้อผิดพลาด: " + result.error, false);
      } else {
        setSales((prev) => prev.filter((r) => !selected.has(r.id!)));
        setSelected(new Set());
        showToast(`โอนแล้ว ${ids.length} รายการ`, true);
      }
    });
  }

  const allChecked = sales.length > 0 && selected.size === sales.length;
  const someChecked = selected.size > 0 && selected.size < sales.length;
  const canReassign = selected.size > 0 && targetId && targetId !== sourceId && !isPending;

  const targetAgents = agents.filter((a) => a.id !== sourceId);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium transition-all ${
          toast.ok ? "bg-green-50 text-[#3D9B3A] border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Controls bar */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          {/* Source agent */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[10px] text-[#8B8E8F] font-medium uppercase tracking-wide">
              เลือก Agent ที่ไม่อยู่
            </label>
            <select
              value={sourceId}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
            >
              <option value="">— เลือก Agent —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.nickname}</option>
              ))}
            </select>
          </div>

          {/* Arrow */}
          <div className="flex items-center pb-0.5 text-[#8B8E8F] shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>

          {/* Target agent */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[10px] text-[#8B8E8F] font-medium uppercase tracking-wide">
              โอนไปให้ Agent
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={!sourceId}
              className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors disabled:opacity-50"
            >
              <option value="">— เลือก Agent —</option>
              {targetAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.nickname}</option>
              ))}
            </select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Selection count + reassign button */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#8B8E8F]">
                เลือก <span className="font-semibold text-[#3D3D3D]">{selected.size}</span> รายการ
              </span>
              <button
                onClick={handleReassign}
                disabled={!canReassign}
                className="flex items-center gap-2 bg-[#022EE8] hover:bg-[#0124c7] disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    กำลังโอน…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 1 21 5 17 9"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <polyline points="7 23 3 19 7 15"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                    โอน {selected.size} รายการ
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col flex-1 min-h-0">
        {!sourceId ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#8B8E8F]">
            เลือก Agent เพื่อดูรายการลูกค้า
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-[13px] text-[#8B8E8F]">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity=".25"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            กำลังโหลด…
          </div>
        ) : sales.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-[#8B8E8F]">
            ไม่มีรายการลูกค้า
          </div>
        ) : (
          <>
            <div className="overflow-auto flex-1">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-[#E8E8E8]">
                    <th className="py-3.5 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = someChecked; }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-[#E8E8E8] accent-[#022EE8] cursor-pointer"
                      />
                    </th>
                    <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">วันที่</th>
                    <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">ลูกค้า</th>
                    <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">เบอร์</th>
                    <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">สินค้า</th>
                    <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">สถานะ</th>
                    <th className="text-right text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">มูลค่า</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((row) => {
                    const id = row.id!;
                    const isSelected = selected.has(id);
                    const status = rowStatus(row);
                    return (
                      <tr
                        key={id}
                        onClick={() => toggleRow(id)}
                        className={`border-b border-[#E8E8E8] cursor-pointer transition-colors ${
                          isSelected ? "bg-[#022EE8]/5" : "hover:bg-[#F7F7F7]/60"
                        }`}
                      >
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(id)}
                            className="w-4 h-4 rounded border-[#E8E8E8] accent-[#022EE8] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#8B8E8F] whitespace-nowrap">{row.date}</td>
                        <td className="py-3 px-4 font-medium text-[#3D3D3D]">{row.name || "—"}</td>
                        <td className="py-3 px-4 text-[#8B8E8F]">{row.phone || "—"}</td>
                        <td className="py-3 px-4 text-[#3D3D3D]">{row.product || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[status] ?? STATUS_STYLES.in_progress}`}>
                            {STATUS_LABELS[status] ?? status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-[#3D3D3D]">{fmtAmount(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between">
              <span className="text-[11px] text-[#8B8E8F]">{sales.length} รายการทั้งหมด</span>
              {selected.size > 0 && (
                <span className="text-[11px] text-[#022EE8] font-medium">เลือกแล้ว {selected.size} รายการ</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
