"use client";
import { useState, useCallback } from "react";
import type { AppointmentRow } from "@/lib/db";
import NewAppointmentModal from "./NewAppointmentModal";
import { formatTalkTime } from "@/lib/oreka-format";

// ── Thai Buddhist Era utilities ──────────────────────────────────────────────

const THAI_MONTHS = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const THAI_DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function isoToThaiBE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

function monthLabel(year: number, month0: number): string {
  return `${THAI_MONTHS[month0]} ${year + 543}`;
}

function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO(): string {
  const now = new Date(Date.now() + 7 * 3600000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

// ── AppointmentCard ──────────────────────────────────────────────────────────

interface SummaryResult {
  summary: string;
  coachingTips: string[];
  duration: number;
  calledAt: string;
}

function AppointmentCard({
  appointment,
  hasOrekaExt,
  onStatusChange,
  onDelete,
}: {
  appointment: AppointmentRow;
  hasOrekaExt: boolean;
  onStatusChange: (id: string, status: "completed" | "cancelled") => void;
  onDelete: (id: string) => void;
}) {
  const [actionLoading, setActionLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function handleSummarize() {
    if (!appointment.customerPhone) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/call-summary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: appointment.customerPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSummaryError(data.error === "no_recording" ? "ไม่พบการโทรล่าสุดใน 7 วันที่ผ่านมา" : "เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      setSummary(data);
    } catch {
      setSummaryError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSummarizing(false);
    }
  }

  const badgeMap: Record<AppointmentRow["status"], { label: string; cls: string }> = {
    pending: { label: "รอนัด", cls: "bg-[#58CEE8]/15 text-[#0E8FA8]" },
    completed: { label: "เสร็จแล้ว", cls: "bg-[#87DE81]/15 text-[#3D9B3A]" },
    cancelled: { label: "ยกเลิก", cls: "bg-[#FF6B6B]/10 text-[#FF6B6B]" },
  };
  const badge = badgeMap[appointment.status];

  async function handleStatus(status: "completed" | "cancelled") {
    setActionLoading(true);
    try {
      await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onStatusChange(appointment.id, status);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("ลบนัดหมายนี้?")) return;
    setActionLoading(true);
    try {
      await fetch(`/api/appointments/${appointment.id}`, { method: "DELETE" });
      onDelete(appointment.id);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-start gap-3">
      <span className="w-2 h-2 rounded-full bg-[#58CEE8] shrink-0 mt-1.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#3D3D3D] truncate">{appointment.customerName}</span>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        </div>
        {appointment.customerPhone && (
          <p className="text-[11px] text-[#8B8E8F] mt-0.5">{appointment.customerPhone}</p>
        )}
        <p className="text-[11px] text-[#8B8E8F] mt-0.5">{isoToThaiBE(appointment.appointmentDate)}</p>
        {appointment.preSuggestion && (
          <p className="text-[12px] text-[#3D3D3D] mt-1.5 line-clamp-2">{appointment.preSuggestion}</p>
        )}
        {appointment.status === "pending" && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => handleStatus("completed")}
              disabled={actionLoading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#87DE81]/15 text-[#3D9B3A] hover:bg-[#87DE81]/30 transition-colors disabled:opacity-50"
            >
              ✓ สำเร็จ
            </button>
            <button
              onClick={() => handleStatus("cancelled")}
              disabled={actionLoading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F7F7F7] text-[#8B8E8F] hover:bg-[#E8E8E8] transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {/* Call summary button — only when phone exists + Oreka configured + not yet summarized */}
        {hasOrekaExt && appointment.customerPhone && !summary && (
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/40 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60"
          >
            {summarizing ? (
              <>
                <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                กำลังสรุป...
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                สรุปบทสนทนา
              </>
            )}
          </button>
        )}

        {summaryError && (
          <p className="mt-1.5 text-[10px] text-[#CC3333]">{summaryError}</p>
        )}

        {summary && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">สรุปการโทรล่าสุด</span>
              {summary.duration > 0 && (
                <span className="text-[10px] text-[#C0C0C0]">({formatTalkTime(summary.duration)})</span>
              )}
            </div>
            <p className="text-[11px] text-[#3D3D3D] leading-relaxed">{summary.summary}</p>
            {summary.coachingTips.length > 0 && (
              <div className="bg-[#87DE81]/8 border border-[#87DE81]/20 rounded-lg p-2.5 space-y-1">
                <div className="text-[10px] font-semibold text-[#3D9B3A]">💡 คำแนะนำ</div>
                {summary.coachingTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-[#3D3D3D]">
                    <span className="text-[#87DE81] font-bold shrink-0">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={handleDelete}
        disabled={actionLoading}
        className="shrink-0 text-[#C0C0C0] hover:text-[#FF6B6B] transition-colors disabled:opacity-50"
        title="ลบนัดหมาย"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  );
}

// ── AppointmentCalendar ──────────────────────────────────────────────────────

interface Props {
  initialAppointments: AppointmentRow[];
  initialMonth: string; // "YYYY-MM"
  hasOrekaExt: boolean;
}

export default function AppointmentCalendar({ initialAppointments, initialMonth, hasOrekaExt }: Props) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const today = todayISO();
  const [year, monthNum] = currentMonth.split("-").map(Number);

  async function goToMonth(newMonth: string) {
    setLoading(true);
    setSelectedDate(null);
    try {
      const res = await fetch(`/api/appointments?month=${newMonth}`);
      const data = await res.json();
      setAppointments(data.appointments ?? []);
      setCurrentMonth(newMonth);
    } finally {
      setLoading(false);
    }
  }

  function jumpToToday() {
    const todayMonth = today.slice(0, 7);
    if (todayMonth !== currentMonth) {
      goToMonth(todayMonth).then(() => setSelectedDate(today));
    } else {
      setSelectedDate(today);
    }
  }

  // Build 42-cell calendar grid (6 rows × 7 cols, Sunday-first)
  const firstDow = new Date(year, monthNum - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const appointmentDays = new Set(
    appointments.filter((a) => a.status === "pending").map((a) => a.appointmentDate)
  );

  function cellISO(day: number): string {
    return `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const displayed = selectedDate
    ? appointments.filter((a) => a.appointmentDate === selectedDate)
    : appointments;

  const handleStatusChange = useCallback((id: string, status: "completed" | "cancelled") => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleCreated = useCallback((appointment: AppointmentRow) => {
    const apptMonth = appointment.appointmentDate.slice(0, 7);
    if (apptMonth === currentMonth) {
      setAppointments((prev) => [...prev, appointment]);
    }
    setSelectedDate(appointment.appointmentDate);
  }, [currentMonth]);

  return (
    <>
      {/* Calendar card */}
      <div className={`bg-white border border-[#E8E8E8] rounded-xl p-5 transition-opacity ${loading ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => goToMonth(addMonths(currentMonth, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F7F7F7] text-[#8B8E8F] hover:text-[#3D3D3D] transition-colors text-[16px]"
            >
              ‹
            </button>
            <span className="text-[14px] font-semibold text-[#3D3D3D] min-w-[120px] text-center">
              {monthLabel(year, monthNum - 1)}
            </span>
            <button
              onClick={() => goToMonth(addMonths(currentMonth, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F7F7F7] text-[#8B8E8F] hover:text-[#3D3D3D] transition-colors text-[16px]"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={jumpToToday}
              className="px-3 py-1.5 rounded-lg border border-[#E8E8E8] text-[12px] text-[#8B8E8F] hover:bg-[#F7F7F7] transition-colors"
            >
              วันนี้
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg bg-[#87DE81] text-[12px] font-semibold text-white hover:bg-[#6DD467] transition-colors"
            >
              + นัดหมายใหม่
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {THAI_DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-[11px] text-[#8B8E8F] py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const iso = cellISO(day);
            const hasAppt = appointmentDays.has(iso);
            const isToday = iso === today;
            const isSelected = iso === selectedDate;
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(iso === selectedDate ? null : iso)}
                className={[
                  "flex flex-col items-center justify-start pt-1 pb-1.5 rounded-lg min-h-[40px] transition-colors",
                  isSelected ? "bg-[#87DE81] text-white" : isToday ? "ring-1 ring-[#58CEE8] text-[#3D3D3D]" : "hover:bg-[#F7F7F7] text-[#3D3D3D]",
                ].join(" ")}
              >
                <span className="text-[12px] font-medium leading-none">{day}</span>
                {hasAppt && (
                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? "bg-white" : "bg-[#87DE81]"}`} />
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="mt-3 pt-3 border-t border-[#E8E8E8]">
            <p className="text-[11px] text-[#8B8E8F]">
              {isoToThaiBE(selectedDate)} · {displayed.length} นัดหมาย
              <button onClick={() => setSelectedDate(null)} className="ml-2 text-[#022EE8] hover:underline">ดูทั้งหมด</button>
            </p>
          </div>
        )}
      </div>

      {/* Appointment list */}
      {displayed.length > 0 ? (
        <div className="space-y-3">
          {displayed.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              hasOrekaExt={hasOrekaExt}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-8 text-center">
          <p className="text-[13px] text-[#8B8E8F]">
            {selectedDate ? `ไม่มีนัดหมายในวันที่ ${isoToThaiBE(selectedDate)}` : "ยังไม่มีนัดหมายในเดือนนี้"}
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 px-4 py-2 rounded-lg bg-[#87DE81] text-[13px] font-semibold text-white hover:bg-[#6DD467] transition-colors"
          >
            + เพิ่มนัดหมาย
          </button>
        </div>
      )}

      {showModal && (
        <NewAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
