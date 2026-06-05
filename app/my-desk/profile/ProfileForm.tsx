"use client";

interface ProfileFormProps {
  fullName: string;
  nickname: string;
  agentCode: string;
  team: string;
}

export default function ProfileForm({ fullName, nickname, agentCode, team }: ProfileFormProps) {
  const readonlyClass =
    "w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#8B8E8F] cursor-not-allowed";

  return (
    <div className="max-w-lg">
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
        <p className="text-[11px] text-[#8B8E8F]">ข้อมูลส่วนนี้แก้ไขได้โดย Supervisor เท่านั้น</p>
      </div>
    </div>
  );
}
