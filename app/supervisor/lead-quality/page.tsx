import { LEAD_SOURCES } from "../data";

const SOURCE_COLORS: Record<string, string> = {
  "Facebook":    "bg-blue-500",
  "TikTok":      "bg-slate-700",
  "Google":      "bg-red-400",
  "LINE":        "bg-green-500",
  "Broadcast":   "bg-amber-400",
  "Retargeting": "bg-purple-400",
};

export default function LeadQualityPage() {
  const totalLeads = LEAD_SOURCES.reduce((s, r) => s + r.leads, 0);
  const totalSales = LEAD_SOURCES.reduce((s, r) => s + r.sales, 0);
  const bestSource = LEAD_SOURCES.reduce((a, b) => a.closeRate > b.closeRate ? a : b);
  const worstSource = LEAD_SOURCES.reduce((a, b) => a.closeRate < b.closeRate ? a : b);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">คุณภาพ Lead แยกตามช่องทาง</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ยอดตกเพราะทีมขาย หรือเพราะ Lead ไม่ดี — วิเคราะห์แยกตามช่องทาง</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="Leads ทั้งหมด" value={totalLeads.toString()} />
        <KpiCard label="ยอดรวม" value={`฿${totalSales.toLocaleString()}`} accent="green" />
        <KpiCard label="ช่องทางปิดดีสุด" value={bestSource.source} sub={`Close ${bestSource.closeRate}%`} accent="green" />
        <KpiCard label="ช่องทางปิดน้อยสุด" value={worstSource.source} sub={`Close ${worstSource.closeRate}%`} accent="red" />
      </div>

      {/* Close rate chart */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-5">
        <div className="text-[12px] font-semibold text-[#3D3D3D] mb-4">Close Rate เปรียบเทียบ</div>
        <div className="space-y-3">
          {LEAD_SOURCES
            .slice()
            .sort((a, b) => b.closeRate - a.closeRate)
            .map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-28 shrink-0">
                  <div className={`w-2 h-2 rounded-full ${SOURCE_COLORS[s.source] ?? "bg-gray-400"}`} />
                  <span className="text-[12px] text-[#3D3D3D]">{s.source}</span>
                </div>
                <div className="flex-1 h-2.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.closeRate >= 30 ? "bg-[#87DE81]" : s.closeRate >= 20 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${(s.closeRate / 50) * 100}%` }}
                  />
                </div>
                <span className={`text-[13px] font-bold w-12 text-right ${s.closeRate >= 30 ? "text-[#3D9B3A]" : s.closeRate >= 20 ? "text-amber-600" : "text-red-500"}`}>
                  {s.closeRate}%
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Full table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["ช่องทาง", "Leads", "Contact Rate", "Close Rate", "ยอดขาย", "AOV", "Lost"].map((h) => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LEAD_SOURCES.map((s) => (
                <tr key={s.source} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${SOURCE_COLORS[s.source] ?? "bg-gray-400"}`} />
                      <span className="font-medium text-[#3D3D3D]">{s.source}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-[#3D3D3D]">{s.leads}</td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#022EE8] rounded-full" style={{ width: `${s.contactRate}%` }} />
                      </div>
                      <span className="text-[#3D3D3D]">{s.contactRate}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`font-bold ${s.closeRate >= 30 ? "text-[#3D9B3A]" : s.closeRate >= 20 ? "text-amber-600" : "text-red-500"}`}>
                      {s.closeRate}%
                    </span>
                  </td>
                  <td className="py-4 px-5 font-semibold text-[#3D3D3D]">฿{s.sales.toLocaleString()}</td>
                  <td className="py-4 px-5 text-[#3D3D3D]">฿{s.aov.toLocaleString()}</td>
                  <td className="py-4 px-5 text-red-400">{s.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8]">
          <p className="text-[10px] text-[#C0C0C0]">ข้อมูล mock — ต้องมี lead_source field ใน sales table</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "red" }) {
  const color = accent === "green" ? "text-[#3D9B3A]" : accent === "red" ? "text-red-500" : "text-[#3D3D3D]";
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[16px] font-bold ${color}`}>{value}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${color} opacity-70`}>{sub}</div>}
    </div>
  );
}
