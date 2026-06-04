import { getMonthlyReport, getDailyTarget, getDailyAgentSales, getDailySalesForDate } from "@/lib/db";
import type { MonthlyReportRow, MonthlyAgentRow, DailyAgentRow, DailySalesRow } from "@/lib/db";
import { Suspense } from "react";
import MonthSwitcher from "./MonthSwitcher";
import ProductBreakdownTabs from "./ProductBreakdownTabs";
import ViewToggle from "./ViewToggle";
import DaySwitcher from "./DaySwitcher";

function fmt(n: number) {
  return n.toLocaleString("th-TH");
}

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function monthlyTarget(dailyTarget: number) {
  return dailyTarget * 25;
}

function getTodayISO() {
  return new Date(Date.now() + 7 * 3600000).toISOString().split("T")[0];
}

const MONTH_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function dateISOToThai(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${parseInt(d)} ${MONTH_TH[parseInt(m) - 1] ?? m} ${parseInt(y) + 543}`;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; date?: string }>;
}) {
  const { month, view, date } = await searchParams;
  const isDaily = view === "daily";
  const todayISO = getTodayISO();
  const dailyTarget = await getDailyTarget();

  // ── Daily view ──────────────────────────────────────────────────────────────
  if (isDaily) {
    const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO;
    const dailyRows = await getDailySalesForDate(selectedDate);

    const dayTotal = dailyRows.reduce((s, r) => s + r.total, 0);
    const dayOrders = dailyRows.reduce((s, r) => s + r.orders, 0);
    const dayAov = dayOrders > 0 ? Math.round(dayTotal / dayOrders) : 0;
    const dayAchv = pct(dayTotal, dailyTarget);
    const maxAgentTotal = dailyRows[0]?.total ?? 1;
    const dateLabel = dateISOToThai(selectedDate);
    const isToday = selectedDate === todayISO;

    return (
      <div className="h-full flex flex-col overflow-auto gap-5 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Report</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">
              ยอดขายรายวัน — {dateLabel}{isToday ? " (วันนี้)" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Suspense>
              <ViewToggle view="daily" todayISO={todayISO} />
            </Suspense>
            <Suspense>
              <DaySwitcher selectedDate={selectedDate} todayISO={todayISO} />
            </Suspense>
          </div>
        </div>

        {/* Daily KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <KpiCard label="ยอดรวมวันนี้" value={`฿${fmt(dayTotal)}`} accent="green" sub={dateLabel} />
          <KpiCard label="Orders" value={`${dayOrders} บิล`} sub={`AOV ฿${dayAov > 0 ? fmt(dayAov) : "—"}`} />
          <KpiCard
            label="vs เป้าวัน"
            value={`${dayAchv}%`}
            accent={dayAchv >= 100 ? "green" : undefined}
            sub={`เป้า ฿${fmt(dailyTarget)}`}
          />
          <KpiCard
            label="เหลืออีก"
            value={dayTotal >= dailyTarget ? "✅ ถึงเป้า" : `฿${fmt(dailyTarget - dayTotal)}`}
            accent={dayTotal >= dailyTarget ? "green" : undefined}
            sub={dayTotal >= dailyTarget ? "" : "ถึงเป้าวัน"}
          />
        </div>

        {/* Agent ranking */}
        <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-[#E8E8E8]">
            <span className="text-[13px] font-semibold text-[#3D3D3D]">Agent Ranking — {dateLabel}</span>
          </div>
          {dailyRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-[#8B8E8F]">ยังไม่มียอดขายสำหรับวันนี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F7F7F7]">
                    {["#", "Agent", "ยอดวัน", "% ของทีม", "ปิดจากเบอร์", "GoSell", "Hopeful", "Orders", "AOV"].map((h) => (
                      <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-2.5 px-5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.map((a, i) => {
                    const share = pct(a.total, dayTotal);
                    const aov = a.orders > 0 ? Math.round(a.total / a.orders) : 0;
                    return (
                      <tr key={a.agentId} className="border-t border-[#F7F7F7] hover:bg-[#F7F7F7]/60">
                        <td className="py-3 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-[#022EE8]/15 text-[#022EE8]"}`}>
                              {a.agentName.charAt(0)}
                            </div>
                            <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                            {i === 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Top</span>}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#3D3D3D]">฿{fmt(a.total)}</span>
                            <div className="w-14 h-1 bg-[#E8E8E8] rounded-full overflow-hidden">
                              <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${Math.round((a.total / maxAgentTotal) * 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-[#8B8E8F]">{share}%</td>
                        <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.phoneClose)}</td>
                        <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.crm)}</td>
                        <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.upsell)}</td>
                        <td className="py-3 px-5 text-[#3D3D3D]">{a.orders}</td>
                        <td className="py-3 px-5 text-[#3D3D3D]">{aov > 0 ? `฿${fmt(aov)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {dailyRows.length > 1 && (
                  <tfoot>
                    <tr className="bg-[#F7F7F7] border-t-2 border-[#E8E8E8]">
                      <td colSpan={2} className="py-2.5 px-5 text-[11px] font-semibold text-[#8B8E8F]">ทีมรวม</td>
                      <td className="py-2.5 px-5 font-bold text-[#3D3D3D]">฿{fmt(dayTotal)}</td>
                      <td className="py-2.5 px-5 text-[#8B8E8F]">100%</td>
                      <td className="py-2.5 px-5 font-semibold text-[#3D3D3D]">฿{fmt(dailyRows.reduce((s, r) => s + r.phoneClose, 0))}</td>
                      <td className="py-2.5 px-5 font-semibold text-[#3D3D3D]">฿{fmt(dailyRows.reduce((s, r) => s + r.crm, 0))}</td>
                      <td className="py-2.5 px-5 font-semibold text-[#3D3D3D]">฿{fmt(dailyRows.reduce((s, r) => s + r.upsell, 0))}</td>
                      <td className="py-2.5 px-5 font-semibold text-[#3D3D3D]">{dayOrders}</td>
                      <td className="py-2.5 px-5 font-semibold text-[#3D3D3D]">{dayAov > 0 ? `฿${fmt(dayAov)}` : "—"}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
          <div className="px-5 py-2.5 border-t border-[#E8E8E8]">
            <p className="text-[10px] text-[#C0C0C0]">เป้าวัน ฿{fmt(dailyTarget)} / GoSell + Hopeful รวมกัน</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Monthly view ─────────────────────────────────────────────────────────────
  const months = await getMonthlyReport();
  const mTarget = monthlyTarget(dailyTarget);

  if (months.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-[#8B8E8F]">ยังไม่มีข้อมูลยอดขายในระบบ</p>
      </div>
    );
  }

  const latest = months[months.length - 1];
  const selectedKey = month && months.find((m) => m.monthKey === month) ? month : latest.monthKey;
  const selected = months.find((m) => m.monthKey === selectedKey) ?? latest;

  const dailyData = await getDailyAgentSales(selectedKey);

  const monthKeys = months.map((m) => m.monthKey);
  const labels: Record<string, string> = {};
  months.forEach((m) => { labels[m.monthKey] = m.label; });

  const selectedIdx = monthKeys.indexOf(selectedKey);
  const prev = selectedIdx > 0 ? months[selectedIdx - 1] : null;
  const mom = prev && prev.total > 0 ? Math.round(((selected.total - prev.total) / prev.total) * 100) : null;

  const maxMonthTotal = Math.max(...months.map((m) => m.total), 1);

  const aov = selected.orders > 0 ? Math.round(selected.total / selected.orders) : 0;
  const achvSelected = pct(selected.total, mTarget);

  return (
    <div className="h-full flex flex-col overflow-auto gap-5 pb-2">
      {/* Header + month switcher */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Report</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            ยอดขายรายเดือน — GoSell + Hopeful จาก Database จริง
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense>
            <ViewToggle view="monthly" todayISO={todayISO} />
          </Suspense>
          <Suspense>
            <MonthSwitcher monthKeys={monthKeys} selectedKey={selectedKey} labels={labels} />
          </Suspense>
        </div>
      </div>

      {/* Selected month KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <KpiCard label="ยอดรวม" value={`฿${fmt(selected.total)}`} accent="green" sub={selected.label} />
        <KpiCard label="ปิดจากเบอร์" value={`฿${fmt(selected.phoneClose)}`} sub={`${pct(selected.phoneClose, selected.total)}% ของยอดรวม`} />
        <KpiCard label="GoSell" value={`฿${fmt(selected.crm)}`} sub={`${pct(selected.crm, selected.total)}% ของยอดรวม`} />
        <KpiCard label="Hopeful" value={`฿${fmt(selected.upsell)}`} sub={`${pct(selected.upsell, selected.total)}% ของยอดรวม`} />
        <KpiCard label="Orders" value={`${fmt(selected.orders)} บิล`} sub={`AOV ฿${aov > 0 ? fmt(aov) : "—"}`} />
        <KpiCard
          label="vs เป้าประมาณ"
          value={`${achvSelected}%`}
          accent={achvSelected >= 100 ? "green" : undefined}
          sub={`เป้า ฿${fmt(mTarget)}`}
        />
        {mom !== null && (
          <KpiCard
            label="MoM"
            value={`${mom >= 0 ? "+" : ""}${mom}%`}
            accent={mom >= 0 ? "green" : undefined}
            sub={`vs ${prev!.label}`}
          />
        )}
      </div>

      {/* Monthly bar chart + table (all months, highlight selected) */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shrink-0">
        <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#3D3D3D]">ภาพรวมทุกเดือน</span>
          <span className="text-[11px] text-[#8B8E8F]">{months.length} เดือน</span>
        </div>

        {/* Bar chart */}
        <div className="px-5 pt-4 pb-2 flex items-end gap-3 overflow-x-auto">
          {months.map((m) => {
            const barH = Math.round((m.total / maxMonthTotal) * 80);
            const crmH = m.total > 0 ? Math.round((m.crm / m.total) * barH) : 0;
            const phoneCloseH = m.total > 0 ? Math.round((m.phoneClose / m.total) * barH) : 0;
            const upsellH = barH - crmH - phoneCloseH;
            const achv = pct(m.total, mTarget);
            const isSelected = m.monthKey === selectedKey;
            return (
              <div key={m.monthKey} className={`flex flex-col items-center gap-1 shrink-0 min-w-[56px] ${isSelected ? "opacity-100" : "opacity-50"}`}>
                <span className={`text-[10px] font-semibold ${achv >= 100 ? "text-[#3D9B3A]" : achv >= 70 ? "text-amber-600" : "text-red-500"}`}>
                  {achv}%
                </span>
                <div className={`flex flex-col-reverse w-10 rounded-t-md overflow-hidden ${isSelected ? "ring-2 ring-[#022EE8] ring-offset-1" : ""}`} style={{ height: `${Math.max(barH, 4)}px` }}>
                  <div className="bg-[#87DE81]" style={{ height: `${crmH}px` }} title={`CRM ฿${fmt(m.crm)}`} />
                  <div className="bg-[#FFBA49]/70" style={{ height: `${phoneCloseH}px` }} title={`ปิดจากเบอร์ ฿${fmt(m.phoneClose)}`} />
                  <div className="bg-[#022EE8]/60" style={{ height: `${upsellH}px` }} title={`Upsell ฿${fmt(m.upsell)}`} />
                </div>
                <span className={`text-[10px] text-center leading-tight ${isSelected ? "text-[#022EE8] font-semibold" : "text-[#8B8E8F]"}`}>{m.label}</span>
              </div>
            );
          })}
          {/* Legend */}
          <div className="ml-auto flex flex-col gap-1.5 shrink-0 mb-6">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#87DE81]" /><span className="text-[10px] text-[#8B8E8F]">GoSell</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#FFBA49]/70" /><span className="text-[10px] text-[#8B8E8F]">ปิดจากเบอร์</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#022EE8]/60" /><span className="text-[10px] text-[#8B8E8F]">Hopeful</span></div>
          </div>
        </div>

        {/* Monthly table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-t border-[#E8E8E8] bg-[#F7F7F7]">
                {["เดือน", "ปิดจากเบอร์", "GoSell", "Hopeful", "รวม", "Orders", "AOV", "vs เป้าประมาณ"].map((h) => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-2.5 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const achv = pct(m.total, mTarget);
                const aovM = m.orders > 0 ? Math.round(m.total / m.orders) : 0;
                const isSelected = m.monthKey === selectedKey;
                return (
                  <tr key={m.monthKey} className={`border-t border-[#F7F7F7] ${isSelected ? "bg-[#022EE8]/5" : "hover:bg-[#F7F7F7]/60"}`}>
                    <td className="py-3 px-5 font-medium text-[#3D3D3D] whitespace-nowrap">
                      {m.label}
                      {isSelected && <span className="ml-1.5 text-[10px] text-[#022EE8] font-semibold">เลือก</span>}
                    </td>
                    <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(m.phoneClose)}</td>
                    <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(m.crm)}</td>
                    <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(m.upsell)}</td>
                    <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(m.total)}</td>
                    <td className="py-3 px-5 text-[#3D3D3D]">{m.orders}</td>
                    <td className="py-3 px-5 text-[#3D3D3D]">{aovM > 0 ? `฿${fmt(aovM)}` : "—"}</td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${achv >= 100 ? "bg-[#87DE81]" : achv >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${Math.min(achv, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold ${achv >= 100 ? "text-[#3D9B3A]" : achv >= 70 ? "text-amber-600" : "text-red-500"}`}>
                          {achv}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-[#E8E8E8]">
          <p className="text-[10px] text-[#C0C0C0]">เป้าประมาณ = daily target ฿{fmt(dailyTarget)} × 25 วัน = ฿{fmt(mTarget)}/เดือน</p>
        </div>
      </div>

      {/* Agent ranking for selected month */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shrink-0">
        <div className="px-5 py-4 border-b border-[#E8E8E8]">
          <span className="text-[13px] font-semibold text-[#3D3D3D]">Agent Ranking — {selected.label}</span>
        </div>
        <SelectedMonthAgents agents={selected.agents} monthTotal={selected.total} />
      </div>

      {/* Product breakdown: GoSell vs Hopeful per agent */}
      <ProductBreakdownTabs agents={selected.agents} label={selected.label} />

      {/* Daily heatmap for selected month */}
      {dailyData.agents.length > 0 && (
        <DailyHeatmap
          agents={dailyData.agents}
          daysInMonth={dailyData.daysInMonth}
          today={dailyData.today}
          label={selected.label}
          monthKey={selectedKey}
        />
      )}

      <div className="text-[10px] text-[#C0C0C0] pb-1">
        % Hopeful สูง (&gt;35%) = closing rate ต่ำ — ลูกค้าติด &quot;รอ&quot; เยอะ ควรตรวจสอบ
      </div>
    </div>
  );
}

function SelectedMonthAgents({ agents, monthTotal }: { agents: MonthlyAgentRow[]; monthTotal: number }) {
  const sorted = agents.slice().sort((a, b) => b.total - a.total);
  const maxTotal = sorted[0]?.total ?? 1;

  if (sorted.length === 0) {
    return <p className="px-5 py-8 text-center text-[12px] text-[#8B8E8F]">ยังไม่มีข้อมูล</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#F7F7F7]">
            {["#", "Agent", "ยอดเดือน", "% ของทีม", "ปิดจากเบอร์", "GoSell", "Hopeful", "Orders", "AOV"].map((h) => (
              <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-2.5 px-5 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((a, i) => {
            const teamShare = pct(a.total, monthTotal);
            const aov = a.orders > 0 ? Math.round(a.total / a.orders) : 0;
            return (
              <tr key={a.agentId} className="border-t border-[#F7F7F7] hover:bg-[#F7F7F7]/60">
                <td className="py-3 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-[#022EE8]/15 text-[#022EE8]"}`}>
                      {a.agentName.charAt(0)}
                    </div>
                    <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                    {i === 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Top</span>}
                  </div>
                </td>
                <td className="py-3 px-5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#3D3D3D]">฿{fmt(a.total)}</span>
                    <div className="w-14 h-1 bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${Math.round((a.total / maxTotal) * 100)}%` }} />
                    </div>
                  </div>
                </td>
                <td className="py-3 px-5 text-[#8B8E8F]">{teamShare}%</td>
                <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.phoneClose)}</td>
                <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.crm)}</td>
                <td className="py-3 px-5 text-[#3D3D3D]">฿{fmt(a.upsell)}</td>
                <td className="py-3 px-5 text-[#3D3D3D]">{a.orders}</td>
                <td className="py-3 px-5 text-[#3D3D3D]">{aov > 0 ? `฿${fmt(aov)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const DOW_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function DailyHeatmap({
  agents,
  daysInMonth,
  today,
  label,
  monthKey,
}: {
  agents: DailyAgentRow[];
  daysInMonth: number;
  today: number;
  label: string;
  monthKey: string;
}) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Day-of-week for each day (0=Sun … 6=Sat)
  const [mm, yyyy] = monthKey.split("/");
  const firstDOW = new Date(Number(yyyy), Number(mm) - 1, 1).getDay();
  function dow(d: number) { return (firstDOW + d - 1) % 7; }
  function isWeekend(d: number) { const w = dow(d); return w === 0 || w === 6; }

  const dayTotals = days.map((d) => agents.reduce((s, a) => s + (a.days[d] ?? 0), 0));
  const teamGrandTotal = dayTotals.reduce((s, v) => s + v, 0);
  const maxDayTotal = Math.max(...dayTotals, 1);
  const globalMax = Math.max(...agents.flatMap((a) => Object.values(a.days)), 1);

  function cellColor(val: number, day: number): string {
    if (day > today) return "#F7F7F7";
    if (val === 0) return "transparent";
    const t = val / globalMax;
    if (t < 0.15) return "#DDFAD8";
    if (t < 0.35) return "#B8EFB2";
    if (t < 0.55) return "#87DE81";
    if (t < 0.75) return "#5DC957";
    return "#3DAF32";
  }

  function fmtTip(val: number) {
    return `฿${val.toLocaleString("th-TH")}`;
  }

  const agentMax = agents[0]?.monthTotal ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between gap-4 flex-wrap">
        <span className="text-[13px] font-semibold text-[#3D3D3D]">Daily Heatmap — {label}</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#C0C0C0]">hover เพื่อดูยอด</span>
          <div className="flex items-center gap-1.5">
            {[
              { color: "transparent", border: true, label: "ไม่มียอด" },
              { color: "#DDFAD8", label: "น้อย" },
              { color: "#87DE81", label: "" },
              { color: "#5DC957", label: "" },
              { color: "#3DAF32", label: "สูงสุด" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="w-3.5 h-3.5 rounded-sm"
                  style={{
                    background: item.color,
                    border: item.border ? "1px solid #E8E8E8" : "1px solid transparent",
                  }}
                />
                {item.label && <span className="text-[9px] text-[#C0C0C0]">{item.label}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "120px" }} />
            {days.map((d) => <col key={d} style={{ width: "34px" }} />)}
            <col style={{ width: "100px" }} />
          </colgroup>
          <thead>
            {/* Day number row */}
            <tr>
              <th className="sticky left-0 bg-white z-10 py-2.5 px-4 text-left text-[11px] text-[#8B8E8F] font-semibold border-b border-[#F0F0F0]">
                Agent
              </th>
              {days.map((d) => {
                const isToday = d === today;
                const weekend = isWeekend(d);
                return (
                  <th
                    key={d}
                    className="border-b border-[#F0F0F0]"
                    style={{ padding: "6px 2px 2px" }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={`text-[11px] font-semibold leading-none ${isToday ? "text-[#022EE8]" : weekend ? "text-[#C8C8C8]" : "text-[#8B8E8F]"
                          }`}
                      >
                        {d}
                      </span>
                      <span
                        className={`text-[9px] leading-none font-normal ${isToday ? "text-[#022EE8]" : weekend ? "text-[#DCDCDC]" : "text-[#C8C8C8]"
                          }`}
                      >
                        {DOW_SHORT[dow(d)]}
                      </span>
                    </div>
                  </th>
                );
              })}
              <th className="border-b border-[#F0F0F0] py-2.5 px-3 text-right text-[11px] text-[#8B8E8F] font-semibold whitespace-nowrap">
                รวมเดือน
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, ai) => (
              <tr
                key={a.agentId}
                className="border-b border-[#F7F7F7] hover:bg-[#FAFAFA] transition-colors"
              >
                {/* Agent name + mini bar */}
                <td className="sticky left-0 bg-white z-10 py-2 px-4 hover:bg-[#FAFAFA]">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] font-semibold text-[#3D3D3D] leading-none">{a.agentName}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1 bg-[#F0F0F0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#87DE81] rounded-full"
                          style={{ width: `${Math.round((a.monthTotal / agentMax) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[#C0C0C0] leading-none">
                        {a.monthTotal >= 100000
                          ? `${(a.monthTotal / 1000).toFixed(0)}k`
                          : a.monthTotal >= 10000
                            ? `${(a.monthTotal / 1000).toFixed(1)}k`
                            : a.monthTotal > 0
                              ? a.monthTotal.toLocaleString()
                              : "—"}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {days.map((d) => {
                  const val = a.days[d] ?? 0;
                  const bg = cellColor(val, d);
                  const isFuture = d > today;
                  const weekend = isWeekend(d);
                  return (
                    <td
                      key={d}
                      className="py-1.5 px-0.5"
                      title={val > 0 ? `${a.agentName} วันที่ ${d} — ${fmtTip(val)}` : undefined}
                    >
                      <div
                        className={`w-7 h-7 rounded-md mx-auto transition-transform hover:scale-110 ${isFuture ? "opacity-20" : ""
                          } ${weekend && !isFuture && val === 0 ? "bg-[#FAFAFA]" : ""}`}
                        style={{ background: isFuture ? "#F0F0F0" : bg || (weekend ? "#FAFAFA" : "transparent") }}
                      />
                    </td>
                  );
                })}

                {/* Row total */}
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <span className="text-[12px] font-semibold text-[#3D3D3D]">
                    ฿{a.monthTotal.toLocaleString("th-TH")}
                  </span>
                </td>
              </tr>
            ))}

            {/* Team totals row */}
            <tr className="bg-[#F7F7F7] border-t-2 border-[#E8E8E8]">
              <td className="sticky left-0 bg-[#F7F7F7] z-10 py-2.5 px-4">
                <span className="text-[11px] font-semibold text-[#8B8E8F]">ทีมรวม</span>
              </td>
              {dayTotals.map((total, i) => {
                const d = i + 1;
                const isFuture = d > today;
                const barH = isFuture ? 0 : Math.round((total / maxDayTotal) * 24);
                return (
                  <td
                    key={d}
                    className="py-1.5 px-0.5"
                    title={total > 0 ? `ทีม วันที่ ${d} — ${fmtTip(total)}` : undefined}
                  >
                    <div className="w-7 mx-auto flex flex-col items-center justify-end" style={{ height: "28px" }}>
                      {!isFuture && barH > 0 && (
                        <div
                          className="w-5 rounded-sm bg-[#022EE8]/50"
                          style={{ height: `${barH}px` }}
                        />
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                <span className="text-[12px] font-bold text-[#3D3D3D]">฿{teamGrandTotal.toLocaleString("th-TH")}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent, sub }: { label: string; value: string; accent?: "green"; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[18px] font-bold ${accent === "green" ? "text-[#3D9B3A]" : "text-[#3D3D3D]"}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#C0C0C0] mt-0.5">{sub}</div>}
    </div>
  );
}
