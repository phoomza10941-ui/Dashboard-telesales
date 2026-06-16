"use client";
import { useState, useEffect } from "react";
import { formatTalkTime } from "@/lib/oreka-format";

interface DaySummary {
  count: number;
  duration: number;
}

interface CallCalendarProps {
  phone: string;
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISOThai(): string {
  const thai = new Date(Date.now() + 7 * 3600_000);
  return `${thai.getUTCFullYear()}-${pad2(thai.getUTCMonth() + 1)}-${pad2(thai.getUTCDate())}`;
}

function thaiMonthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${months[m - 1]} ${y}`;
}

function prevMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${pad2(m - 1)}`;
}

function nextMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${pad2(m + 1)}`;
}

function buildMonthGrid(monthKey: string): (string | null)[] {
  const [y, m] = monthKey.split("-").map(Number);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  let startDow = firstDay.getUTCDay();
  startDow = (startDow + 6) % 7; // Mon=0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${monthKey}-${pad2(d)}`);
  }
  return cells;
}

function loadStarredDays(phone: string): Set<string> {
  try {
    const raw = localStorage.getItem(`starred-days:${phone}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveStarredDays(phone: string, days: Set<string>) {
  try {
    localStorage.setItem(`starred-days:${phone}`, JSON.stringify([...days]));
  } catch { /* ignore */ }
}

const WEEKDAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export function CallCalendar({ phone, selectedDate, onSelectDate }: CallCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState<string>(() => thaiMonthKey(selectedDate));
  const [daysMap, setDaysMap] = useState<Record<string, DaySummary>>({});
  const [loadingMonth, setLoadingMonth] = useState<string>("");
  const [starredDays, setStarredDays] = useState<Set<string>>(new Set());
  const today = todayISOThai();

  // Load starred days from localStorage after mount
  useEffect(() => {
    setStarredDays(loadStarredDays(phone));
  }, [phone]);

  // Sync visible month when selected date changes externally
  useEffect(() => {
    setVisibleMonth(thaiMonthKey(selectedDate));
  }, [selectedDate]);

  // Fetch call-days whenever phone or visibleMonth changes
  useEffect(() => {
    if (!phone) return;
    setLoadingMonth(visibleMonth);
    fetch(`/api/oreka/call-days?phone=${encodeURIComponent(phone)}&month=${visibleMonth}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.days) setDaysMap(d.days as Record<string, DaySummary>);
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setLoadingMonth(""));
  }, [phone, visibleMonth]);

  const toggleStarDay = (e: React.MouseEvent, dateStr: string) => {
    e.stopPropagation();
    setStarredDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      saveStarredDays(phone, next);
      return next;
    });
  };

  const cells = buildMonthGrid(visibleMonth);
  const isLoading = loadingMonth === visibleMonth;

  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white p-2 select-none w-[196px] shrink-0">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <button
          onClick={() => setVisibleMonth(prevMonth(visibleMonth))}
          className="text-[10px] text-[#8B8E8F] hover:text-[#3D3D3D] px-1 py-0.5 rounded transition-colors"
        >
          ◀
        </button>
        <span className="text-[10px] font-semibold text-[#3D3D3D]">
          {monthLabel(visibleMonth)}
          {isLoading && <span className="ml-1 text-[#C0C0C0]">…</span>}
        </span>
        <button
          onClick={() => setVisibleMonth(nextMonth(visibleMonth))}
          className="text-[10px] text-[#8B8E8F] hover:text-[#3D3D3D] px-1 py-0.5 rounded transition-colors"
        >
          ▶
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[9px] text-[#C0C0C0] font-medium py-0.5">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid — fixed 26px cells so calendar is always 196px wide */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dateStr, idx) => {
          if (!dateStr) {
            return <div key={`empty-${idx}`} className="w-[26px] h-[26px]" />;
          }
          const summary = daysMap[dateStr];
          const hasCalls = !!summary;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const isStarred = starredDays.has(dateStr);

          const tooltip = hasCalls
            ? `${summary.count} สาย • รวม ${formatTalkTime(summary.duration)}${isStarred ? " ★" : ""}`
            : isStarred ? "★ วันที่บันทึกไว้" : undefined;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              title={tooltip}
              className={[
                "group relative w-[26px] h-[26px] flex items-center justify-center rounded-md text-[10px] font-medium transition-all",
                isStarred
                  ? "bg-amber-100 text-amber-700 hover:brightness-95"
                  : hasCalls
                  ? "bg-[#87DE81] text-[#2a6e28] hover:brightness-95"
                  : "text-[#8B8E8F] hover:bg-[#F7F7F7]",
                isSelected ? "ring-2 ring-[#3D3D3D] ring-offset-0" : "",
                isToday && !isSelected ? "ring-1 ring-[#58CEE8]" : "",
              ].filter(Boolean).join(" ")}
            >
              {dateStr.slice(-2).replace(/^0/, "")}
              {/* Star overlay — visible on hover (any day) or always when starred */}
              {(hasCalls || isStarred) && (
                <span
                  onClick={(e) => toggleStarDay(e, dateStr)}
                  title={isStarred ? "เอาออกจากดาว" : "ติดดาววันนี้"}
                  className={[
                    "absolute top-0 right-0 leading-none transition-opacity",
                    isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                  ].join(" ")}
                  style={{ fontSize: 7, lineHeight: 1 }}
                >
                  {isStarred ? "★" : "☆"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Starred days quick-jump */}
      {starredDays.size > 0 && (
        <div className="mt-2 pt-1.5 border-t border-[#F0F0F0] flex flex-wrap gap-1">
          {[...starredDays].sort().reverse().slice(0, 4).map((d) => (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                d === selectedDate
                  ? "bg-amber-400 text-white"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              ★ {d.slice(5).replace("-", "/")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
