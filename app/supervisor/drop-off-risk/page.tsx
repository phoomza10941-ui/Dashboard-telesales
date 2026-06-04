import { getAllAgentsAnalysis, SaleRow } from "@/lib/db";

interface RiskCase {
  customer: string;
  agent: string;
  issue: string;
  value: number;
  risk: "high" | "medium" | "low";
}

function classifyRisk(row: SaleRow, agentName: string): RiskCase | null {
  const n = row.note.toLowerCase();
  const value = row.phoneClose + row.upsell + row.crm;

  const isPendingLong  = n.includes("รอโอน") || n.includes("รอสลิป");
  const isSilent       = n.includes("อ่านไม่ตอบ") || n.includes("ไม่ตอบ") || n.includes("เงียบ");
  const isThinking     = n.includes("คิดก่อน") || n.includes("คิดดู");
  const isAskingFamily = n.includes("ถามญาติ") || n.includes("บอกสามี") || n.includes("บอกภรรยา");
  const isLost         = n.includes("ไม่สนใจ") || n.includes("หลุด");

  if (isLost) return null; // already lost, not "at risk"

  if (!isPendingLong && !isSilent && !isThinking && !isAskingFamily) return null;

  const risk: "high" | "medium" | "low" =
    isPendingLong ? "high" :
    isSilent      ? "high" :
    isThinking    ? "medium" :
    "low";

  const issue =
    isPendingLong  ? "รอโอน — ยังไม่ปิด" :
    isSilent       ? "อ่านไม่ตอบหลังสนใจ" :
    isThinkingDup(n) ? "ขอคิดก่อน ยังไม่ตาม" :
    "ขอถามญาติ ยังไม่ตาม";

  return {
    customer: row.name || "ไม่ระบุชื่อ",
    agent: agentName,
    issue,
    value,
    risk,
  };
}

function isThinkingDup(n: string) {
  return n.includes("คิดก่อน") || n.includes("คิดดู");
}

export default async function DropOffRiskPage() {
  const agents = await getAllAgentsAnalysis();

  const risks: RiskCase[] = [];
  agents.forEach((a) => {
    a.allRows.forEach((row) => {
      const r = classifyRisk(row, a.agentName);
      if (r) risks.push(r);
    });
  });

  risks.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.risk] - order[b.risk] || b.value - a.value;
  });

  const high   = risks.filter((r) => r.risk === "high");
  const medium = risks.filter((r) => r.risk === "medium");
  const low    = risks.filter((r) => r.risk === "low");

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Drop-off Risk Alert</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">เคสที่กำลังจะหลุด — คัดจาก note field จริง</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card label="ความเสี่ยงสูง" count={high.length} color="red" />
        <Card label="ความเสี่ยงกลาง" count={medium.length} color="amber" />
        <Card label="ความเสี่ยงต่ำ" count={low.length} color="blue" />
      </div>

      <div className="flex-1 space-y-4 overflow-auto pb-1">
        {risks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E8E8] flex items-center justify-center h-40">
            <p className="text-[13px] text-[#8B8E8F]">ไม่พบเคสเสี่ยง</p>
          </div>
        ) : (
          [{ title: "ความเสี่ยงสูง", cases: high, variant: "high" as const },
           { title: "ความเสี่ยงกลาง", cases: medium, variant: "medium" as const },
           { title: "ความเสี่ยงต่ำ", cases: low, variant: "low" as const }]
            .filter((g) => g.cases.length > 0)
            .map((g) => {
              const borderColor = g.variant === "high" ? "border-l-red-400" : g.variant === "medium" ? "border-l-amber-400" : "border-l-blue-300";
              const headerColor = g.variant === "high" ? "text-red-500" : g.variant === "medium" ? "text-amber-600" : "text-blue-500";
              return (
                <div key={g.title} className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E8E8E8]">
                    <span className={`text-[12px] font-semibold ${headerColor}`}>{g.title} ({g.cases.length})</span>
                  </div>
                  <div className="divide-y divide-[#F7F7F7]">
                    {g.cases.map((c, i) => (
                      <div key={i} className={`flex items-center gap-4 px-5 py-4 border-l-2 ${borderColor}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-[#3D3D3D]">{c.customer}</div>
                          <p className="text-[12px] text-[#8B8E8F] mt-0.5">{c.issue}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[12px] font-medium text-[#3D3D3D]">{c.agent}</div>
                          {c.value > 0 && <div className="text-[11px] text-[#3D9B3A]">฿{c.value.toLocaleString()}</div>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button className="text-[11px] text-[#022EE8] border border-[#022EE8]/40 hover:bg-[#022EE8]/10 px-3 py-1.5 rounded-lg transition-colors">แจ้ง Agent</button>
                          <button className="text-[11px] text-white bg-[#3D3D3D] hover:bg-[#555] px-3 py-1.5 rounded-lg transition-colors">เข้าช่วย</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

function Card({ label, count, color }: { label: string; count: number; color: "red" | "amber" | "blue" }) {
  const s = {
    red:   { bg: "bg-red-50 border-red-200",    num: "text-red-500",   sub: "text-red-400" },
    amber: { bg: "bg-amber-50 border-amber-200", num: "text-amber-600", sub: "text-amber-500" },
    blue:  { bg: "bg-blue-50 border-blue-200",   num: "text-blue-500",  sub: "text-blue-400" },
  }[color];
  return (
    <div className={`border rounded-xl px-4 py-3.5 ${s.bg}`}>
      <div className={`text-[10px] font-medium mb-1 ${s.sub}`}>{label.toUpperCase()}</div>
      <div className={`text-[22px] font-bold ${s.num}`}>{count}</div>
    </div>
  );
}
