import { getMyData, getAgentTarget, getDailyTarget, getAgentMonthlyTarget, getAgentMonthlySales, rowStatus } from "@/lib/db";
import { fmtBahtCompact, fmtBaht } from "@/lib/format";
import StickyKpiBarUI from "./StickyKpiBarUI";

function currentThaiMonthKey() {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function StickyKpiBar({ userId }: { userId: string }) {
  let sales = 0, orders = 0, urgentAlerts = 0;
  let dailyTarget = 80000;
  let isPersonalTarget = false;
  let monthlyTarget: number | null = null;
  let monthlySales = 0;

  const monthKey = currentThaiMonthKey();

  try {
    const [data, agentTarget, teamTarget] = await Promise.all([
      getMyData(userId),
      getAgentTarget(userId),
      getDailyTarget(),
    ]);
    if (data) {
      sales = data.totalSales;
      orders = data.orderCount;
      urgentAlerts = data.rows.filter(r => rowStatus(r) === "pending_transfer").length;
    }
    dailyTarget = agentTarget;
    isPersonalTarget = agentTarget !== teamTarget;
  } catch { /* fallback to 0 / 80000 */ }

  try {
    const [mt, ms] = await Promise.all([
      getAgentMonthlyTarget(userId, monthKey),
      getAgentMonthlySales(userId, monthKey),
    ]);
    monthlyTarget = mt;
    monthlySales = ms;
  } catch { /* monthly data optional */ }

  const aov         = orders > 0 ? Math.round(sales / orders) : 0;
  const gap         = Math.max(dailyTarget - sales, 0);
  const pct         = Math.min(Math.round((sales / dailyTarget) * 100), 100);
  const billsNeeded = aov > 0 ? Math.ceil(gap / aov) : 0;
  const monthlyPct  = monthlyTarget ? Math.min(Math.round((monthlySales / monthlyTarget) * 100), 100) : null;

  return (
    <StickyKpiBarUI
      sales={sales}
      orders={orders}
      urgentAlerts={urgentAlerts}
      dailyTarget={dailyTarget}
      isPersonalTarget={isPersonalTarget}
      monthlyTarget={monthlyTarget}
      monthlySales={monthlySales}
      aov={aov}
      gap={gap}
      pct={pct}
      billsNeeded={billsNeeded}
      monthlyPct={monthlyPct}
      salesFormatted={fmtBahtCompact(sales)}
      salesFull={fmtBaht(sales)}
      dailyTargetFormatted={fmtBahtCompact(dailyTarget)}
      dailyTargetFull={fmtBaht(dailyTarget)}
      aovFormatted={aov > 0 ? fmtBahtCompact(aov) : "—"}
      aovFull={aov > 0 ? fmtBaht(aov) : ""}
      gapFormatted={fmtBahtCompact(gap)}
      gapFull={fmtBaht(gap)}
      monthlySalesFormatted={fmtBahtCompact(monthlySales)}
      monthlyTargetFormatted={monthlyTarget ? fmtBahtCompact(monthlyTarget) : ""}
    />
  );
}
