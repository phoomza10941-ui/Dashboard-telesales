"use client";
import { useState, useEffect } from "react";
import { formatTalkTime } from "@/lib/oreka-format";

interface SavedSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

// AI summary + coaching tips for a customer's latest call (manual generate).
export function CallSummarySection({ phone, hasOrekaExt }: { phone: string; hasOrekaExt: boolean }) {
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
        else if (data.error === "audio_unclear") setGenError("คุณภาพเสียงไม่ชัดเจน ไม่สามารถถอดความได้ กรุณาลองการโทรอื่น");
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
