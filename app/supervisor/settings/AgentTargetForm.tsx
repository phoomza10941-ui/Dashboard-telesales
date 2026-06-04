"use client";

import { useTransition, useState } from "react";
import { bulkUpdateAgentTargets } from "@/app/actions/config";

interface Agent {
  agentId: string;
  agentName: string;
  target: number;
  hasCustomTarget: boolean;
}

const PRESETS = [50000, 80000, 100000, 150000, 200000];

export default function AgentTargetForm({ agents }: { agents: Agent[] }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [bulkValue, setBulkValue] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>(
    () => Object.fromEntries(agents.map((a) => [a.agentId, a.hasCustomTarget ? String(a.target) : ""]))
  );

  function applyBulk() {
    if (!bulkValue) return;
    setInputs(Object.fromEntries(agents.map((a) => [a.agentId, bulkValue])));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      try {
        await bulkUpdateAgentTargets(fd);
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

      {/* Bulk fill row */}
      <div className="bg-[#F7F7F7] rounded-xl border border-[#E8E8E8] px-4 py-3">
        <div className="text-[11px] font-semibold text-[#8B8E8F] mb-2">ใส่ทุกคนเท่ากัน</div>
        <div className="flex gap-2 flex-wrap mb-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setBulkValue(String(p)); setInputs(Object.fromEntries(agents.map((a) => [a.agentId, String(p)]))); }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                bulkValue === String(p)
                  ? "bg-[#022EE8] text-white border-[#022EE8]"
                  : "bg-white text-[#3D3D3D] border-[#E8E8E8] hover:border-[#022EE8]"
              }`}
            >
              ฿{p >= 1_000_000 ? `${p / 1_000_000}M` : `${p / 1000}k`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="หรือพิมพ์เอง เช่น 120000"
            className="flex-1 bg-white border border-[#E8E8E8] rounded-lg px-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8] transition-colors"
          />
          <button
            type="button"
            onClick={applyBulk}
            disabled={!bulkValue}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#022EE8]/15 text-[#0E8FA8] hover:bg-[#022EE8]/30 disabled:opacity-40 transition-colors shrink-0"
          >
            ใส่ทุกคน
          </button>
        </div>
      </div>

      {/* Per-agent inputs */}
      <div className="divide-y divide-[#F7F7F7] rounded-xl border border-[#E8E8E8] overflow-hidden">
        {agents.map((a) => (
          <div key={a.agentId} className="flex items-center gap-3 px-4 py-2.5 bg-white">
            <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold shrink-0">
              {a.agentName.charAt(0)}
            </div>
            <span className="text-[13px] font-medium text-[#3D3D3D] w-28 shrink-0">{a.agentName}</span>
            <span className="text-[11px] text-[#C0C0C0] shrink-0">
              เดิม ฿{a.target.toLocaleString()}{!a.hasCustomTarget ? " (ทีม)" : ""}
            </span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#022EE8]">฿</span>
              <input
                name={`target_${a.agentId}`}
                type="number"
                min="1"
                value={inputs[a.agentId] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [a.agentId]: e.target.value }))}
                placeholder="เป้าใหม่"
                className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-7 pr-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8] focus:bg-white transition-colors"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bulk save */}
      <button
        type="submit"
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 bg-[#87DE81] text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-[#6BC965] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            บันทึกทั้งหมด ({agents.length} คน)
          </>
        )}
      </button>

      {status === "ok" && <p className="text-[12px] text-[#3D9B3A] font-medium text-center">บันทึกสำเร็จทุกคน</p>}
      {status === "err" && <p className="text-[12px] text-red-500 font-medium text-center">เกิดข้อผิดพลาด — กรุณาลองใหม่</p>}
    </form>
  );
}
