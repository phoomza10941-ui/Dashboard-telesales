"use client";
import { useState, useEffect } from "react";
import { formatTalkTime } from "@/lib/oreka-format";

interface DayRecording {
  id: number;
  timestamp: string; // "YYYY-MM-DD HH:MM:SS" (UTC)
  duration: number; // seconds
  direction: "IN" | "OUT" | string;
}

interface CallDayRecordingsProps {
  phone: string;
  selectedDate: string; // "YYYY-MM-DD" (Thai)
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Oreka timestamps are UTC; convert to Thai (UTC+7) HH:MM for display.
function thaiTimeLabel(ts: string): string {
  const utc = new Date(ts.replace(" ", "T") + "Z");
  if (isNaN(utc.getTime())) return "";
  const thai = new Date(utc.getTime() + 7 * 3600_000);
  return `${pad2(thai.getUTCHours())}:${pad2(thai.getUTCMinutes())}`;
}

function dateLabel(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m - 1]} ${(y + 543) % 100}`;
}

export function CallDayRecordings({ phone, selectedDate }: CallDayRecordingsProps) {
  const [recordings, setRecordings] = useState<DayRecording[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!phone || !selectedDate) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    setSelectedId(null);
    fetch(`/api/oreka/recordings-by-phone?phone=${encodeURIComponent(phone)}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const recs = (d.recordings ?? []) as DayRecording[];
        setRecordings(recs);
        // Default-select the longest call (usually the real conversation).
        // preload="none" means no audio downloads until the agent hits play.
        if (recs.length > 0) {
          const longest = recs.reduce((a, b) => (b.duration > a.duration ? b : a));
          setSelectedId(longest.id);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [phone, selectedDate]);

  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[#E8E8E8] bg-white p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
          🎧 เสียงสนทนา
        </span>
        <span className="text-[10px] text-[#C0C0C0]">{dateLabel(selectedDate)}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-[11px] text-[#C0C0C0]">
          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          กำลังโหลด...
        </div>
      )}

      {!loading && error && (
        <div className="py-6 text-center text-[11px] text-[#C0C0C0]">
          โหลดเสียงไม่สำเร็จ ลองใหม่อีกครั้ง
        </div>
      )}

      {!loading && !error && recordings !== null && recordings.length === 0 && (
        <div className="py-6 text-center text-[11px] text-[#C0C0C0]">
          ไม่มีสายในวันนี้
        </div>
      )}

      {!loading && !error && recordings && recordings.length > 0 && (() => {
        const selected = recordings.find((r) => r.id === selectedId) ?? recordings[0];
        return (
          <div>
            {/* Call list — thin selectable rows. Scrolls only past ~5 calls. */}
            <div className="max-h-[150px] overflow-y-auto pr-0.5 divide-y divide-[#F0F0F0]">
              {recordings.map((rec) => {
                const isIn = rec.direction === "IN";
                const isSel = rec.id === selected.id;
                return (
                  <button
                    key={rec.id}
                    onClick={() => setSelectedId(rec.id)}
                    className={`w-full flex items-center gap-2 px-1.5 py-1 text-left rounded-md transition-colors ${
                      isSel ? "bg-[#87DE81]/12" : "hover:bg-[#F7F7F7]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isSel ? "bg-[#3D9B3A]" : "bg-transparent"
                      }`}
                    />
                    <span className={`text-[10px] tabular-nums ${isSel ? "font-semibold text-[#3D3D3D]" : "text-[#3D3D3D]"}`}>
                      {thaiTimeLabel(rec.timestamp)}
                    </span>
                    <span
                      className={`text-[8px] font-medium px-1 py-px rounded-full ${
                        isIn ? "bg-[#58CEE8]/15 text-[#0E8FA8]" : "bg-[#87DE81]/20 text-[#2a6e28]"
                      }`}
                    >
                      {isIn ? "เข้า" : "ออก"}
                    </span>
                    <span className="text-[9px] text-[#8B8E8F] ml-auto tabular-nums">
                      {formatTalkTime(rec.duration)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Single shared player for the selected call */}
            <div className="mt-2 pt-2 border-t border-[#E8E8E8]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-[#3D3D3D] tabular-nums">
                  {thaiTimeLabel(selected.timestamp)}
                </span>
                <span className="text-[9px] text-[#8B8E8F]">
                  {selected.direction === "IN" ? "สายเข้า" : "สายออก"} · {formatTalkTime(selected.duration)}
                </span>
              </div>
              <audio
                key={selected.id}
                controls
                autoPlay={false}
                preload="none"
                className="w-full h-8 block"
                src={`/api/oreka/audio/${selected.id}`}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
