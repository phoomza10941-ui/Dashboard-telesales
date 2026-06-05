"use client";
import { useState } from "react";

interface ProfileFormProps {
  fullName: string;
  nickname: string;
  agentCode: string;
  team: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
}

export default function ProfileForm({
  fullName, nickname, agentCode, team,
  orekaExtGosell: initGosell,
  orekaExtHopeful: initHopeful,
}: ProfileFormProps) {
  const [gosell, setGosell] = useState(initGosell);
  const [hopeful, setHopeful] = useState(initHopeful);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orekaExtGosell: gosell, orekaExtHopeful: hopeful }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "เกิดข้อผิดพลาด");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors";
  const readonlyClass =
    "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#8B8E8F] cursor-not-allowed";

  return (
    <div className="max-w-lg space-y-6">
      {/* Info section */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-[#3D3D3D]">ข้อมูลส่วนตัว</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">ชื่อ-นามสกุล</label>
            <input value={fullName} readOnly className={readonlyClass} />
          </div>
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">Nickname</label>
            <input value={nickname} readOnly className={readonlyClass} />
          </div>
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">รหัสเอเจนต์</label>
            <input value={agentCode} readOnly className={readonlyClass} />
          </div>
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">ทีม</label>
            <input value={team} readOnly className={readonlyClass} />
          </div>
        </div>
        <p className="text-[11px] text-[#8B8E8F]">
          ข้อมูลส่วนนี้แก้ไขได้โดย Supervisor เท่านั้น
        </p>
      </div>

      {/* Oreka section */}
      <div className="bg-white rounded-xl border border-[#E8E8E8] p-5 space-y-4">
        <div>
          <h2 className="text-[13px] font-semibold text-[#3D3D3D]">เบอร์ Oreka (Talk Time)</h2>
          <p className="text-[11px] text-[#8B8E8F] mt-0.5">
            เบอร์ Local Party ของ dtac OneCall ที่ระบบใช้จับคู่เวลาโทร (รูปแบบ 08x หรือ +668x)
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">GoSell</label>
            <input
              value={gosell}
              onChange={(e) => setGosell(e.target.value)}
              placeholder="เช่น 0812345678 หรือ +66812345678"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] text-[#8B8E8F] mb-1.5">Hopeful</label>
            <input
              value={hopeful}
              onChange={(e) => setHopeful(e.target.value)}
              placeholder="เช่น 0812345678 หรือ +66812345678"
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="text-[12px] text-red-500">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#87DE81] hover:bg-[#6fcf69] text-white text-[13px] font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          {saved && (
            <span className="text-[12px] text-[#87DE81] font-medium">บันทึกสำเร็จ</span>
          )}
        </div>
      </div>
    </div>
  );
}
