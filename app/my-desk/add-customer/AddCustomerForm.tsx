"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NOTE_STATUSES = [
  { note: "โอนแล้ว",        label: "โอนแล้ว",  sub: "Closed",    icon: "✅", color: "#3D9B3A" },
  { note: "รอโอน",          label: "รอโอน",    sub: "Pending",   icon: "⏳", color: "#C48A00" },
  { note: "ติดตาม",         label: "ติดตาม",   sub: "Follow-up", icon: "📞", color: "#0E8FA8" },
  { note: "นัดโทรพรุ่งนี้", label: "นัดโทร",   sub: "Scheduled", icon: "📅", color: "#7B5EA7" },
  { note: "หลุด",           label: "หลุด",     sub: "Lost",      icon: "❌", color: "#CC3333" },
  { note: "ของแถม",         label: "ของแถม",   sub: "Free Gift", icon: "🎁", color: "#E07C30" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  closed: "โอนแล้ว", pending_transfer: "รอโอน",
  follow_up: "ติดตาม", in_progress: "กำลังดำเนินการ", lost: "หลุด",
};

interface HistoryItem {
  id: string; date: string; product: string;
  total: number; note: string; status: string; name: string; address: string;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function isoToDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MAX_SALE_AMOUNT = 1_000_000;

export default function AddCustomerForm({ agentName, products }: { agentName: string; products: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDupConfirm, setShowDupConfirm] = useState(false);

  // phone lookup state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hasToday, setHasToday] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    date: todayISO(),
    name: searchParams.get("name") ?? "",
    phone: searchParams.get("phone") ?? "",
    address: searchParams.get("address") ?? "",
    product: "",
    quantity: "1",
    phoneClose: "", crm: "", upsell: "",
    hopefulPhoneClose: "", hopefulCrm: "", hopefulUpsell: "",
    note: "", remark: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Debounced phone lookup
  useEffect(() => {
    const phone = form.phone.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (phone.length < 9) {
      setHistory([]);
      setHasToday(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        setHistory(data.found ? data.history : []);
        setHasToday(data.hasToday ?? false);
      } catch { setHistory([]); setHasToday(false); }
      finally { setLookupLoading(false); }
    }, 500);
  }, [form.phone]);

  function clampAmt(v: string): string {
    const n = Math.min(Math.max(parseFloat(v) || 0, 0), MAX_SALE_AMOUNT);
    return n === 0 ? "" : String(n);
  }

  async function doSubmit() {
    setStatus("loading");
    setErrorMsg("");
    setShowDupConfirm(false);
    const clampedForm = {
      ...form,
      phoneClose: clampAmt(form.phoneClose),
      crm: clampAmt(form.crm),
      upsell: clampAmt(form.upsell),
      hopefulPhoneClose: clampAmt(form.hopefulPhoneClose),
      hopefulCrm: clampAmt(form.hopefulCrm),
      hopefulUpsell: clampAmt(form.hopefulUpsell),
    };
    try {
      const res = await fetch("/api/sheets/add-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName, ...clampedForm, date: isoToDMY(clampedForm.date),
          quantity: parseInt(clampedForm.quantity) || 1,
          hopefulPhoneClose: clampedForm.hopefulPhoneClose,
          hopefulCrm: clampedForm.hopefulCrm,
          hopefulUpsell: clampedForm.hopefulUpsell,
          remark: clampedForm.remark,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      }
      setStatus("success");
      setHistory([]); setHasToday(false);
      setForm({
        date: todayISO(), name: "", phone: "", address: "", product: "", quantity: "1",
        phoneClose: "", crm: "", upsell: "",
        hopefulPhoneClose: "", hopefulCrm: "", hopefulUpsell: "",
        note: "", remark: "",
      });
      const supabase = createClient();
      const ch = supabase.channel("sales-update");
      await ch.subscribe();
      await ch.send({ type: "broadcast", event: "sale_added", payload: {} });
      supabase.removeChannel(ch);
      setTimeout(() => { router.push("/my-desk/priority-queue"); router.refresh(); }, 1500);
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // Block same-day duplicate — ask for confirmation
    if (hasToday && !showDupConfirm) {
      setShowDupConfirm(true);
      return;
    }
    doSubmit();
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

      {/* Duplicate same-day confirmation */}
      {showDupConfirm && (
        <div className="bg-[#FFBA49]/10 border border-[#FFBA49]/40 rounded-xl px-4 py-3">
          <p className="text-[13px] font-semibold text-[#C48A00] mb-1">มีรายการของเบอร์นี้วันนี้แล้ว</p>
          <p className="text-[12px] text-[#C48A00] mb-3">ต้องการบันทึกรายการใหม่ซ้ำเบอร์เดิมหรือไม่?</p>
          <div className="flex gap-2">
            <button type="submit" className="text-[12px] font-semibold bg-[#FFBA49] text-white px-4 py-1.5 rounded-lg hover:bg-[#E0A030] transition-colors">
              ยืนยัน บันทึกต่อ
            </button>
            <button type="button" onClick={() => setShowDupConfirm(false)} className="text-[12px] text-[#8B8E8F] px-4 py-1.5 rounded-lg hover:bg-[#F7F7F7] transition-colors">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Section: ข้อมูลลูกค้า */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">ข้อมูลลูกค้า</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="วัน/เดือน/ปี" required>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} required />
          </Field>

          <Field label="ชื่อ - สกุล" required>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="สมหญิง ดีใจ" className={inputCls} required />
          </Field>

          <Field label="เบอร์โทร">
            <div className="relative">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="0891234567"
                className={inputCls}
              />
              {lookupLoading && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#C0C0C0]" width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/>
                </svg>
              )}
            </div>

            {/* Returning customer history panel */}
            {history.length > 0 && (
              <div className="mt-2 rounded-xl border border-[#022EE8]/30 bg-[#022EE8]/5 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[#022EE8]/20">
                  <span className="text-[10px] font-bold text-[#0E8FA8] uppercase tracking-wide">ลูกค้าเก่า</span>
                  <span className="text-[10px] text-[#022EE8]">เคยซื้อ {history.length} ครั้ง</span>
                  {hasToday && (
                    <span className="text-[10px] font-semibold bg-[#FFBA49]/20 text-[#C48A00] px-2 py-0.5 rounded-full">มีรายการวันนี้</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const latest = history[0];
                      if (latest) setForm((prev) => ({
                        ...prev,
                        name: latest.name,
                        address: latest.address || prev.address,
                      }));
                    }}
                    className="ml-auto text-[10px] font-semibold bg-[#022EE8] text-white px-2.5 py-1 rounded-lg hover:bg-[#2AAAC8] transition-colors"
                  >
                    ใช้ข้อมูลเดิม
                  </button>
                </div>
                <div className="divide-y divide-[#022EE8]/10 max-h-40 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-[10px] text-[#C0C0C0] shrink-0 w-20">{h.date}</span>
                      <span className="text-[11px] text-[#3D3D3D] flex-1 truncate">{h.product || "—"}</span>
                      <span className="text-[10px] text-[#8B8E8F] shrink-0">{STATUS_LABEL[h.status] ?? h.status}</span>
                      {h.total > 0 && <span className="text-[11px] font-semibold text-[#3D9B3A] shrink-0">฿{h.total.toLocaleString()}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Field>

          <Field label="สินค้าที่ขายได้">
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="text" list="product-list" value={form.product} onChange={(e) => set("product", e.target.value)} placeholder="พิมพ์หรือเลือกสินค้า" className={inputCls} />
                <datalist id="product-list">
                  {products.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div className="w-24 shrink-0">
                <div className="text-[10px] font-medium text-[#8B8E8F] mb-1 uppercase tracking-wide">จำนวน</div>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={form.quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") { set("quantity", ""); return; }
                    const n = Math.max(1, Math.min(999, parseInt(v) || 1));
                    set("quantity", String(n));
                  }}
                  className={inputCls + " text-center"}
                />
              </div>
            </div>
          </Field>

          <Field label="ที่อยู่" className="col-span-2">
            <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 ถ.สุขุมวิท กรุงเทพฯ" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Section: ยอดขาย */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">ยอดขาย</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* GoSell */}
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
                <span className="text-[13px] font-bold text-[#3D9B3A]">฿{((parseFloat(form.phoneClose)||0)+(parseFloat(form.crm)||0)+(parseFloat(form.upsell)||0)).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Hopeful */}
          <div className="rounded-xl border-2 border-[#022EE8]/40 bg-[#022EE8]/5 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-[#022EE8] flex items-center justify-center shrink-0">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#0E8FA8]">Hopeful</div>
                <div className="text-[10px] text-[#022EE8] font-medium">Upsell Channel</div>
              </div>
            </div>
            <div className="space-y-3">
              <SaleInput label="ปิดจากเบอร์" value={form.hopefulPhoneClose} onChange={(v) => set("hopefulPhoneClose", v)} color="cyan" />
              <SaleInput label="CRM" value={form.hopefulCrm} onChange={(v) => set("hopefulCrm", v)} color="cyan" />
              <SaleInput label="Upsell" value={form.hopefulUpsell} onChange={(v) => set("hopefulUpsell", v)} color="cyan" />
            </div>
            {(parseFloat(form.hopefulPhoneClose) > 0 || parseFloat(form.hopefulCrm) > 0 || parseFloat(form.hopefulUpsell) > 0) && (
              <div className="mt-3 bg-[#022EE8]/15 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-[10px] text-[#0E8FA8] font-medium">รวม Hopeful</span>
                <span className="text-[13px] font-bold text-[#0E8FA8]">฿{((parseFloat(form.hopefulPhoneClose)||0)+(parseFloat(form.hopefulCrm)||0)+(parseFloat(form.hopefulUpsell)||0)).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live total */}
        {(() => {
          const total = (parseFloat(form.phoneClose)||0)+(parseFloat(form.crm)||0)+(parseFloat(form.upsell)||0)
                      +(parseFloat(form.hopefulPhoneClose)||0)+(parseFloat(form.hopefulCrm)||0)+(parseFloat(form.hopefulUpsell)||0);
          return total > 0 ? (
            <div className="mt-4 bg-[#87DE81]/10 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-[12px] text-[#3D9B3A]">ยอดรวมทั้งหมด (GoSell + Hopeful)</span>
              <span className="text-[18px] font-bold text-[#3D9B3A]">฿{total.toLocaleString()}</span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Section: สถานะ */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-3">สถานะ</h2>
        <div className="grid grid-cols-3 gap-2">
          {NOTE_STATUSES.map((s) => {
            const selected = form.note === s.note;
            return (
              <button
                key={s.note}
                type="button"
                onClick={() => set("note", selected ? "" : s.note)}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition-all"
                style={{ borderColor: selected ? s.color : "#E8E8E8", backgroundColor: selected ? `${s.color}18` : "#F7F7F7" }}
              >
                <span className="text-[18px] leading-none">{s.icon}</span>
                <span className="text-[12px] font-semibold leading-tight" style={{ color: selected ? s.color : "#3D3D3D" }}>{s.label}</span>
                <span className="text-[10px] leading-tight" style={{ color: selected ? s.color : "#8B8E8F" }}>{s.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section: หมายเหตุ */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-3">หมายเหตุ</h2>
        <textarea
          value={form.remark}
          onChange={(e) => set("remark", e.target.value)}
          placeholder="บันทึกเพิ่มเติม เช่น ความต้องการพิเศษ, นัดหมาย, ฯลฯ"
          rows={3}
          className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === "loading" || status === "success" || !form.name.trim()}
          className="flex items-center gap-2 bg-[#87DE81] text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === "loading" ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/></svg>กำลังบันทึก...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>บันทึกลงระบบ</>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setForm({ date: todayISO(), name: "", phone: "", address: "", product: "", quantity: "1", phoneClose: "", crm: "", upsell: "", hopefulPhoneClose: "", hopefulCrm: "", hopefulUpsell: "", note: "", remark: "" }); setHistory([]); setHasToday(false); setShowDupConfirm(false); }}
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
  return (
    <div>
      <div className={`text-[10px] font-medium mb-1 uppercase tracking-wide ${isGreen ? "text-[#3D9B3A]/70" : "text-[#0E8FA8]/70"}`}>{label}</div>
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold ${isGreen ? "text-[#87DE81]" : "text-[#022EE8]"}`}>฿</span>
        <input
          type="number" min="0" max={MAX_SALE_AMOUNT} value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { onChange(""); return; }
            const n = Number(raw);
            onChange(n > MAX_SALE_AMOUNT ? String(MAX_SALE_AMOUNT) : raw);
          }}
          placeholder="0"
          className={`w-full bg-white/70 border ${isGreen ? "border-[#87DE81]/30" : "border-[#022EE8]/30"} rounded-lg pl-7 pr-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none ${isGreen ? "focus:border-[#87DE81]" : "focus:border-[#022EE8]"} focus:bg-white transition-colors`}
        />
      </div>
    </div>
  );
}

const inputCls = "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-[#FF6B6B] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
