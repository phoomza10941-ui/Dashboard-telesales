import { getMyData, getAgentTarget, getDailyTarget, getAgentMonthlyTarget, getAgentMonthlySales, parseNoteStatus } from "@/lib/db";
import { fmtBahtCompact, fmtBaht, fmtPct } from "@/lib/format";

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
      urgentAlerts = data.rows.filter(r => parseNoteStatus(r.note) === "pending_transfer").length;
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
  } catch { /* monthly data optional — don't block daily KPIs */ }

  const aov          = orders > 0 ? Math.round(sales / orders) : 0;
  const gap          = Math.max(dailyTarget - sales, 0);
  const pct          = Math.min(Math.round((sales / dailyTarget) * 100), 100);
  const billsNeeded  = aov > 0 ? Math.ceil(gap / aov) : 0;
  const monthlyPct   = monthlyTarget ? Math.min(Math.round((monthlySales / monthlyTarget) * 100), 100) : null;

  return (
    <header className="bg-white border-b border-[#E8E8E8] px-6 shrink-0">
      <div className="flex items-center gap-0 h-[56px]">
        <KpiItem label="ยอดวันนี้" value={fmtBahtCompact(sales)} title={fmtBaht(sales)} accent="green" />
        <Divider />
        <KpiItem
          label={isPersonalTarget ? "เป้าส่วนตัว" : "เป้าทีม"}
          value={fmtBahtCompact(dailyTarget)}
          title={fmtBaht(dailyTarget)}
          accent={isPersonalTarget ? "cyan" : undefined}
        />
        <Divider />
        <div className="flex items-center gap-3 px-5">
          <div>
            <div className="text-[10px] text-[#8B8E8F] mb-1">% ถึงเป้าวัน</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-[#3D3D3D] tabular-nums whitespace-nowrap">{fmtPct(pct)}</span>
            </div>
          </div>
        </div>
        <Divider />
        <KpiItem label="เหลืออีก" value={fmtBahtCompact(gap)} title={fmtBaht(gap)} />
        <Divider />
        <KpiItem label="ต้องปิดเพิ่ม" value={`${billsNeeded} บิล`} />
        <Divider />
        <KpiItem label="AOV" value={aov > 0 ? fmtBahtCompact(aov) : "—"} title={aov > 0 ? fmtBaht(aov) : undefined} />
        <Divider />
        <KpiItem label="Orders" value={`${orders}`} />

        {/* Monthly progress — only shown when supervisor has set a monthly target */}
        {monthlyTarget !== null && (
          <>
            <Divider />
            <div className="flex items-center gap-3 px-5">
              <div>
                <div className="text-[10px] text-[#8B8E8F] mb-1">% เป้าเดือน</div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#022EE8] rounded-full" style={{ width: `${monthlyPct}%` }} />
                  </div>
                  <span className="text-[13px] font-semibold text-[#0E8FA8]">{monthlyPct}%</span>
                </div>
                <div className="text-[9px] text-[#C0C0C0] mt-0.5 whitespace-nowrap">
                  {fmtBahtCompact(monthlySales)} / {fmtBahtCompact(monthlyTarget)}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center">
          {urgentAlerts > 0 && (
            <div className="flex items-center gap-1.5 bg-[#FF6B6B]/10 text-[#FF6B6B] px-3 py-1.5 rounded-lg">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-[12px] font-semibold">{urgentAlerts} Alert ด่วน</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function KpiItem({ label, value, title, accent }: { label: string; value: string; title?: string; accent?: "green" | "cyan" }) {
  const valueColor =
    accent === "green" ? "text-[#3D9B3A]" :
    accent === "cyan"  ? "text-[#0E8FA8]" :
    "text-[#3D3D3D]";
  return (
    <div className="px-5 flex flex-col justify-center">
      <div className="text-[10px] text-[#8B8E8F] mb-0.5">{label}</div>
      <div title={title} className={`text-[13px] font-semibold leading-none tabular-nums whitespace-nowrap ${valueColor}`}>{value}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-[#E8E8E8]" />;
}
