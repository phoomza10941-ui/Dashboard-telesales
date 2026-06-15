"use client";
import { useState, useEffect, FormEvent } from "react";
import type { AppointmentRow } from "@/lib/db";

const INPUT_CLASS =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

function isoToThaiBE(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

function todayISO(): string {
  const now = new Date(Date.now() + 7 * 3600000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

interface Props {
  onClose: () => void;
  onCreated: (appointment: AppointmentRow) => void;
}

export default function NewAppointmentModal({ onClose, onCreated }: Props) {
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [preSuggestion, setPreSuggestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [error, setError] = useState("");

  // Phone lookup with debounce — reuses existing /api/customers/lookup
  useEffect(() => {
    if (phone.length < 9) {
      setLookupStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setLookupStatus("loading");
      try {
        const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (data.found && data.history?.[0]?.name) {
          setCustomerName(data.history[0].name);
          setNameLocked(true);
          setLookupStatus("found");
        } else {
          setNameLocked(false);
          setLookupStatus("notfound");
        }
      } catch {
        setLookupStatus("notfound");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [phone]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !appointmentDate) {
      setError("กรุณากรอกชื่อลูกค้าและวันนัดหมาย");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone: phone, appointmentDate, preSuggestion }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "เกิดข้อผิดพลาด");
      }
      const { appointment } = await res.json();
      onCreated(appointment);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-[#3D3D3D]">+ นัดหมายใหม่</h2>
          <button onClick={onClose} className="text-[#8B8E8F] hover:text-[#3D3D3D] transition-colors text-[18px] leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone */}
          <div>
            <label className="block text-[12px] font-medium text-[#3D3D3D] mb-1.5">เบอร์โทรลูกค้า</label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812345678"
                className={INPUT_CLASS}
              />
              {lookupStatus === "loading" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8B8E8F]">กำลังค้นหา...</span>
              )}
              {lookupStatus === "found" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#3D9B3A] font-medium">พบลูกค้า ✓</span>
              )}
              {lookupStatus === "notfound" && phone.length >= 9 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#8B8E8F]">ลูกค้าใหม่</span>
              )}
            </div>
          </div>

          {/* Customer name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[#3D3D3D]">ชื่อลูกค้า <span className="text-[#FF6B6B]">*</span></label>
              {nameLocked && (
                <button type="button" onClick={() => setNameLocked(false)} className="text-[11px] text-[#022EE8] hover:underline">แก้ไข</button>
              )}
            </div>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              readOnly={nameLocked}
              placeholder="ชื่อ-นามสกุล"
              className={`${INPUT_CLASS} ${nameLocked ? "bg-[#F7F7F7] text-[#8B8E8F] cursor-default" : ""}`}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[12px] font-medium text-[#3D3D3D] mb-1.5">วันที่นัดหมาย <span className="text-[#FF6B6B]">*</span></label>
            <input
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              min={todayISO()}
              className={INPUT_CLASS}
            />
            {appointmentDate && (
              <p className="text-[11px] text-[#8B8E8F] mt-1">วันที่เลือก: {isoToThaiBE(appointmentDate)}</p>
            )}
          </div>

          {/* Pre-suggestion */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-[#3D3D3D]">บันทึก / สิ่งที่ควรทำ</label>
              {/* AI summarize — placeholder until Oreka transcription is ready */}
              <button
                type="button"
                disabled
                title="🔄 กำลังพัฒนา... รอการเชื่อมต่อ Oreka"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F7F7F7] border border-[#E8E8E8] text-[11px] text-[#C0C0C0] cursor-not-allowed opacity-60 select-none"
              >
                🤖 สรุปบทสนทนา
              </button>
            </div>
            <textarea
              value={preSuggestion}
              onChange={(e) => setPreSuggestion(e.target.value)}
              rows={3}
              placeholder="เช่น ลูกค้าสนใจ iPhone Air แต่ยังลังเล — เสนอผ่อน 0% และ AirPods เพิ่ม"
              className={INPUT_CLASS}
            />
          </div>

          {error && <p className="text-[12px] text-[#FF6B6B]">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#E8E8E8] text-[13px] text-[#8B8E8F] hover:bg-[#F7F7F7] transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || !customerName.trim() || !appointmentDate}
              className="flex-1 py-2.5 rounded-lg bg-[#87DE81] text-[13px] font-semibold text-white hover:bg-[#6DD467] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึกนัดหมาย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
