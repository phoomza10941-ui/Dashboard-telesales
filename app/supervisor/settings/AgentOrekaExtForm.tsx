"use client";

import { useTransition, useState } from "react";
import { bulkUpdateAgentOrekaExt } from "@/app/actions/config";

interface Agent {
  agentId: string;
  agentName: string;
  orekaExt: string;
  orekaExtHopeful: string;
}

export default function AgentOrekaExtForm({ agents }: { agents: Agent[] }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  const filledGosell = agents.filter((a) => a.orekaExt).length;
  const filledHopeful = agents.filter((a) => a.orekaExtHopeful).length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      try {
        await bulkUpdateAgentOrekaExt(fd);
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("err");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="agentIds" value={agents.map((a) => a.agentId).join(",")} />

      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-3 px-4 py-2">
        <div className="w-7" />
        <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Gosell</span>
        <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Hopeful</span>
      </div>

      <div className="divide-y divide-[#F7F7F7] rounded-xl border border-[#E8E8E8] overflow-hidden">
        {agents.map((a) => (
          <div key={a.agentId} className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 px-4 py-2.5 bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold shrink-0">
                {a.agentName.charAt(0)}
              </div>
              <span className="text-[12px] font-medium text-[#3D3D3D] w-20 shrink-0 truncate">{a.agentName}</span>
            </div>
            <input
              name={`oreka_${a.agentId}`}
              type="tel"
              defaultValue={a.orekaExt}
              placeholder="+66… (Gosell)"
              className="w-full bg-[#FFF8EC] border border-amber-200 rounded-lg px-3 py-2 text-[12px] font-mono text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
            />
            <input
              name={`oreka_hopeful_${a.agentId}`}
              type="tel"
              defaultValue={a.orekaExtHopeful}
              placeholder="+66… (Hopeful)"
              className="w-full bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-[12px] font-mono text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-purple-400 focus:bg-white transition-colors"
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#8B8E8F]">
        ใส่เบอร์ตามคอลัมน์ <span className="font-medium text-[#3D3D3D]">Local Party</span> ของ Oreka ·
        พิมพ์ <span className="font-mono">081…</span> หรือ <span className="font-mono">66…</span> ก็ได้ ระบบแปลงเป็น <span className="font-mono">+66…</span> ให้
      </p>

      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 bg-[#58CEE8] text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-[#3DB8D4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? (
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
              <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
            บันทึกเบอร์ (Gosell {filledGosell}/{agents.length} · Hopeful {filledHopeful}/{agents.length})
          </>
        )}
      </button>

      {status === "ok" && <p className="text-[12px] text-[#3D9B3A] font-medium text-center">บันทึกสำเร็จ</p>}
      {status === "err" && <p className="text-[12px] text-red-500 font-medium text-center">เกิดข้อผิดพลาด — กรุณาลองใหม่</p>}
    </form>
  );
}
