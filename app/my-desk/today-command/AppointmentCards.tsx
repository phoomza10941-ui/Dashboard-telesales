"use client";

import { useState } from "react";
import type { AppointmentRow } from "@/lib/db";

export default function AppointmentCards({
  appointments,
}: {
  appointments: AppointmentRow[];
}) {
  const [items, setItems] = useState<AppointmentRow[]>(appointments);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  async function handleSummarize(id: string) {
    setLoading((p) => ({ ...p, [id]: true }));
    setError((p) => { const n = { ...p }; delete n[id]; return n; });
    try {
      const res = await fetch(`/api/appointments/${id}/summarize`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "เกิดข้อผิดพลาด");
      setItems((prev) =>
        prev.map((a) => (a.id === id ? { ...a, preSuggestion: json.suggestion } : a))
      );
    } catch (e) {
      setError((p) => ({ ...p, [id]: (e as Error).message }));
    } finally {
      setLoading((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  }

  if (items.length === 0) {
    return <p className="text-[12px] text-[#8B8E8F] text-center py-4">ไม่มีนัดหมายวันนี้</p>;
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((a) => (
        <div key={a.id} className="flex items-start gap-3 py-2 border-b border-[#E8E8E8] last:border-0">
          <span className="w-2 h-2 rounded-full bg-[#58CEE8] shrink-0 mt-1.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{a.customerName}</div>
            {a.customerPhone && (
              <div className="text-[11px] text-[#8B8E8F]">{a.customerPhone}</div>
            )}

            {a.preSuggestion ? (
              /* ── State A: suggestion already exists ── */
              <div className="mt-1.5 flex items-start gap-1.5">
                <svg className="shrink-0 mt-0.5 text-[#87DE81]" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <p className="text-[11px] text-[#3D3D3D] leading-relaxed">{a.preSuggestion}</p>
              </div>
            ) : (
              /* ── State B: no suggestion yet ── */
              <div className="mt-1.5">
                {error[a.id] && (
                  <p className="text-[10px] text-[#FF6B6B] mb-1">{error[a.id]}</p>
                )}
                <button
                  onClick={() => handleSummarize(a.id)}
                  disabled={loading[a.id]}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/30 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors"
                >
                  {loading[a.id] ? (
                    <>
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      กำลังวิเคราะห์...
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      สรุปบทสนทนา
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
