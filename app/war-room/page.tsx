import LiveClock from "./LiveClock";
import PodiumPanel, { type PodiumEntry } from "./PodiumPanel";
import AnimatedBar from "./AnimatedBar";
import MotionSection from "./MotionSection";
import RealtimeRefresh from "@/app/components/RealtimeRefresh";
import TickerBar from "./TickerBar";
import CountUpValue from "./CountUpValue";
import CyclingPanel, { type CyclePanel } from "./CyclingPanel";
import HourlyCycleChart from "./HourlyCycleChart";
import {
  getAllAgentsAnalysis,
  getAgentsWithTargets,
  getDailyTarget,
  getTodayHourlySales,
  parseNoteStatus,
  parseNoteObjection,
  type AgentAnalysis,
} from "@/lib/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtK(val: number): string {
  if (val === 0) return "0";
  if (val < 1000) return val.toLocaleString();
  if (val < 1_000_000) return `${Math.round(val / 1000)}K`;
  return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
}

function getThaiHour() {
  return (new Date().getUTCHours() + 7) % 24;
}

function thaiDateLabel() {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  return new Date().toLocaleDateString("th-TH", opts);
}

function computePaceChart(
  hourly: { hour: number; sales: number }[],
  teamTarget: number,
  thaiHour: number
) {
  const W = 460, H = 160, pL = 44, pR = 10, pT = 12, pB = 28;
  const cW = W - pL - pR, cH = H - pT - pB;
  const maxVal = Math.max(teamTarget * 1.15, 1);
  const WORK_START = 8, WORK_END = 18;

  const xH = (h: number) => pL + ((h - WORK_START) / (WORK_END - WORK_START)) * cW;
  const yS = (s: number) => pT + cH - Math.min(s / maxVal, 1.1) * cH;

  const cum: Record<number, number> = {};
  let running = 0;
  for (let h = WORK_START; h <= WORK_END; h++) {
    running += hourly.find((d) => d.hour === h)?.sales ?? 0;
    cum[h] = running;
  }
  const currentCum = cum[Math.min(thaiHour, WORK_END)] ?? 0;
  const hoursWorked = Math.max(thaiHour - WORK_START, 0.5);
  const rate = currentCum / hoursWorked;
  const forecastVal = Math.min(rate * (WORK_END - WORK_START), maxVal * 1.05);

  const pacePoints = `${xH(WORK_START)},${yS(0)} ${xH(WORK_END)},${yS(teamTarget)}`;

  const actualHours: number[] = [];
  for (let h = WORK_START; h <= Math.min(thaiHour, WORK_END); h++) actualHours.push(h);
  const actualPoints = actualHours.map((h) => `${xH(h).toFixed(1)},${yS(cum[h]).toFixed(1)}`).join(" ");

  const curX = thaiHour >= WORK_START && thaiHour <= WORK_END ? xH(thaiHour) : null;
  const curY = curX !== null ? yS(currentCum) : null;
  const forecastPoints =
    curX !== null
      ? `${xH(Math.min(thaiHour, WORK_END)).toFixed(1)},${yS(currentCum).toFixed(1)} ${xH(WORK_END).toFixed(1)},${yS(forecastVal).toFixed(1)}`
      : "";

  const yLabels = [0, 0.25, 0.5, 0.75, 1.0].map((p) => ({
    val: Math.round(teamTarget * p),
    y: yS(teamTarget * p),
  }));
  const xLabels = [8, 10, 12, 14, 16, 18].map((h) => ({ label: `${h}:00`, x: xH(h) }));

  return {
    W, H, pL, pR, pT, pB, cW, cH,
    pacePoints, actualPoints, forecastPoints,
    curX, curY,
    yLabels, xLabels,
    currentCum, forecastVal,
    WORK_START, WORK_END,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WarRoomPage() {
  const [analyses, agentTargets, teamTarget, hourlyData] = await Promise.all([
    getAllAgentsAnalysis(),
    getAgentsWithTargets(),
    getDailyTarget(),
    getTodayHourlySales(),
  ]);

  const targetMap: Record<string, number> = {};
  agentTargets.forEach((a) => { targetMap[a.agentId] = a.target; });

  const thaiHour = getThaiHour();

  // ── Team KPIs ──────────────────────────────────────────────────────────────
  const teamTodaySales = analyses.reduce((s, a) => s + a.todaySales, 0);
  const teamTodayOrders = analyses.reduce((s, a) => s + a.todayOrders, 0);
  const teamPending = analyses.reduce((s, a) => s + a.pendingTransferRows.length, 0);
  const teamFollowUp = analyses.reduce((s, a) => s + a.followUpRows.length, 0);
  const teamTotalTarget = teamTarget;
  const teamPct = teamTotalTarget > 0 ? Math.min(Math.round((teamTodaySales / teamTotalTarget) * 100), 999) : 0;
  const teamGap = Math.max(teamTotalTarget - teamTodaySales, 0);
  const aov = teamTodayOrders > 0 ? Math.round(teamTodaySales / teamTodayOrders) : 0;

  // Forecast
  const WORK_START = 8;
  const hoursWorked = Math.max(thaiHour - WORK_START, 0.5);
  const rate = teamTodaySales / hoursWorked;
  const forecast = Math.round(rate * (18 - WORK_START));

  // ── Pace Chart ────────────────────────────────────────────────────────────
  const pace = computePaceChart(hourlyData, teamTotalTarget, thaiHour);

  // ── Hourly (display hours 9-17) ────────────────────────────────────────────
  const displayHours = [9, 10, 11, 12, 13, 14, 15, 16, 17];

  // ── Team Funnel ────────────────────────────────────────────────────────────
  const todayStatusMap: Record<string, number> = {};
  analyses.forEach((a) => {
    a.todayRows.forEach((r) => {
      const st = parseNoteStatus(r.note);
      todayStatusMap[st] = (todayStatusMap[st] ?? 0) + 1;
    });
  });
  const totalTodayRows = Object.values(todayStatusMap).reduce((s, v) => s + v, 0);
  const funnelSteps = [
    { label: "รายการวันนี้", key: "total", count: totalTodayRows },
    { label: "กำลังดำเนินการ", key: "in_progress", count: todayStatusMap.in_progress ?? 0 },
    { label: "รอโอน", key: "pending_transfer", count: todayStatusMap.pending_transfer ?? 0 },
    { label: "ปิดแล้ว", key: "closed", count: todayStatusMap.closed ?? 0 },
    { label: "หลุด", key: "lost", count: todayStatusMap.lost ?? 0 },
  ];
  const funnelMax = Math.max(totalTodayRows, 1);

  // ── Follow-up Pool ─────────────────────────────────────────────────────────
  const followUpObj: Record<string, number> = {};
  analyses.forEach((a) => {
    [...a.pendingTransferRows, ...a.followUpRows].forEach((r) => {
      const obj = parseNoteObjection(r.note) ?? "อื่นๆ";
      followUpObj[obj] = (followUpObj[obj] ?? 0) + 1;
    });
  });
  const rawPendingWithoutObj = analyses.reduce((s, a) => {
    return s + a.pendingTransferRows.filter((r) => !parseNoteObjection(r.note)).length;
  }, 0);
  if (rawPendingWithoutObj > 0) followUpObj["รอโอน"] = (followUpObj["รอโอน"] ?? 0) + rawPendingWithoutObj;
  const followUpPool = Object.entries(followUpObj).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const followUpMax = Math.max(...followUpPool.map(([, v]) => v), 1);

  // ── Pending Payment Watch ──────────────────────────────────────────────────
  const pendingByAgent = analyses
    .map((a) => ({ name: a.agentName, count: a.pendingTransferRows.length }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const pendingMax = Math.max(...pendingByAgent.map((a) => a.count), 1);

  // ── Cycling panels data ────────────────────────────────────────────────────
  const cyclingPanels: CyclePanel[] = [
    {
      id: "followup-pool",
      title: "Follow-up Pool",
      badge: `${teamPending + teamFollowUp} เคสค้างอยู่`,
      empty: "ไม่มีเคสค้าง",
      bars: followUpPool.map(([label, count], i) => ({
        label,
        value: String(count),
        pct: (count / followUpMax) * 100,
        color: (["#FF6B6B", "#FFBA49", "#58CEE8", "#87DE81", "#9BA8B5"] as const)[i],
      })),
    },
    {
      id: "pending-payment",
      title: "Pending Payment Watch",
      badge: `รอโอน ${teamPending} เคส`,
      empty: "ไม่มีรายการรอโอน",
      bars: pendingByAgent.map((a, i) => ({
        label: a.name,
        value: `${a.count} เคส`,
        pct: (a.count / pendingMax) * 100,
        color: (["#FF6B6B", "#FFBA49", "#58CEE8", "#87DE81", "#9BA8B5"] as const)[i] ?? "#9BA8B5",
      })),
    },
  ];

  // ── Objection Radar ────────────────────────────────────────────────────────
  const objMap: Record<string, number> = {};
  analyses.forEach((a) => Object.entries(a.objections).forEach(([k, v]) => {
    objMap[k] = (objMap[k] ?? 0) + v;
  }));
  const objections = Object.entries(objMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ── Agent Leaderboard ──────────────────────────────────────────────────────
  const sortedByToday = [...analyses].sort((a, b) => b.todaySales - a.todaySales);

  // ── Action Alerts ──────────────────────────────────────────────────────────
  const alerts: { level: "red" | "yellow" | "green"; text: string }[] = [];

  const expectedPace = teamTotalTarget > 0
    ? ((thaiHour - 8) / 10) * teamTotalTarget
    : 0;
  const paceDiff = teamTodaySales - expectedPace;
  if (paceDiff < 0 && thaiHour >= 9)
    alerts.push({ level: "red", text: `ยอดต่ำกว่า Pace ฿${Math.abs(Math.round(paceDiff)).toLocaleString()} — ต้องเร่ง` });
  else if (paceDiff > 0 && thaiHour >= 9)
    alerts.push({ level: "green", text: `ยอดสูงกว่า Pace ฿${Math.round(paceDiff).toLocaleString()} — ดีมาก` });

  if (teamPending >= 10)
    alerts.push({ level: "red", text: `รอโอนค้าง ${teamPending} เคส — เร่งปิดก่อนรับ Lead ใหม่` });
  else if (teamPending >= 5)
    alerts.push({ level: "yellow", text: `รอโอน ${teamPending} เคส — ควรติดตาม` });

  if (teamFollowUp >= 15)
    alerts.push({ level: "yellow", text: `Follow-up ค้าง ${teamFollowUp} เคส — เร่งตามลูกค้า` });

  if (objections[0] && objections[0][1] >= 3)
    alerts.push({ level: "yellow", text: `Objection "${objections[0][0]}" ${objections[0][1]} เคส — ใช้สคริปต์แก้` });

  if (teamPct >= 100)
    alerts.push({ level: "green", text: `ถึงเป้าแล้ว! ${teamPct}% — ยอดเกินเป้า ฿${(teamTodaySales - teamTotalTarget).toLocaleString()}` });

  if (alerts.length === 0)
    alerts.push({ level: "green", text: "สถานการณ์ปกติ — ทุกอย่างเป็นไปตามแผน" });

  // ── Podium datasets ────────────────────────────────────────────────────────
  type A = typeof analyses[number];
  const p = (a: A, display: string, sub: string): PodiumEntry =>
    ({ name: a.agentName, display, sub, avatarConfig: a.avatarConfig ?? null });

  const top3Sales: PodiumEntry[] = [...analyses]
    .sort((a, b) => b.todaySales - a.todaySales).slice(0, 3)
    .map((a) => p(a, `฿${a.todaySales.toLocaleString()}`, `${a.todayOrders} รายการ`));

  const top3Orders: PodiumEntry[] = [...analyses]
    .sort((a, b) => b.todayOrders - a.todayOrders).slice(0, 3)
    .map((a) => p(a, `${a.todayOrders} บิล`, `฿${a.todaySales.toLocaleString()}`));

  const top3Aov: PodiumEntry[] = [...analyses]
    .filter((a) => a.todayOrders > 0)
    .sort((a, b) => (b.todaySales / b.todayOrders) - (a.todaySales / a.todayOrders)).slice(0, 3)
    .map((a) => p(a, `฿${Math.round(a.todaySales / a.todayOrders).toLocaleString()}`, `${a.todayOrders} รายการ`));

  const prodMap: Record<string, { sales: number; orders: number }> = {};
  analyses.forEach((a) => a.todayRows.forEach((r) => {
    const key = r.product || "Other";
    if (!prodMap[key]) prodMap[key] = { sales: 0, orders: 0 };
    prodMap[key].sales += r.upsell + r.crm;
    prodMap[key].orders += 1;
  }));

  const top3Product: PodiumEntry[] = Object.entries(prodMap)
    .sort((a, b) => b[1].sales - a[1].sales).slice(0, 3)
    .map(([name, d]) => ({ name, display: `฿${d.sales.toLocaleString()}`, sub: `${d.orders} บิล` }));

  const top3FollowUp: PodiumEntry[] = [...analyses]
    .sort((a, b) => (b.statusCounts?.closed ?? 0) - (a.statusCounts?.closed ?? 0)).slice(0, 3)
    .map((a) => p(a, `${a.statusCounts?.closed ?? 0} ปิด`, `FU ${a.followUpRows.length} เคส`));

  // ── AI Command Summary ─────────────────────────────────────────────────────
  const paceWord = paceDiff >= 0 ? "สูงกว่า" : "ต่ำกว่า";
  const paceAmt = Math.abs(Math.round(paceDiff));
  const topObj = objections[0]?.[0] ?? null;
  const aiSummary = `ทีมทำยอดได้ ${teamPct}% ของเป้า${thaiHour >= 9 ? ` — ${paceWord} Pace ฿${paceAmt.toLocaleString()}` : ""}${teamPending > 0 ? ` · รอโอน ${teamPending} เคส` : ""
    }${topObj ? ` · Objection หลัก "${topObj}"` : ""}. Forecast สิ้นวัน ฿${forecast.toLocaleString()}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0F1117] flex flex-col p-2 gap-1.5">
      <RealtimeRefresh tables={["sales", "team_config"]} />

      {/* ── Row 1: Scoreboard ──────────────────────────────────────────── */}
      <MotionSection delay={0} className="flex-none grid grid-cols-6 gap-1.5">
        {/* Title + clock */}
        <div className="col-span-1 bg-[#1A1D27] border border-[#252836] rounded-xl px-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#9099A8] uppercase tracking-widest">War Room</div>
            <div className="text-[10px] text-[#60677A] leading-tight mt-0.5">{thaiDateLabel()}</div>
          </div>
          {/* Live pulse */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#87DE81] animate-pulse shrink-0" />
            <span className="text-[10px] font-bold text-[#87DE81] uppercase tracking-wider">LIVE</span>
          </div>
        </div>

        {/* Clock — own card */}
        <div className="col-span-1 bg-[#1A1D27] border border-[#252836] rounded-xl px-3 flex items-center justify-center">
          <LiveClock />
        </div>

        <ScoreCard label="% ถึงเป้า" value={`${teamPct}%`} sub={teamPct >= 100 ? "ถึงเป้าแล้ว!" : `ขาดอีก ฿${teamGap.toLocaleString()}`} accent={teamPct >= 80 ? "green" : teamPct >= 50 ? "cyan" : "red"} big />
        <ScoreCard label="ออเดอร์วันนี้" value={`${teamTodayOrders}`} sub="รายการ" accent="cyan" />
        <ScoreCard label="AOV" value={`฿${aov.toLocaleString()}`} sub="เฉลี่ยต่อบิล" accent="cyan" />
        <ScoreCard label="Forecast สิ้นวัน" value={`฿${forecast.toLocaleString()}`} sub={forecast >= teamTotalTarget ? "คาดว่าถึงเป้า" : "คาดว่าไม่ถึงเป้า"} accent={forecast >= teamTotalTarget ? "green" : "red"} />
      </MotionSection>

      {/* ── Daily Target Strip ─────────────────────────────────────────── */}
      <MotionSection delay={0.08} className="flex-none bg-[#1A1D27] border border-[#252836] rounded-xl px-6 py-2">
        <div className="flex items-center justify-center gap-3">
          <span className="text-[11px] font-bold text-[#9099A8] uppercase tracking-widest shrink-0">Daily Target</span>
          <div className="flex items-baseline gap-2 tabular-nums">
            <CountUpValue
              value={teamTodaySales}
              prefix="฿"
              duration={1200}
              className={`text-[36px] font-black leading-none ${teamPct >= 100 ? "text-[#87DE81]" : teamPct >= 70 ? "text-[#58CEE8]" : teamPct >= 40 ? "text-[#FFBA49]" : "text-[#FF6B6B]"}`}
            />
            <span className="text-[28px] font-black text-[#404050] leading-none">/</span>
            <span className="text-[36px] font-black text-[#F0F2F5] leading-none">
              ฿{teamTotalTarget.toLocaleString()}
            </span>
          </div>
          <span className={`text-[13px] font-bold shrink-0 ${teamPct >= 100 ? "text-[#87DE81]" : "text-[#60677A]"}`}>
            {teamPct >= 100 ? `+฿${(teamTodaySales - teamTotalTarget).toLocaleString()}` : `ขาดอีก ฿${teamGap.toLocaleString()}`}
          </span>
        </div>
      </MotionSection>

      {/* ── Row 2+3: Main body ─────────────────────────────────────────── */}
      <MotionSection delay={0.15} className="flex-1 grid grid-cols-12 gap-1.5 overflow-hidden min-h-0">

        {/* Left 9 columns */}
        <div className="col-span-9 flex flex-col gap-1.5 overflow-hidden min-h-0">

          {/* Charts row */}
          <div className="flex-1 grid grid-cols-12 gap-1.5 min-h-0 overflow-hidden">

            {/* Pace vs Target */}
            <div className="col-span-7 bg-[#1A1D27] border border-[#252836] rounded-xl p-3 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 flex-none">
                <span className="text-[13px] font-semibold text-[#F0F2F5]">Sales Pace vs Target</span>
                <div className="flex items-center gap-4 text-[11px] text-[#9099A8]">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0 border-t-2 border-dashed border-[#58CEE8]" />เป้า</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-[#87DE81]" />จริง</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0 border-t-2 border-dotted border-[#FFBA49]" />Forecast</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <svg viewBox={`0 0 ${pace.W} ${pace.H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                  {pace.yLabels.map((y, i) => (
                    <g key={i}>
                      <line x1={pace.pL} y1={y.y.toFixed(1)} x2={pace.W - pace.pR} y2={y.y.toFixed(1)} stroke="#252836" strokeWidth="0.8" />
                      <text x={pace.pL - 4} y={y.y + 3} textAnchor="end" fontSize="9" fill="#60677A">
                        {fmtK(y.val)}
                      </text>
                    </g>
                  ))}
                  {pace.xLabels.map((x, i) => (
                    <text key={i} x={x.x.toFixed(1)} y={pace.H - 6} textAnchor="middle" fontSize="9" fill="#60677A">{x.label}</text>
                  ))}
                  <polyline points={pace.pacePoints} fill="none" stroke="#58CEE8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
                  {pace.forecastPoints && (
                    <polyline points={pace.forecastPoints} fill="none" stroke="#FFBA49" strokeWidth="1.5" strokeDasharray="3 2" />
                  )}
                  {pace.actualPoints && (
                    <>
                      <polyline points={pace.actualPoints} fill="none" stroke="#87DE81" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <polygon
                        points={`${pace.pL},${pace.pT + pace.cH} ${pace.actualPoints} ${pace.pL + ((Math.min(thaiHour, pace.WORK_END) - pace.WORK_START) / (pace.WORK_END - pace.WORK_START)) * pace.cW},${pace.pT + pace.cH}`}
                        fill="#87DE81" opacity="0.1"
                      />
                    </>
                  )}
                  {pace.curX !== null && pace.curY !== null && (
                    <>
                      <line x1={pace.curX.toFixed(1)} y1={pace.pT} x2={pace.curX.toFixed(1)} y2={pace.pT + pace.cH} stroke="#F0F2F5" strokeWidth="1" strokeDasharray="2 2" opacity="0.2" />
                      <circle cx={pace.curX.toFixed(1)} cy={pace.curY.toFixed(1)} r="4" fill="#87DE81" stroke="#0F1117" strokeWidth="1.5" />
                    </>
                  )}
                </svg>
              </div>
            </div>

            {/* Hourly Sales / AOV cycling chart */}
            <HourlyCycleChart
              hourlyData={hourlyData}
              displayHours={displayHours}
              thaiHour={thaiHour}
              intervalMs={9000}
            />
          </div>

          {/* Funnel + Follow-up Pool row */}
          <div className="flex-none h-[28vh] grid grid-cols-2 gap-1.5">

            {/* Team Funnel */}
            <div className="bg-[#1A1D27] border border-[#252836] rounded-xl p-3 flex flex-col overflow-hidden">
              <span className="text-[12px] font-semibold text-[#F0F2F5] mb-2.5 flex-none">Team Funnel (วันนี้)</span>
              <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden">
                {funnelSteps.map((step, i) => {
                  const pct = funnelMax > 0 ? (step.count / funnelMax) * 100 : 0;
                  const colors = ["#58CEE8", "#FFBA49", "#FF6B6B", "#87DE81", "#60677A"];
                  return (
                    <div key={step.key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[11px] text-[#9099A8]">{step.label}</span>
                        <span className="text-[11px] font-semibold text-[#F0F2F5]">{step.count}</span>
                      </div>
                      <AnimatedBar pct={pct} color={colors[i]} delay={0.3 + i * 0.1} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cycling panel — Follow-up Pool / Pending Payment Watch / … */}
            <CyclingPanel panels={cyclingPanels} intervalMs={8000} />

          </div>
        </div>

        {/* Right 3 columns: Podium + AI */}
        <div className="col-span-3 flex flex-col gap-1.5 overflow-hidden min-h-0">

          <PodiumPanel
            topSales={top3Sales}
            topOrders={top3Orders}
            topAov={top3Aov}
            topProduct={top3Product}
            topFollowUp={top3FollowUp}
          />

          {/* AI Command Summary */}
          <div className="flex-none bg-gradient-to-br from-[#87DE81]/10 to-[#58CEE8]/10 border border-[#87DE81]/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#87DE81] to-[#58CEE8] flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span className="text-[12px] font-semibold text-[#F0F2F5]">AI Command</span>
            </div>
            <p className="text-[12px] text-[#D0D4DC] leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{aiSummary}</p>
          </div>

        </div>
      </MotionSection>

      {/* ── Bottom ticker ──────────────────────────────────────────────── */}
      <TickerBar items={alerts} />
    </div>
  );
}

// ─── Score Card ───────────────────────────────────────────────────────────────

function ScoreCard({ label, value, rawValue, sub, accent, big, hero }: {
  label: string; value: string; rawValue?: number; sub: string;
  accent: "green" | "cyan" | "red" | "yellow" | "default";
  big?: boolean; hero?: boolean;
}) {
  const valColor = {
    green: "text-[#87DE81]",
    cyan: "text-[#58CEE8]",
    red: "text-[#FF6B6B]",
    yellow: "text-[#FFBA49]",
    default: "text-[#F0F2F5]",
  }[accent];
  const dotColor = {
    green: "bg-[#87DE81]",
    cyan: "bg-[#58CEE8]",
    red: "bg-[#FF6B6B]",
    yellow: "bg-[#FFBA49]",
    default: "bg-[#404050]",
  }[accent];
  const borderAccent = hero ? {
    green: "border-[#87DE81]/50",
    cyan: "border-[#58CEE8]/50",
    red: "border-[#FF6B6B]/50",
    yellow: "border-[#FFBA49]/50",
    default: "border-[#252836]",
  }[accent] : "border-[#252836]";

  if (hero) {
    return (
      <div className={`col-span-2 bg-[#1A1D27] border-2 ${borderAccent} rounded-xl px-5 py-2 flex flex-col justify-center relative overflow-hidden`}>
        <div className={`absolute inset-0 opacity-5 ${accent === "green" ? "bg-[#87DE81]" : accent === "cyan" ? "bg-[#58CEE8]" : "bg-transparent"}`} />
        <div className="relative flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-[11px] text-[#9099A8] uppercase tracking-widest font-semibold">{label}</span>
        </div>
        <div className={`relative font-black leading-none text-[38px] tracking-tight mt-1 ${valColor}`}>
          {rawValue !== undefined
            ? <CountUpValue value={rawValue} prefix="฿" className={valColor} />
            : value}
        </div>
        <div className="relative text-[11px] text-[#9099A8] mt-1">{sub}</div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1D27] border border-[#252836] rounded-xl px-3 py-2 flex flex-col justify-center">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[10px] text-[#9099A8] uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className={`font-bold leading-none ${big ? "text-[22px]" : "text-[18px]"} ${valColor}`}>{value}</div>
      <div className="text-[10px] text-[#60677A] mt-0.5 truncate">{sub}</div>
    </div>
  );
}
