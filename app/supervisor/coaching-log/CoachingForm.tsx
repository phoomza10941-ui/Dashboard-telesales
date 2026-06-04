"use client";

import { useRef, useState, useTransition } from "react";
import { createCoachingSession } from "@/app/actions/coaching";

export default function CoachingForm({ agents }: { agents: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createCoachingSession(fd);
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="text-[12px] font-semibold text-[#3D3D3D] mb-4">บันทึกการโค้ชใหม่</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] text-[#8B8E8F] mb-1 block">Agent</label>
          <select
            name="agentName"
            required
            className="w-full text-[12px] bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[#3D3D3D] focus:outline-none focus:border-[#022EE8]"
          >
            <option value="">เลือก Agent</option>
            {agents.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-[#8B8E8F] mb-1 block">นัดติดตาม</label>
          <input
            name="followUpDate"
            type="text"
            placeholder="เช่น 02/06"
            className="w-full text-[12px] bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] text-[#8B8E8F] mb-1 block">หัวข้อโค้ช</label>
          <input
            name="topic"
            required
            type="text"
            placeholder="เช่น ปิดการขาย"
            className="w-full text-[12px] bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8]"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#8B8E8F] mb-1 block">Action หลังโค้ช</label>
          <input
            name="actionItem"
            type="text"
            placeholder="เช่น Role-play 3 รอบ"
            className="w-full text-[12px] bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2 text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8]"
          />
        </div>
      </div>
      {error && (
        <p className="text-[11px] text-red-500 mb-3">{error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="text-[12px] font-semibold bg-[#022EE8] text-white px-5 py-2 rounded-lg hover:bg-[#4BB8D4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึก"}
      </button>
    </form>
  );
}
