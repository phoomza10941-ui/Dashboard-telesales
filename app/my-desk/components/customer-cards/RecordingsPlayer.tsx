"use client";
import { useState, useEffect } from "react";
import { formatTalkTime } from "@/lib/oreka-format";

interface CallRecording {
  id: number;
  timestamp: string;
  duration: number;
  direction: string;
  remoteParty: string;
}

// Renders a customer's call recordings with inline audio players.
//  - Default (no `days`): today's calls only, oldest→newest. Used by customers-list.
//  - With `days` (e.g. 7): a rolling N-day window, newest→oldest, with a count and
//    "◀ N วันก่อนหน้า" paging via weekOffset. Used by the add-customer cards.
export function RecordingsPlayer({
  phone,
  hasOrekaExt,
  days,
}: {
  phone: string;
  hasOrekaExt: boolean;
  days?: number;
}) {
  const [recs, setRecs] = useState<CallRecording[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const multiDay = !!days && days > 0;

  useEffect(() => {
    if (!phone || !hasOrekaExt) return;
    setLoading(true);
    const qs = multiDay
      ? `?phone=${encodeURIComponent(phone)}&days=${days}&weekOffset=${weekOffset}`
      : `?phone=${encodeURIComponent(phone)}`;
    fetch(`/api/oreka/recordings-by-phone${qs}`)
      .then((r) => r.json())
      .then((d) => setRecs(d.recordings ?? []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [phone, hasOrekaExt, multiDay, days, weekOffset]);

  if (!hasOrekaExt) return null;

  const windowLabel = multiDay
    ? weekOffset === 0
      ? `${days} วันล่าสุด`
      : `ย้อนหลัง ${weekOffset * (days ?? 0)}–${(weekOffset + 1) * (days ?? 0)} วัน`
    : "บันทึกเสียงวันนี้";

  return (
    <div className="px-4 py-3 border-t border-[#F7F7F7] bg-[#FAFAFA]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">{windowLabel}</span>
          {multiDay && recs && (
            <span className="text-[10px] text-[#58CEE8] font-semibold">โทร {recs.length} ครั้ง</span>
          )}
        </div>
        {multiDay && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="text-[10px] text-[#8B8E8F] hover:text-[#3D3D3D] border border-[#E8E8E8] rounded-lg px-2 py-0.5 transition-colors"
            >
              ◀ {days} วันก่อนหน้า
            </button>
            {weekOffset > 0 && (
              <button
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                className="text-[10px] text-[#8B8E8F] hover:text-[#3D3D3D] border border-[#E8E8E8] rounded-lg px-2 py-0.5 transition-colors"
              >
                {days} วันถัดไป ▶
              </button>
            )}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[11px] text-[#8B8E8F]">
          <svg className="animate-spin w-3 h-3 text-[#58CEE8]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
          </svg>
          กำลังโหลด…
        </div>
      )}
      {!loading && recs && recs.length === 0 && (
        <p className="text-[11px] text-[#C0C0C0]">{multiDay ? "ไม่มีบันทึกเสียงในช่วงนี้" : "ไม่มีบันทึกเสียงวันนี้"}</p>
      )}
      {!loading && recs && recs.length > 0 && (
        <div className="space-y-2">
          {recs.map((rec) => {
            const thaiTime = new Date(rec.timestamp + "Z");
            thaiTime.setHours(thaiTime.getHours() + 7);
            const hh = String(thaiTime.getUTCHours()).padStart(2, "0");
            const mm = String(thaiTime.getUTCMinutes()).padStart(2, "0");
            const dateStr = thaiTime.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
            // Account proxy handles both gosell/hopeful for playback.
            const account = "gosell";
            return (
              <div key={rec.id} className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-[#E8E8E8] px-3 py-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${rec.direction === "OUT" ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                  {rec.direction === "OUT" ? "โทรออก" : "รับสาย"}
                </span>
                {multiDay && <span className="text-[10px] text-[#C0C0C0] shrink-0">{dateStr}</span>}
                <span className="text-[11px] font-medium text-[#3D3D3D] font-mono shrink-0">{hh}:{mm}</span>
                <span className="text-[11px] text-[#8B8E8F] shrink-0">{formatTalkTime(rec.duration)}</span>
                <audio
                  controls
                  preload="none"
                  className="h-7 flex-1 min-w-[180px]"
                  src={`/api/oreka/audio/${rec.id}?account=${account}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
