"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const FIELDS: { key: string; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "phone", label: "เบอร์โทร", placeholder: "0812345678" },
  { key: "first_name", label: "ชื่อ", placeholder: "สมหญิง" },
  { key: "last_name", label: "นามสกุล", placeholder: "วงศ์ใหญ่" },
  { key: "nickname", label: "ชื่อเล่น", placeholder: "หน่อย" },
  { key: "patient_type", label: "คนที่ทาน", placeholder: "ตัวเอง / คนในครอบครัว" },
  { key: "diseases", label: "โรคเป็นอยู่", placeholder: "เบาหวาน, ความดัน", wide: true },
  { key: "symptoms", label: "อาการตอนนี้", placeholder: "อ่อนเพลีย, ปวดหัว", wide: true },
  { key: "medications", label: "ยาที่กำลังทานอยู่", placeholder: "เมทฟอร์มิน, แอมโลดิปีน", wide: true },
  { key: "consulted_doc", label: "ปรึกษาหมอมั้ย", placeholder: "ใช่ — ทุก 3 เดือน", wide: true },
  { key: "notes", label: "หมายเหตุ", placeholder: "ข้อมูลเพิ่มเติม", wide: true },
];

export default function AddCustomerPanel({ agentId }: { agentId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setForm({});
    setError("");
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  async function handleSave() {
    if (!form.phone && !form.first_name) {
      setError("กรุณากรอกอย่างน้อยเบอร์โทรหรือชื่อ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customer/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, ...form }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "บันทึกไม่สำเร็จ");
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-[#87DE81] hover:bg-[#76cc70] text-[#3D3D3D] text-[13px] font-medium px-4 py-2 rounded-xl transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        เพิ่มลูกค้า
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-[#E8E8E8] shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
              <div className="text-[13px] font-semibold text-[#3D3D3D]">👤 เพิ่มลูกค้าใหม่</div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-full hover:bg-[#F7F7F7] flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map(({ key, label, placeholder, wide }) => (
                  <div key={key} className={wide ? "col-span-2" : ""}>
                    <label className="block text-[11px] text-[#8B8E8F] mb-1">{label}</label>
                    <input
                      type="text"
                      value={form[key] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
                    />
                  </div>
                ))}
              </div>
              {error && <p className="mt-3 text-[11px] text-red-500">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#E8E8E8] flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 text-[13px] text-[#8B8E8F] border border-[#E8E8E8] rounded-xl hover:bg-[#F7F7F7] transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-40 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
              >
                {saving ? "กำลังบันทึก..." : "✓ บันทึกลูกค้า"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
