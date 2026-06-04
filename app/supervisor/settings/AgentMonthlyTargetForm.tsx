"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { bulkUpdateAgentMonthlyTargets } from "@/app/actions/config";

interface AgentRow {
  agentId: string;
  agentName: string;
  monthlyTarget: number | null;
}

const PRESETS = [500000, 800000, 1000000, 1500000, 2000000];

const MONTH_LABELS: Record<string, string> = {
  "01": "ม.ค.", "02": "ก.พ.", "03": "มี.ค.", "04": "เม.ย.",
  "05": "พ.ค.", "06": "มิ.ย.", "07": "ก.ค.", "08": "ส.ค.",
  "09": "ก.ย.", "10": "ต.ค.", "11": "พ.ย.", "12": "ธ.ค.",
};

function formatMonthKey(key: string) {
  const [year, month] = key.split("-");
  return `${MONTH_LABELS[month] ?? month} ${year}`;
}

function buildMonthOptions(currentKey: string): string[] {
  const [y, m] = currentKey.split("-").map(Number);
  const options: string[] = [];
  for (let i = -3; i <= 5; i++) {
    let mo = m + i;
    let yr = y;
    while (mo < 1) { mo += 12; yr--; }
    while (mo > 12) { mo -= 12; yr++; }
    options.push(`${yr}-${String(mo).padStart(2, "0")}`);
  }
  return options;
}

export default function AgentMonthlyTargetForm({
  agents,
  monthKey,
  currentMonthKey,
}: {
  agents: AgentRow[];
  monthKey: string;
  currentMonthKey: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthOptions = buildMonthOptions(currentMonthKey);

  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [bulkValue, setBulkValue] = useState("");

  // inputs keyed by agentId
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(agents.map((a) => [a.agentId, a.monthlyTarget ? String(a.monthlyTarget) : ""]))
  );

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", e.target.value);
    router.push(`?${params.toString()}`);
  }

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
        await bulkUpdateAgentMonthlyTargets(fd);
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 2500);
      } catch {
        setStatus("err");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div>
        <label className="block text-[11px] text-[#8B8E8F] mb-1.5">เลือกเดือน</label>
        <select
          value={monthKey}
          onChange={handleMonthChange}
          className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] focus:outline-none focus:border-[#022EE8] focus:bg-white transition-colors"
        >
          {monthOptions.map((key) => (
            <option key={key} value={key}>
              {formatMonthKey(key)}{key === currentMonthKey ? " (เดือนนี้)" : ""}
            </option>
          ))}
        </select>
      </div>

      {agents.length === 0 ? (
        <p className="text-[12px] text-[#8B8E8F]">ยังไม่มี agent ในระบบ</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input type="hidden" name="monthKey" value={monthKey} />
          <input type="hidden" name="agentIds" value={agents.map((a) => a.agentId).join(",")} />

          {/* Bulk fill row */}
          <div className="bg-[#F7F7F7] rounded-xl border border-[#E8E8E8] px-4 py-3 mb-3">
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
                placeholder="หรือพิมพ์เอง เช่น 1200000"
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
          <div className="divide-y divide-[#F7F7F7] rounded-xl border border-[#E8E8E8] overflow-hidden mb-4">
            {agents.map((a) => (
              <div key={a.agentId} className="flex items-center gap-3 px-4 py-2.5 bg-white">
                <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold shrink-0">
                  {a.agentName.charAt(0)}
                </div>
                <span className="text-[13px] font-medium text-[#3D3D3D] w-28 shrink-0">{a.agentName}</span>
                {a.monthlyTarget && (
                  <span className="text-[11px] text-[#C0C0C0] shrink-0">เดิม ฿{a.monthlyTarget.toLocaleString()}</span>
                )}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#022EE8]">฿</span>
                  <input
                    name={`target_${a.agentId}`}
                    type="number"
                    min="1"
                    value={inputs[a.agentId] ?? ""}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [a.agentId]: e.target.value }))}
                    placeholder="เป้าเดือนนี้"
                    className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-7 pr-3 py-2 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#022EE8] focus:bg-white transition-colors"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Bulk save button */}
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

          {status === "ok" && (
            <p className="text-[12px] text-[#3D9B3A] font-medium text-center mt-2">บันทึกสำเร็จทุกคน</p>
          )}
          {status === "err" && (
            <p className="text-[12px] text-red-500 font-medium text-center mt-2">เกิดข้อผิดพลาด — กรุณาลองใหม่</p>
          )}
        </form>
      )}
    </div>
  );
}
