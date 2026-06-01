import { getAllAgentsAnalysis, getDailyTarget, getAgentsWithTargets } from "@/lib/db";

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default async function TeamPerformancePage() {
  const [agents, dailyTarget, agentTargets] = await Promise.all([
    getAllAgentsAnalysis(),
    getDailyTarget(),
    getAgentsWithTargets(),
  ]);

  const targetMap: Record<string, number> = {};
  agentTargets.forEach((t) => { targetMap[t.agentId] = t.target; });

  const maxSales = Math.max(...agents.map((a) => a.todaySales), 1);
  const teamTotal = agents.reduce((s, a) => s + a.todaySales, 0);
  const teamOrders = agents.reduce((s, a) => s + a.todayOrders, 0);
  const onTrack = agents.filter((a) => pct(a.todaySales, targetMap[a.agentId] ?? dailyTarget) >= 80).length;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Team Performance by Person</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          ยอดขายวันนี้ / Orders / AOV รายคน — เทียบกับเป้า ฿{dailyTarget.toLocaleString()}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <KpiCard label="ยอดรวมทีมวันนี้" value={`฿${teamTotal.toLocaleString()}`} accent="green" />
        <KpiCard label="เป้าทีม (default)" value={`฿${dailyTarget.toLocaleString()}`} />
        <KpiCard label="Orders รวม" value={`${teamOrders} บิล`} />
        <KpiCard label="Agents ถึงเป้า" value={`${onTrack}/${agents.length} คน`} accent={onTrack >= agents.length / 2 ? "green" : "red"} />
      </div>

      {/* Main table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["#", "Agent", "ยอดวันนี้", "เทียบเป้า", "Orders", "AOV", "Pending", "Follow-up", "สถานะ"].map((h) => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[12px] text-[#8B8E8F]">
                    ยังไม่มีข้อมูล — รอ agents กรอกยอดขายวันนี้
                  </td>
                </tr>
              ) : (
                agents
                  .slice()
                  .sort((a, b) => b.todaySales - a.todaySales)
                  .map((a, i) => {
                    const agentTarget = targetMap[a.agentId] ?? dailyTarget;
                    const targetPct = pct(a.todaySales, agentTarget);
                    const aov = a.todayOrders > 0 ? Math.round(a.todaySales / a.todayOrders) : 0;
                    const statusColor =
                      targetPct >= 80 ? "text-[#3D9B3A] bg-green-50" :
                      targetPct >= 50 ? "text-amber-600 bg-amber-50" :
                      "text-red-500 bg-red-50";
                    const statusLabel =
                      targetPct >= 80 ? "On Track" :
                      targetPct >= 50 ? "Behind" : "At Risk";
                    return (
                      <tr key={a.agentId} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                        <td className="py-4 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#58CEE8]/15 flex items-center justify-center text-[#58CEE8] text-[12px] font-bold shrink-0">
                              {a.agentName.charAt(0)}
                            </div>
                            <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#3D3D3D]">฿{a.todaySales.toLocaleString()}</span>
                            <div className="w-16 h-1 bg-[#E8E8E8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${Math.round((a.todaySales / maxSales) * 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${targetPct >= 80 ? "bg-[#87DE81]" : targetPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                  style={{ width: `${Math.min(targetPct, 100)}%` }}
                                />
                              </div>
                              {targetPct > 100 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3D9B3A] bg-green-50 px-2 py-0.5 rounded-full">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                  ถึงเป้าแล้ว
                                </span>
                              ) : (
                                <span className={`font-semibold text-[12px] ${targetPct >= 80 ? "text-[#3D9B3A]" : targetPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                  {targetPct}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[#C0C0C0]">เป้า ฿{agentTarget.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-[#3D3D3D]">{a.todayOrders}</td>
                        <td className="py-4 px-5 text-[#3D3D3D]">{aov > 0 ? `฿${aov.toLocaleString()}` : "—"}</td>
                        <td className="py-4 px-5">
                          {a.pendingTransferRows.length > 0 ? (
                            <span className="text-amber-600 font-medium">{a.pendingTransferRows.length} เคส</span>
                          ) : (
                            <span className="text-[#8B8E8F]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          {a.followUpRows.length > 0 ? (
                            <span className="text-[#58CEE8] font-medium">{a.followUpRows.length} เคส</span>
                          ) : (
                            <span className="text-[#8B8E8F]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between">
          <p className="text-[11px] text-[#8B8E8F]">
            ยอดทีม ฿{teamTotal.toLocaleString()} / เป้า ฿{dailyTarget.toLocaleString()} — {pct(teamTotal, dailyTarget)}%
          </p>
          <p className="text-[10px] text-[#C0C0C0]">Pending / Follow-up คำนวณจาก note field</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" }) {
  const color = accent === "green" ? "text-[#3D9B3A]" : accent === "red" ? "text-red-500" : "text-[#3D3D3D]";
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[18px] font-bold ${color}`}>{value}</div>
    </div>
  );
}
