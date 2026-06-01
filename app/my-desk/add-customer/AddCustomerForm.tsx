"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PRODUCTS = [
  "Beta Life", "Beta Life 2 กล่อง", "Beta Life 3 กล่อง",
  "Beta Oil", "Beta Oil 2 กล่อง",
  "BioActive+", "BioActive+ 2 กล่อง",
  "Lab Farm", "Lab Farm 2 กล่อง",
  "อื่น ๆ",
];

// YYYY-MM-DD สำหรับ input type="date"
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// แปลง YYYY-MM-DD → DD/MM/YYYY ก่อนส่ง Sheets
function isoToDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function AddCustomerForm({ agentName }: { agentName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    date: todayISO(),
    name: "",
    phone: "",
    address: "",
    product: "",
    // GoSell
    phoneClose: "",
    crm: "",
    upsell: "",
    // Hopeful
    hopefulPhoneClose: "",
    hopefulCrm: "",
    hopefulUpsell: "",
    note: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/sheets/add-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, ...form, date: isoToDMY(form.date),
          hopefulPhoneClose: form.hopefulPhoneClose,
          hopefulCrm: form.hopefulCrm,
          hopefulUpsell: form.hopefulUpsell,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      }

      setStatus("success");
      setForm({
        date: todayISO(),
        name: "",
        phone: "",
        address: "",
        product: "",
        phoneClose: "",
        crm: "",
        upsell: "",
        hopefulPhoneClose: "",
        hopefulCrm: "",
        hopefulUpsell: "",
        note: "",
      });

      // broadcast to all open tabs (War Room, Supervisor) — bypasses RLS
      const supabase = createClient();
      const ch = supabase.channel("sales-update");
      await ch.subscribe();
      await ch.send({ type: "broadcast", event: "sale_added", payload: {} });
      supabase.removeChannel(ch);

      // auto redirect to today's list after 1.5s
      setTimeout(() => {
        router.push("/my-desk/priority-queue");
        router.refresh();
      }, 1500);

    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

      {/* Success banner */}
      {status === "success" && (
        <div className="flex items-center gap-3 bg-[#87DE81]/15 border border-[#87DE81]/40 rounded-xl px-4 py-3">
          <span className="text-lg">✅</span>
          <div>
            <p className="text-[13px] font-semibold text-[#3D9B3A]">บันทึกสำเร็จ!</p>
            <p className="text-[11px] text-[#3D9B3A]">กำลังพาไปหน้ารายการขาย...</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {status === "error" && (
        <div className="flex items-center gap-3 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl px-4 py-3">
          <span className="text-lg">⚠️</span>
          <p className="text-[13px] text-[#FF6B6B]">{errorMsg}</p>
        </div>
      )}

      {/* Section: ข้อมูลพื้นฐาน */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">ข้อมูลลูกค้า</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="วัน/เดือน/ปี" required>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={inputCls}
              required
            />
          </Field>

          <Field label="ชื่อ - สกุล" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="สมหญิง ดีใจ"
              className={inputCls}
              required
            />
          </Field>

          <Field label="เบอร์โทร">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="0891234567"
              className={inputCls}
            />
          </Field>

          <Field label="สินค้าที่ขายได้">
            <select
              value={form.product}
              onChange={(e) => set("product", e.target.value)}
              className={inputCls}
            >
              <option value="">-- เลือกสินค้า --</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>

          <Field label="ที่อยู่" className="col-span-2">
            <input
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="123 ถ.สุขุมวิท กรุงเทพฯ"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* Section: ยอดขาย */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">ยอดขาย</h2>

        {/* ปิดจากเบอร์ */}
        <div className="mb-3">
          <Field label="ปิดจากเบอร์ (฿)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8E8F] text-[13px]">฿</span>
              <input
                type="number"
                min="0"
                value={form.phoneClose}
                onChange={(e) => set("phoneClose", e.target.value)}
                placeholder="0"
                className={`${inputCls} pl-7`}
              />
            </div>
          </Field>
        </div>

        {/* GoSell + Hopeful side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* GoSell — Green (design system primary) */}
          <div className="rounded-xl border-2 border-[#87DE81]/40 bg-[#87DE81]/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#87DE81] flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#3D9B3A]">GoSell</div>
                <div className="text-[10px] text-[#87DE81] font-medium">CRM System</div>
              </div>
            </div>
            <div className="space-y-3">
              <SaleInput label="ปิดจากเบอร์" value={form.phoneClose} onChange={(v) => set("phoneClose", v)} color="green" />
              <SaleInput label="CRM" value={form.crm} onChange={(v) => set("crm", v)} color="green" />
              <SaleInput label="Upsell" value={form.upsell} onChange={(v) => set("upsell", v)} color="green" />
            </div>
            {(parseFloat(form.phoneClose) > 0 || parseFloat(form.crm) > 0 || parseFloat(form.upsell) > 0) && (
              <div className="mt-3 bg-[#87DE81]/15 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-[10px] text-[#3D9B3A] font-medium">รวม GoSell</span>
                <span className="text-[13px] font-bold text-[#3D9B3A]">
                  ฿{((parseFloat(form.phoneClose) || 0) + (parseFloat(form.crm) || 0) + (parseFloat(form.upsell) || 0)).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Hopeful — Cyan (design system secondary) */}
          <div className="rounded-xl border-2 border-[#58CEE8]/40 bg-[#58CEE8]/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#58CEE8] flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#0E8FA8]">Hopeful</div>
                <div className="text-[10px] text-[#58CEE8] font-medium">Upsell Channel</div>
              </div>
            </div>
            <div className="space-y-3">
              <SaleInput label="ปิดจากเบอร์" value={form.hopefulPhoneClose} onChange={(v) => set("hopefulPhoneClose", v)} color="cyan" />
              <SaleInput label="CRM" value={form.hopefulCrm} onChange={(v) => set("hopefulCrm", v)} color="cyan" />
              <SaleInput label="Upsell" value={form.hopefulUpsell} onChange={(v) => set("hopefulUpsell", v)} color="cyan" />
            </div>
            {(parseFloat(form.hopefulPhoneClose) > 0 || parseFloat(form.hopefulCrm) > 0 || parseFloat(form.hopefulUpsell) > 0) && (
              <div className="mt-3 bg-[#58CEE8]/15 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-[10px] text-[#0E8FA8] font-medium">รวม Hopeful</span>
                <span className="text-[13px] font-bold text-[#0E8FA8]">
                  ฿{((parseFloat(form.hopefulPhoneClose) || 0) + (parseFloat(form.hopefulCrm) || 0) + (parseFloat(form.hopefulUpsell) || 0)).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live total */}
        {(() => {
          const total = (parseFloat(form.phoneClose) || 0) + (parseFloat(form.crm) || 0) + (parseFloat(form.upsell) || 0)
                      + (parseFloat(form.hopefulPhoneClose) || 0) + (parseFloat(form.hopefulCrm) || 0) + (parseFloat(form.hopefulUpsell) || 0);
          return total > 0 ? (
            <div className="mt-4 bg-[#87DE81]/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-[12px] text-[#3D9B3A]">ยอดรวมทั้งหมด (GoSell + Hopeful)</span>
              <span className="text-[18px] font-bold text-[#3D9B3A]">฿{total.toLocaleString()}</span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Section: หมายเหตุ */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">หมายเหตุ</h2>
        <textarea
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="เช่น โอนแล้ว / รอโอน / ติดตามพรุ่งนี้"
          rows={3}
          className={`${inputCls} resize-none`}
        />
        <div className="flex gap-2 mt-2">
          {["โอนแล้ว", "รอโอน", "ติดตาม", "รอยืนยัน", "นัดโทรพรุ่งนี้"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("note", t)}
              className="text-[11px] bg-[#F7F7F7] text-[#8B8E8F] px-2.5 py-1 rounded-lg hover:bg-[#E8E8E8] hover:text-[#3D3D3D] transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading" || status === "success" || !form.name.trim()}
          className="flex items-center gap-2 bg-[#87DE81] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "loading" ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10" />
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              บันทึกลงระบบ
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setForm({ date: todayISO(), name: "", phone: "", address: "", product: "", phoneClose: "", crm: "", upsell: "", hopefulPhoneClose: "", hopefulCrm: "", hopefulUpsell: "", note: "" })}
          className="text-[13px] text-[#8B8E8F] hover:text-[#3D3D3D] px-4 py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors"
        >
          ล้างข้อมูล
        </button>
      </div>
    </form>
  );
}

function SaleInput({ label, value, onChange, color }: { label: string; value: string; onChange: (v: string) => void; color: "green" | "cyan" }) {
  const isGreen = color === "green";
  const borderFocus = isGreen ? "focus:border-[#87DE81]" : "focus:border-[#58CEE8]";
  const bahtColor = isGreen ? "text-[#87DE81]" : "text-[#58CEE8]";
  const labelColor = isGreen ? "text-[#3D9B3A]/70" : "text-[#0E8FA8]/70";
  const borderColor = isGreen ? "border-[#87DE81]/30" : "border-[#58CEE8]/30";
  return (
    <div>
      <div className={`text-[10px] font-medium mb-1 uppercase tracking-wide ${labelColor}`}>{label}</div>
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold ${bahtColor}`}>฿</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={`w-full bg-white/70 border ${borderColor} rounded-lg pl-7 pr-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none ${borderFocus} focus:bg-white transition-colors`}
        />
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

function Field({ label, required, className, children }: {
  label: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-[#FF6B6B] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
