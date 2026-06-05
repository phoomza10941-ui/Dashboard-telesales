"use client";
import { useState } from "react";

const inputCls =
  "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";

export default function ChangePasswordForm({ username }: { username: string }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (pw.length < 6) { setStatus({ ok: false, msg: "Password ต้องมีอย่างน้อย 6 ตัวอักษร" }); return; }
    if (pw !== confirm) { setStatus({ ok: false, msg: "Password ไม่ตรงกัน" }); return; }
    setSaving(true);
    const res = await fetch("/api/profile/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ ok: true, msg: "เปลี่ยน Password สำเร็จ" });
      setPw(""); setConfirm("");
    } else {
      const d = await res.json();
      setStatus({ ok: false, msg: d.error ?? "เกิดข้อผิดพลาด" });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold text-[#3D3D3D]">ความปลอดภัย</h2>
        <p className="text-[11px] text-[#8B8E8F] mt-0.5">เปลี่ยน Password สำหรับบัญชีของคุณ</p>
      </div>

      <div>
        <label className="block text-[11px] text-[#8B8E8F] mb-1.5">Username (ใช้ Login)</label>
        <div className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 flex items-center gap-2">
          <span className="text-[13px] font-mono text-[#58CEE8] font-medium">{username}</span>
          <span className="text-[11px] text-[#C0C0C0]">· แก้ไขไม่ได้</span>
        </div>
      </div>

      {status && (
        <p className={`text-[12px] rounded-lg px-3 py-2 ${status.ok ? "bg-[#87DE81]/15 text-[#3D9B3A]" : "bg-red-50 text-red-600"}`}>
          {status.msg}
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-[11px] text-[#8B8E8F] mb-1.5">Password ใหม่</label>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="อย่างน้อย 6 ตัวอักษร"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-[11px] text-[#8B8E8F] mb-1.5">ยืนยัน Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="พิมพ์ซ้ำอีกครั้ง"
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !pw || !confirm}
          className="px-4 py-2 bg-[#87DE81] hover:bg-[#6fcf69] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          {saving ? "กำลังบันทึก…" : "เปลี่ยน Password"}
        </button>
      </form>
    </div>
  );
}
