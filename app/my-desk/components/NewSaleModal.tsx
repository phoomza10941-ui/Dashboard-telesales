"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerGroup } from "@/app/my-desk/components/customer-cards/types";

const NOTE_STATUSES = [
  { note: "โอนแล้ว",        label: "โอนแล้ว",  sub: "Closed",    icon: "✅", color: "#3D9B3A" },
  { note: "รอโอน",          label: "รอโอน",    sub: "Pending",   icon: "⏳", color: "#C48A00" },
  { note: "ติดตาม",         label: "ติดตาม",   sub: "Follow-up", icon: "📞", color: "#0E8FA8" },
  { note: "นัดโทรพรุ่งนี้", label: "นัดโทร",   sub: "Scheduled", icon: "📅", color: "#7B5EA7" },
  { note: "หลุด",           label: "หลุด",     sub: "Lost",      icon: "❌", color: "#CC3333" },
  { note: "ของแถม",         label: "ของแถม",   sub: "Free Gift", icon: "🎁", color: "#E07C30" },
] as const;

const MAX = 1_000_000;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function isoToDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const inputCls =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

function SaleInput({
  label, value, onChange, color,
}: {
  label: string; value: string; onChange: (v: string) => void; color: "green" | "cyan";
}) {
  const g = color === "green";
  return (
    <div>
      <div className={`text-[10px] font-medium mb-1 uppercase tracking-wide ${g ? "text-[#3D9B3A]/70" : "text-[#0E8FA8]/70"}`}>
        {label}
      </div>
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold ${g ? "text-[#87DE81]" : "text-[#022EE8]"}`}>฿</span>
        <input
          type="number" min="0" max={MAX} value={value} placeholder="0"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") { onChange(""); return; }
            onChange(Number(raw) > MAX ? String(MAX) : raw);
          }}
          className={`w-full bg-white/70 border ${g ? "border-[#87DE81]/30" : "border-[#022EE8]/30"} rounded-lg pl-7 pr-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none ${g ? "focus:border-[#87DE81]" : "focus:border-[#022EE8]"} focus:bg-white transition-colors`}
        />
      </div>
    </div>
  );
}

interface Props {
  group: CustomerGroup;
  agentName: string;
  products: string[];
  onClose: () => void;
}

export default function NewSaleModal({ group, agentName, products, onClose }: Props) {
  const router = useRouter();
  const [st, setSt] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const [form, setForm] = useState({
    date: todayISO(),
    name: group.name,
    phone: group.phone,
    address: group.address,
    product: "",
    quantity: "1",
    phoneClose: "", crm: "", upsell: "",
    hopefulPhoneClose: "", hopefulCrm: "", hopefulUpsell: "",
    note: "",
    remark: "",
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const gsTotal = (parseFloat(form.phoneClose) || 0) + (parseFloat(form.crm) || 0) + (parseFloat(form.upsell) || 0);
  const hpTotal =
    (parseFloat(form.hopefulPhoneClose) || 0) +
    (parseFloat(form.hopefulCrm) || 0) +
    (parseFloat(form.hopefulUpsell) || 0);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSt("saving");
    setErrMsg("");
    try {
      const res = await fetch("/api/sheets/add-row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName,
          date: isoToDMY(form.date),
          name: form.name,
          phone: form.phone,
          address: form.address,
          product: form.product,
          quantity: parseInt(form.quantity) || 1,
          phoneClose: form.phoneClose,
          crm: form.crm,
          upsell: form.upsell,
          hopefulPhoneClose: form.hopefulPhoneClose,
          hopefulCrm: form.hopefulCrm,
          hopefulUpsell: form.hopefulUpsell,
          note: form.note,
          remark: form.remark,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "เกิดข้อผิดพลาด");
      }
      setSt("success");
      setTimeout(() => { router.refresh(); onClose(); }, 800);
    } catch (err: unknown) {
      setSt("error");
      setErrMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  const busy = st === "saving";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8E8E8] shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#87DE81]/15 flex items-center justify-center text-[#3D9B3A] text-[13px] font-bold">
            {group.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[#3D3D3D] truncate">{group.name}</div>
            <div className="text-[11px] text-[#8B8E8F]">บันทึกการขายใหม่</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F7F7F7] text-[#8B8E8F] shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {st === "success" && (
            <div className="flex items-center gap-2 bg-[#87DE81]/15 border border-[#87DE81]/40 rounded-xl px-4 py-2.5">
              <span>✅</span>
              <span className="text-[13px] font-semibold text-[#3D9B3A]">บันทึกสำเร็จ!</span>
            </div>
          )}
          {st === "error" && (
            <div className="flex items-center gap-2 bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 rounded-xl px-4 py-2.5">
              <span>⚠️</span>
              <span className="text-[13px] text-[#FF6B6B]">{errMsg}</span>
            </div>
          )}

          {/* Customer info */}
          <div className="bg-[#F7F7F7] rounded-xl p-4">
            <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">ข้อมูลลูกค้า</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1">วันที่</label>
                <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1">
                  ชื่อ - สกุล <span className="text-[#FF6B6B]">*</span>
                </label>
                <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1">เบอร์โทร</label>
                <input type="text" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1">สินค้า</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text" list="ns-product-list" value={form.product}
                      onChange={(e) => set("product", e.target.value)}
                      placeholder="พิมพ์หรือเลือก" className={inputCls}
                    />
                    <datalist id="ns-product-list">
                      {products.map((p) => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="w-20 shrink-0">
                    <input
                      type="number" min="1" max="999" value={form.quantity}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { set("quantity", ""); return; }
                        set("quantity", String(Math.max(1, Math.min(999, parseInt(v) || 1))));
                      }}
                      className={inputCls + " text-center"}
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1">ที่อยู่</label>
                <input type="text" value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-[#87DE81]/40 bg-[#87DE81]/5 p-3">
              <div className="text-[11px] font-bold text-[#3D9B3A] mb-3">GoSell</div>
              <div className="space-y-2">
                <SaleInput label="ปิดจากเบอร์" value={form.phoneClose} onChange={(v) => set("phoneClose", v)} color="green" />
                <SaleInput label="CRM" value={form.crm} onChange={(v) => set("crm", v)} color="green" />
                <SaleInput label="Upsell" value={form.upsell} onChange={(v) => set("upsell", v)} color="green" />
              </div>
              {gsTotal > 0 && (
                <div className="mt-2 bg-[#87DE81]/15 rounded-lg px-3 py-1.5 flex justify-between">
                  <span className="text-[10px] text-[#3D9B3A]">รวม</span>
                  <span className="text-[12px] font-bold text-[#3D9B3A]">฿{gsTotal.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl border-2 border-[#022EE8]/40 bg-[#022EE8]/5 p-3">
              <div className="text-[11px] font-bold text-[#0E8FA8] mb-3">Hopeful</div>
              <div className="space-y-2">
                <SaleInput label="ปิดจากเบอร์" value={form.hopefulPhoneClose} onChange={(v) => set("hopefulPhoneClose", v)} color="cyan" />
                <SaleInput label="CRM" value={form.hopefulCrm} onChange={(v) => set("hopefulCrm", v)} color="cyan" />
                <SaleInput label="Upsell" value={form.hopefulUpsell} onChange={(v) => set("hopefulUpsell", v)} color="cyan" />
              </div>
              {hpTotal > 0 && (
                <div className="mt-2 bg-[#022EE8]/15 rounded-lg px-3 py-1.5 flex justify-between">
                  <span className="text-[10px] text-[#0E8FA8]">รวม</span>
                  <span className="text-[12px] font-bold text-[#0E8FA8]">฿{hpTotal.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-2">สถานะ</div>
            <div className="grid grid-cols-3 gap-2">
              {NOTE_STATUSES.map((s) => {
                const sel = form.note === s.note;
                return (
                  <button
                    key={s.note} type="button"
                    onClick={() => set("note", sel ? "" : s.note)}
                    className="flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 transition-all"
                    style={{ borderColor: sel ? s.color : "#E8E8E8", backgroundColor: sel ? `${s.color}18` : "#F7F7F7" }}
                  >
                    <span className="text-[16px] leading-none">{s.icon}</span>
                    <span className="text-[11px] font-semibold leading-tight" style={{ color: sel ? s.color : "#3D3D3D" }}>{s.label}</span>
                    <span className="text-[9px] leading-tight" style={{ color: sel ? s.color : "#8B8E8F" }}>{s.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remark */}
          <div>
            <label className="block text-[11px] font-medium text-[#8B8E8F] mb-1.5">หมายเหตุ</label>
            <textarea
              value={form.remark}
              onChange={(e) => set("remark", e.target.value)}
              rows={2}
              placeholder="บันทึกเพิ่มเติม..."
              className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E8E8E8] shrink-0 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={busy || !form.name.trim() || st === "success"}
            className="flex items-center gap-1.5 bg-[#87DE81] text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeDashoffset="10"/>
                </svg>
                บันทึก...
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
                บันทึกการขาย
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-[13px] text-[#8B8E8F] px-4 py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
