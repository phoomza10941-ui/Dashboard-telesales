"use client";
import { useState, useEffect, useCallback } from "react";
import { formatTalkTime } from "@/lib/oreka-format";
import type { StarredRecording } from "@/lib/db";
import { CallCalendar } from "./CallCalendar";

interface CallRecording {
  id: number;
  timestamp: string;
  duration: number;
  direction: string;
  remoteParty: string;
}

// Normalised shape used internally for rendering a single recording row.
interface RecRow {
  id: string;        // String(rec.id) or StarredRecording.recordingId
  timestamp: string; // UTC "YYYY-MM-DD HH:MM:SS"
  duration: number;
  direction: string;
  showDate: boolean; // true for multi-day or starred-only view
}

function toThaiTime(utcTimestamp: string): { hh: string; mm: string; dateStr: string } {
  const d = new Date(utcTimestamp + "Z");
  d.setHours(d.getHours() + 7);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const dateStr = d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  return { hh, mm, dateStr };
}

function todayISOThai(): string {
  const thai = new Date(Date.now() + 7 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${thai.getUTCFullYear()}-${pad(thai.getUTCMonth() + 1)}-${pad(thai.getUTCDate())}`;
}

// Renders a customer's call recordings with inline audio players.
//  - Default (no `days`): single-day mode. Shows a custom month calendar (default today Thai
//    UTC+7) and a "⭐ เฉพาะที่ติดดาว" filter. Used by customers-list.
//  - With `days` (e.g. 7): rolling N-day window, newest→oldest, with a count and
//    "◀ N วันก่อนหน้า" paging via weekOffset. Used by the add-customer cards.
// Both modes show a star button on every recording row.
export function RecordingsPlayer({
  phone,
  hasOrekaExt,
  days,
}: {
  phone: string;
  hasOrekaExt: boolean;
  days?: number;
}) {
  const multiDay = !!days && days > 0;

  // ── shared state ──────────────────────────────────────────────────────────
  const [recs, setRecs] = useState<CallRecording[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // ── single-day extras ─────────────────────────────────────────────────────
  const [date, setDate] = useState<string>(todayISOThai);
  const [starredOnly, setStarredOnly] = useState(false);

  // ── star state (both modes) ───────────────────────────────────────────────
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredRecs, setStarredRecs] = useState<StarredRecording[]>([]);

  // Fetch starred recordings for this phone on mount (or when phone changes).
  useEffect(() => {
    if (!phone || !hasOrekaExt) return;
    fetch(`/api/oreka/starred?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => {
        const list: StarredRecording[] = d.starred ?? [];
        setStarredRecs(list);
        setStarredIds(new Set(list.map((s) => s.recordingId)));
      })
      .catch(() => {/* silently ignore — stars are non-critical */});
  }, [phone, hasOrekaExt]);

  // Fetch call recordings whenever phone / date / weekOffset changes.
  useEffect(() => {
    if (!phone || !hasOrekaExt) return;
    if (!multiDay && starredOnly) return; // starred-only view skips this fetch
    setLoading(true);
    const qs = multiDay
      ? `?phone=${encodeURIComponent(phone)}&days=${days}&weekOffset=${weekOffset}`
      : `?phone=${encodeURIComponent(phone)}&date=${date}`;
    fetch(`/api/oreka/recordings-by-phone${qs}`)
      .then((r) => r.json())
      .then((d) => setRecs(d.recordings ?? []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [phone, hasOrekaExt, multiDay, days, weekOffset, date, starredOnly]);

  // ── star toggle ───────────────────────────────────────────────────────────
  const toggleStar = useCallback(
    async (rec: { id: string; timestamp: string; duration: number; direction: string }) => {
      const recId = rec.id;
      const isStarred = starredIds.has(recId);

      // Optimistic update
      if (isStarred) {
        setStarredIds((prev) => { const s = new Set(prev); s.delete(recId); return s; });
        setStarredRecs((prev) => prev.filter((s) => s.recordingId !== recId));
      } else {
        setStarredIds((prev) => new Set(prev).add(recId));
        const newStar: StarredRecording = {
          recordingId: recId,
          phone,
          duration: rec.duration,
          direction: rec.direction,
          calledAt: rec.timestamp,
        };
        setStarredRecs((prev) => [newStar, ...prev]);
      }

      try {
        if (isStarred) {
          await fetch("/api/oreka/starred", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recordingId: recId }),
          });
        } else {
          await fetch("/api/oreka/starred", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordingId: recId,
              phone,
              duration: rec.duration,
              direction: rec.direction,
              calledAt: rec.timestamp,
            }),
          });
        }
      } catch {
        // Revert on network failure
        if (isStarred) {
          setStarredIds((prev) => new Set(prev).add(recId));
          setStarredRecs((prev) => [
            { recordingId: recId, phone, duration: rec.duration, direction: rec.direction, calledAt: rec.timestamp },
            ...prev,
          ]);
        } else {
          setStarredIds((prev) => { const s = new Set(prev); s.delete(recId); return s; });
          setStarredRecs((prev) => prev.filter((s) => s.recordingId !== recId));
        }
      }
    },
    [starredIds, phone]
  );

  if (!hasOrekaExt) return null;

  // ── build rows to render ──────────────────────────────────────────────────
  let rows: RecRow[] = [];
  if (!multiDay && starredOnly) {
    rows = starredRecs.map((s) => ({
      id: s.recordingId,
      timestamp: s.calledAt,
      duration: s.duration,
      direction: s.direction,
      showDate: true,
    }));
  } else if (recs) {
    rows = recs.map((r) => ({
      id: String(r.id),
      timestamp: r.timestamp,
      duration: r.duration,
      direction: r.direction,
      showDate: multiDay,
    }));
  }

  const windowLabel = multiDay
    ? weekOffset === 0
      ? `${days} วันล่าสุด`
      : `ย้อนหลัง ${weekOffset * (days ?? 0)}–${(weekOffset + 1) * (days ?? 0)} วัน`
    : "บันทึกเสียงวันนี้";

  const isLoadingView = loading && (!multiDay ? !starredOnly : true);
  const isEmpty = !multiDay && starredOnly
    ? starredRecs.length === 0
    : !loading && recs !== null && recs.length === 0;

  return (
    <div className="px-4 py-3 border-t border-[#F7F7F7] bg-[#FAFAFA]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
            {windowLabel}
          </span>
          {multiDay && recs && (
            <span className="text-[10px] text-[#58CEE8] font-semibold">โทร {recs.length} ครั้ง</span>
          )}
        </div>
        {/* Right side: paging (multi-day) or star filter (single-day) */}
        {multiDay ? (
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
        ) : (
          <button
            onClick={() => setStarredOnly((v) => !v)}
            title={starredOnly ? "ดูทั้งหมด" : "เฉพาะที่ติดดาว"}
            className={`shrink-0 p-1 rounded-lg transition-colors ${
              starredOnly ? "text-amber-500 hover:bg-amber-50" : "text-[#C0C0C0] hover:text-amber-400 hover:bg-amber-50"
            }`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill={starredOnly ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )}
      </div>

      {/* Single-day mode: inline month calendar */}
      {!multiDay && !starredOnly && (
        <div className="mb-2">
          <CallCalendar
            phone={phone}
            selectedDate={date}
            onSelectDate={(d) => {
              setDate(d);
              setStarredOnly(false);
            }}
          />
        </div>
      )}

      {/* Loading spinner */}
      {isLoadingView && (
        <div className="flex items-center gap-2 text-[11px] text-[#8B8E8F]">
          <svg className="animate-spin w-3 h-3 text-[#58CEE8]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
          </svg>
          กำลังโหลด…
        </div>
      )}

      {/* Empty state */}
      {!isLoadingView && isEmpty && (
        <p className="text-[11px] text-[#C0C0C0]">
          {!multiDay && starredOnly
            ? "ยังไม่มีบันทึกเสียงที่ติดดาว"
            : multiDay
            ? "ไม่มีบันทึกเสียงในช่วงนี้"
            : "ไม่มีบันทึกเสียงวันนี้"}
        </p>
      )}

      {/* Recording rows */}
      {!isLoadingView && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => {
            const { hh, mm, dateStr } = toThaiTime(row.timestamp);
            const isStarred = starredIds.has(row.id);
            const account = "gosell";
            return (
              <div key={row.id} className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-[#E8E8E8] px-3 py-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${row.direction === "OUT" ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                  {row.direction === "OUT" ? "โทรออก" : "รับสาย"}
                </span>
                {row.showDate && (
                  <span className="text-[10px] text-[#C0C0C0] shrink-0">{dateStr}</span>
                )}
                <span className="text-[11px] font-medium text-[#3D3D3D] font-mono shrink-0">{hh}:{mm}</span>
                <span className="text-[11px] text-[#8B8E8F] shrink-0">{formatTalkTime(row.duration)}</span>
                <audio
                  controls
                  preload="none"
                  className="h-7 flex-1 min-w-[160px]"
                  src={`/api/oreka/audio/${row.id}?account=${account}`}
                />
                {/* Star toggle button */}
                <button
                  onClick={() => toggleStar({ id: row.id, timestamp: row.timestamp, duration: row.duration, direction: row.direction })}
                  title={isStarred ? "เอาออกจากดาว" : "ติดดาว"}
                  className="shrink-0 p-1 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={isStarred ? "#F5A623" : "none"}
                    stroke={isStarred ? "#F5A623" : "#C0C0C0"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
