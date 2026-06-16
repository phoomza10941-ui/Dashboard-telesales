import { getAllAgentsAnalysis, SaleRow, saleTotal } from "@/lib/db";

interface HotCase {
  customer: string;
  agent: string;
  reason: string;
  value: number;
  urgency: "critical" | "high" | "medium";
  product: string;
  note: string;
}

function classifyHotCase(row: SaleRow, agentName: string): HotCase | null {
  const n = row.note.toLowerCase();
  const value = saleTotal(row);
  if (value === 0) return null;

  const isPending = n.includes("รอโอน") || n.includes("รอสลิป") || n.includes("รอชำระ");
  const isHighValue = value >= 8000;
  const isBulk = n.includes("หลายกล่อง") || n.includes("5 กล่อง") || n.includes("4 กล่อง") || n.includes("ซื้อฝาก");
  const isReturning = n.includes("ลูกค้าเก่า") || n.includes("ซื้อซ้ำ") || n.includes("กลับมา");
  const isInterested = n.includes("สนใจ") || n.includes("ถามราคา") || n.includes("อยากได้");

  if (!isPending && !isHighValue && !isBulk && !isReturning && !isInterested) return null;

  const urgency: "critical" | "high" | "medium" =
    isPending && isHighValue ? "critical" :
      isPending || isHighValue || isBulk ? "high" :
        "medium";

  const reason =
    isPending ? "รอโอน — ต้องเร่งปิด" :
      isBulk ? "ถามซื้อหลายกล่อง" :
        isReturning ? "ลูกค้าเก่ากลับมา" :
          isInterested ? "สนใจ / ถามราคา" :
            "มูลค่าสูง";

  return {
    customer: row.name || "ไม่ระบุชื่อ",
    agent: agentName,
    reason,
    value,
    urgency,
    product: row.product || "—",
    note: row.note,
  };
}

export default async function HotCasesPage() {
  const agents = await getAllAgentsAnalysis();

  const hotCases: HotCase[] = [];
  agents.forEach((a) => {
    a.allRows.forEach((row) => {
      const hc = classifyHotCase(row, a.agentName);
      if (hc) hotCases.push(hc);
    });
  });

  hotCases.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return order[a.urgency] - order[b.urgency] || b.value - a.value;
  });

  const critical = hotCases.filter((c) => c.urgency === "critical");
  const high = hotCases.filter((c) => c.urgency === "high");
  const medium = hotCases.filter((c) => c.urgency === "medium");

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">อันดับเคสร้อน</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">เคสที่ Supervisor ควรเข้าช่วยก่อน — คัดจาก note field จริง</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <SummaryCard label="Critical" count={critical.length} color="red" desc="เร่งด่วนมาก" />
        <SummaryCard label="Hot" count={high.length} color="amber" desc="ควรช่วยวันนี้" />
        <SummaryCard label="Warm" count={medium.length} color="blue" desc="ติดตามให้ครบ" />
      </div>

      {hotCases.length === 0 ? (
        <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] flex items-center justify-center">
          <p className="text-[13px] text-[#8B8E8F]">ยังไม่มีเคสร้อน — เคสจะปรากฏเมื่อ agents กรอกข้อมูลลูกค้า</p>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#E8E8E8]">
                  {["#", "ระดับ", "ลูกค้า", "สินค้า", "เหตุผล", "Agent", "มูลค่า", ""].map((h) => (
                    <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hotCases.map((c, i) => {
                  const style =
                    c.urgency === "critical"
                      ? { dot: "bg-red-700 animate-pulse", badge: "bg-red-100 text-red-600 border-red-200", label: "Critical", row: "bg-red-50/20" }
                      : c.urgency === "high"
                        ? { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "Hot", row: "" }
                        : { dot: "bg-blue-400", badge: "bg-blue-50 text-blue-600 border-blue-200", label: "Warm", row: "" };
                  return (
                    <tr key={i} className={`border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors ${style.row}`}>
                      <td className="py-3.5 px-4 text-[#8B8E8F] font-medium">{i + 1}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#3D3D3D]">{c.customer}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#8B8E8F] text-[12px]">{c.product}</td>
                      <td className="py-3.5 px-4 text-[#8B8E8F] text-[12px]">{c.reason}</td>
                      <td className="py-3.5 px-4 text-[#3D3D3D]">{c.agent}</td>
                      <td className="py-3.5 px-4 font-semibold text-[#3D9B3A]">฿{c.value.toLocaleString()}</td>
                      <td className="py-3.5 px-4">
                        <button className="text-[11px] font-medium text-[#022EE8] border border-[#022EE8]/40 hover:bg-[#022EE8]/10 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          เข้าช่วย
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between">
            <p className="text-[11px] text-[#8B8E8F]">
              มูลค่ารวม: <span className="font-semibold text-[#3D9B3A]">฿{hotCases.reduce((s, c) => s + c.value, 0).toLocaleString()}</span>
            </p>
            <p className="text-[10px] text-[#C0C0C0]">คัดจาก note field — เพิ่มคำ keyword ให้ครบเพื่อผลที่แม่นขึ้น</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, color, desc }: { label: string; count: number; color: "red" | "amber" | "blue"; desc: string }) {
  const s = {
    red: { bg: "bg-red-50 border-red-200", num: "text-red-500", sub: "text-red-400" },
    amber: { bg: "bg-amber-50 border-amber-200", num: "text-amber-600", sub: "text-amber-500" },
    blue: { bg: "bg-blue-50 border-blue-200", num: "text-blue-500", sub: "text-blue-400" },
  }[color];
  return (
    <div className={`border rounded-xl px-4 py-3.5 ${s.bg}`}>
      <div className={`text-[10px] font-medium mb-1 ${s.sub}`}>{label.toUpperCase()}</div>
      <div className={`text-[22px] font-bold ${s.num}`}>{count}</div>
      <div className={`text-[11px] ${s.sub}`}>{desc}</div>
    </div>
  );
}
