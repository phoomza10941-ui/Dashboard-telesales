import { getAllAgentsAnalysis, getDailyTarget, getAgentsWithTargets, getAgentsWithMonthlyTargets, getDailyAgentSales } from "@/lib/db";

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function currentThaiMonthKey() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function TeamPerformancePage() {
  const monthKey = currentThaiMonthKey();

  const [agents, dailyTarget, agentTargets, monthlyTargets, monthlyData] = await Promise.all([
    getAllAgentsAnalysis(),
    getDailyTarget(),
    getAgentsWithTargets(),
    getAgentsWithMonthlyTargets(monthKey),
    getDailyAgentSales(),
  ]);

  // Daily target per agent (falls back to team daily target)
  const dailyTargetMap: Record<string, number> = {};
  agentTargets.forEach((t) => { dailyTargetMap[t.agentId] = t.target; });

  // Monthly target per agent (falls back to dailyTarget × 25)
  const monthlyTargetMap: Record<string, number> = {};
  monthlyTargets.forEach((t) => {
    monthlyTargetMap[t.agentId] = t.monthlyTarget ?? dailyTarget * 25;
  });

  // Month-to-date sales per agent
  const monthSalesMap: Record<string, number> = {};
  monthlyData.agents.forEach((a) => { monthSalesMap[a.agentId] = a.monthTotal; });

  const maxSales = Math.max(...agents.map((a) => a.todaySales), 1);
  const teamTotal = agents.reduce((s, a) => s + a.todaySales, 0);
  const teamOrders = agents.reduce((s, a) => s + a.todayOrders, 0);
  const teamMonthTotal = monthlyData.agents.reduce((s, a) => s + a.monthTotal, 0);
  const teamMonthlyTarget = agents.reduce((s, a) => s + (monthlyTargetMap[a.agentId] ?? dailyTarget * 25), 0);

  const onTrackDaily = agents.filter((a) => pct(a.todaySales, dailyTargetMap[a.agentId] ?? dailyTarget) >= 80).length;
  const onTrackMonthly = agents.filter((a) => pct(monthSalesMap[a.agentId] ?? 0, monthlyTargetMap[a.agentId] ?? dailyTarget * 25) >= 80).length;

  return (
    <div className="flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">ผลงานทีมรายคน</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          ยอดขายวันนี้ & เดือนนี้ รายคน — เทียบเป้ารายวัน / รายเดือน
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard label="ยอดรวมทีมวันนี้" value={`฿${teamTotal.toLocaleString()}`} accent="green" />
        <KpiCard
          label="เป้ารายวัน (ทีม)"
          value={`฿${dailyTarget.toLocaleString()}`}
          sub={`${pct(teamTotal, dailyTarget)}% วันนี้`}
        />
        <KpiCard
          label="เป้ารายเดือน (ทีม)"
          value={`฿${(dailyTarget * 25).toLocaleString()}`}
          sub={`฿${teamMonthTotal.toLocaleString()} / ${pct(teamMonthTotal, dailyTarget * 25)}% เดือนนี้`}
          accent={pct(teamMonthTotal, dailyTarget * 25) >= 80 ? "green" : undefined}
        />
        <KpiCard label="Orders รวมวันนี้" value={`${teamOrders} บิล`} />
        <KpiCard
          label="Agents ถึงเป้ารายวัน"
          value={`${onTrackDaily}/${agents.length} คน`}
          accent={onTrackDaily >= Math.ceil(agents.length / 2) ? "green" : "red"}
        />
        <KpiCard
          label="Agents ถึงเป้าเดือน"
          value={`${onTrackMonthly}/${agents.length} คน`}
          accent={onTrackMonthly >= Math.ceil(agents.length / 2) ? "green" : "red"}
        />
      </div>

      {/* Main table */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["#", "Agent", "ยอดวันนี้ / เป้ารายวัน", "ยอดเดือนนี้ / เป้าเดือน", "Orders", "AOV", "รอโอน", "Follow-up", "สถานะ"].map((h) => (
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
                    const agentDailyTarget = dailyTargetMap[a.agentId] ?? dailyTarget;
                    const agentMonthlyTarget = monthlyTargetMap[a.agentId] ?? dailyTarget * 25;
                    const agentMonthSales = monthSalesMap[a.agentId] ?? 0;

                    const dailyPct = pct(a.todaySales, agentDailyTarget);
                    const monthlyPct = pct(agentMonthSales, agentMonthlyTarget);
                    const aov = a.todayOrders > 0 ? Math.round(a.todaySales / a.todayOrders) : 0;

                    const dailyStatusColor =
                      dailyPct >= 80 ? "text-[#3D9B3A] bg-green-50" :
                      dailyPct >= 50 ? "text-amber-600 bg-amber-50" :
                      "text-red-500 bg-red-50";
                    const dailyStatusLabel =
                      dailyPct >= 80 ? "ตามเป้า" :
                      dailyPct >= 50 ? "ตามหลัง" : "เสี่ยง";

                    return (
                      <tr key={a.agentId} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                        <td className="py-4 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[12px] font-bold shrink-0">
                              {a.agentName.charAt(0)}
                            </div>
                            <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                          </div>
                        </td>

                        {/* Daily: sales + progress vs daily target */}
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#3D3D3D]">฿{a.todaySales.toLocaleString()}</span>
                              {dailyPct > 100 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3D9B3A] bg-green-50 px-1.5 py-0.5 rounded-full">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  ถึงเป้า
                                </span>
                              ) : (
                                <span className={`text-[11px] font-semibold ${dailyPct >= 80 ? "text-[#3D9B3A]" : dailyPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                  {dailyPct}%
                                </span>
                              )}
                            </div>
                            <div className="w-24 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${dailyPct >= 80 ? "bg-[#87DE81]" : dailyPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(dailyPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#C0C0C0]">เป้า ฿{agentDailyTarget.toLocaleString()}</span>
                          </div>
                        </td>

                        {/* Monthly: month-to-date + progress vs monthly target */}
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#3D3D3D]">฿{agentMonthSales.toLocaleString()}</span>
                              {monthlyPct > 100 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#3D9B3A] bg-green-50 px-1.5 py-0.5 rounded-full">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  ถึงเป้า
                                </span>
                              ) : (
                                <span className={`text-[11px] font-semibold ${monthlyPct >= 80 ? "text-[#3D9B3A]" : monthlyPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                                  {monthlyPct}%
                                </span>
                              )}
                            </div>
                            <div className="w-24 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${monthlyPct >= 80 ? "bg-[#87DE81]" : monthlyPct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(monthlyPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#C0C0C0]">เป้า ฿{agentMonthlyTarget.toLocaleString()}</span>
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
                            <span className="text-[#022EE8] font-medium">{a.followUpRows.length} เคส</span>
                          ) : (
                            <span className="text-[#8B8E8F]">—</span>
                          )}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${dailyStatusColor}`}>{dailyStatusLabel}</span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8] flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-[#8B8E8F]">
            ทีมวันนี้ ฿{teamTotal.toLocaleString()} / เป้ารายวัน ฿{dailyTarget.toLocaleString()} — {pct(teamTotal, dailyTarget)}%
          </p>
          <p className="text-[11px] text-[#8B8E8F]">
            ทีมเดือนนี้ ฿{teamMonthTotal.toLocaleString()} / เป้าเดือน ฿{(dailyTarget * 25).toLocaleString()} — {pct(teamMonthTotal, dailyTarget * 25)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: "green" | "red"; sub?: string }) {
  const color = accent === "green" ? "text-[#3D9B3A]" : accent === "red" ? "text-red-500" : "text-[#3D3D3D]";
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[18px] font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#C0C0C0] mt-0.5">{sub}</div>}
    </div>
  );
}
