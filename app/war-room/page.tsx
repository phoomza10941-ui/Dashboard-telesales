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
import { getTalkTimeByAgentSafe } from "@/lib/oreka";
import { fmtCompact, fmtPct } from "@/lib/format";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [analyses, agentTargets, teamTarget, hourlyData, talkTimeResult] = await Promise.all([
    getAllAgentsAnalysis(),
    getAgentsWithTargets(),
    getDailyTarget(),
    getTodayHourlySales(),
    getTalkTimeByAgentSafe(),
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
  const displayHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

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
        color: (["#BD0404", "#FFBA49", "#022EE8", "#04D600", "#9BA8B5"] as const)[i],
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
        color: (["#BD0404", "#FFBA49", "#022EE8", "#04D600", "#9BA8B5"] as const)[i] ?? "#9BA8B5",
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
    ({ name: a.agentName, display, sub, avatarUrl: a.avatarUrl });

  const top3Sales: PodiumEntry[] = [...analyses]
    .sort((a, b) => b.todaySales - a.todaySales).slice(0, 8)
    .map((a) => ({ ...p(a, `฿${a.todaySales.toLocaleString()}`, `${a.todayOrders} รายการ`), rawValue: a.todaySales }));

  const top3Orders: PodiumEntry[] = [...analyses]
    .sort((a, b) => b.todayOrders - a.todayOrders).slice(0, 8)
    .map((a) => ({ ...p(a, `${a.todayOrders} บิล`, `฿${a.todaySales.toLocaleString()}`), rawValue: a.todayOrders }));

  const top3Aov: PodiumEntry[] = [...analyses]
    .filter((a) => a.todayOrders > 0)
    .sort((a, b) => (b.todaySales / b.todayOrders) - (a.todaySales / a.todayOrders)).slice(0, 8)
    .map((a) => ({ ...p(a, `฿${Math.round(a.todaySales / a.todayOrders).toLocaleString()}`, `${a.todayOrders} รายการ`), rawValue: Math.round(a.todaySales / a.todayOrders) }));

  const prodMap: Record<string, { sales: number; orders: number }> = {};
  analyses.forEach((a) => a.todayRows.forEach((r) => {
    const key = r.product || "Other";
    if (!prodMap[key]) prodMap[key] = { sales: 0, orders: 0 };
    prodMap[key].sales += r.upsell + r.crm;
    prodMap[key].orders += 1;
  }));

  const top3Product: PodiumEntry[] = Object.entries(prodMap)
    .sort((a, b) => b[1].sales - a[1].sales).slice(0, 8)
    .map(([name, d]) => ({ name, display: `฿${d.sales.toLocaleString()}`, sub: `${d.orders} บิล`, rawValue: d.sales }));

  const top3FollowUp: PodiumEntry[] = [...analyses]
    .sort((a, b) => (b.statusCounts?.closed ?? 0) - (a.statusCounts?.closed ?? 0)).slice(0, 8)
    .map((a) => ({ ...p(a, `${a.statusCounts?.closed ?? 0} ปิด`, `FU ${a.followUpRows.length} เคส`), rawValue: a.statusCounts?.closed ?? 0 }));

  function fmtTalkTime(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
  const top3TalkTime: PodiumEntry[] = (talkTimeResult.data ?? [])
    .filter((a) => a.totalSeconds > 0 && (a.nickname ?? ""))
    .slice(0, 8)
    .map((a) => ({
      name: a.nickname ?? a.orekaName ?? a.orekaExt,
      display: fmtTalkTime(a.totalSeconds),
      sub: `${a.callCount} สาย`,
      rawValue: a.totalSeconds,
    }));

  // ── AI Command Summary ─────────────────────────────────────────────────────
  const paceWord = paceDiff >= 0 ? "สูงกว่า" : "ต่ำกว่า";
  const paceAmt = Math.abs(Math.round(paceDiff));
  const topObj = objections[0]?.[0] ?? null;
  const aiSummary = `ทีมทำยอดได้ ${teamPct}% ของเป้า${thaiHour >= 9 ? ` — ${paceWord} Pace ฿${paceAmt.toLocaleString()}` : ""}${teamPending > 0 ? ` · รอโอน ${teamPending} เคส` : ""
    }${topObj ? ` · Objection หลัก "${topObj}"` : ""}. Forecast สิ้นวัน ฿${forecast.toLocaleString()}`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#E0E0E2] flex flex-col p-2 gap-1.5">
      <RealtimeRefresh tables={["sales", "team_config"]} />

      {/* ── Row 1: Scoreboard ──────────────────────────────────────────── */}
      <MotionSection delay={0} className="flex-none grid grid-cols-6 gap-1.5">
        {/* Title + clock */}
        <div className="col-span-1 bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl px-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#000000] uppercase tracking-widest">War Room</div>
            <div className="text-[10px] text-[#858889] leading-tight mt-0.5">{thaiDateLabel()}</div>
          </div>
          {/* Live pulse */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#04D600] animate-pulse shrink-0" />
            <span className="text-[10px] font-bold text-[#04D600] uppercase tracking-wider">LIVE</span>
          </div>
        </div>

        {/* Clock — own card */}
        <div className="col-span-1 bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl px-3 flex items-center justify-center">
          <LiveClock />
        </div>

        <ScoreCard label="% ถึงเป้า" value={fmtPct(teamPct)} sub={teamPct >= 100 ? "ถึงเป้าแล้ว!" : `ขาดอีก ฿${teamGap.toLocaleString()}`} accent={teamPct >= 80 ? "green" : teamPct >= 50 ? "cyan" : "red"} big />
        <ScoreCard label="ออเดอร์วันนี้" value={`${teamTodayOrders}`} sub="รายการ" accent="cyan" />
        <ScoreCard label="AOV" value={`฿${fmtCompact(aov)}`} sub="เฉลี่ยต่อบิล" accent="cyan" />
        <ScoreCard label="Forecast สิ้นวัน" value={`฿${fmtCompact(forecast)}`} sub={forecast >= teamTotalTarget ? "คาดว่าถึงเป้า" : "คาดว่าไม่ถึงเป้า"} accent={forecast >= teamTotalTarget ? "green" : "red"} />
      </MotionSection>

      {/* ── Daily Target Strip ─────────────────────────────────────────── */}
      <MotionSection delay={0.08} className="flex-none bg-[#FFFFFF] border-2 border-[#7A7A7A] rounded-xl px-8 py-4 relative overflow-hidden">
        {/* Performance glow */}
        <div className={`absolute inset-0 opacity-[0.10] ${teamPct >= 100 ? "bg-[#04D600]" : teamPct >= 70 ? "bg-[#022EE8]" : teamPct >= 40 ? "bg-[#FFBA49]" : "bg-[#BD0404]"}`} />
        {/* Top accent line */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] ${teamPct >= 100 ? "bg-[#04D600]" : teamPct >= 70 ? "bg-[#022EE8]" : teamPct >= 40 ? "bg-[#FFBA49]" : "bg-[#BD0404]"}`} />
        <div className="relative flex items-center justify-center gap-6">
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[13px] font-bold text-[#646768] uppercase tracking-widest">Daily Target</span>
            <span className={`text-[22px] font-black tabular-nums ${teamPct >= 100 ? "text-[#04D600]" : teamPct >= 70 ? "text-[#022EE8]" : teamPct >= 40 ? "text-[#FFBA49]" : "text-[#BD0404]"}`}>
              {teamPct}%
            </span>
          </div>
          <div className="w-px h-12 bg-[#C4C4C4] shrink-0" />
          <div className="flex items-baseline gap-3 tabular-nums">
            <CountUpValue
              value={teamTodaySales}
              prefix="฿"
              duration={1200}
              className={`text-[52px] font-black leading-none tracking-tight ${teamPct >= 100 ? "text-[#04D600]" : teamPct >= 70 ? "text-[#022EE8]" : teamPct >= 40 ? "text-[#FFBA49]" : "text-[#BD0404]"}`}
            />
            <span className="text-[40px] font-black text-[#535353] leading-none">/</span>
            <span className="text-[52px] font-black text-[#000000] leading-none tracking-tight">
              ฿{fmtCompact(teamTotalTarget)}
            </span>
          </div>
          <div className="w-px h-12 bg-[#C4C4C4] shrink-0" />
          {/* Gap / surplus badge */}
          <div className={`shrink-0 px-4 py-2 rounded-xl text-[18px] font-black ${teamPct >= 100
              ? "bg-[#04D600]/20 text-[#04D600] border-2 border-[#04D600]/40"
              : teamGap > 0
                ? "bg-[#BD0404]/15 text-[#BD0404] border-2 border-[#BD0404]/30"
                : "bg-[#646768]/10 text-[#646768]"
            }`}>
            {teamPct >= 100
              ? `+฿${fmtCompact(teamTodaySales - teamTotalTarget)}`
              : `ขาดอีก ฿${fmtCompact(teamGap)}`}
          </div>
        </div>
        {/* Progress bar */}
        <div className="relative mt-3 h-[8px] bg-[#C4C4C4] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${teamPct >= 100 ? "bg-[#04D600]" : teamPct >= 70 ? "bg-[#022EE8]" : teamPct >= 40 ? "bg-[#FFBA49]" : "bg-[#BD0404]"}`}
            style={{ width: `${Math.min(teamPct, 100)}%` }}
          />
        </div>
      </MotionSection>

      {/* ── Row 2+3: Main body ─────────────────────────────────────────── */}
      <MotionSection delay={0.15} className="flex-1 grid grid-cols-12 gap-1.5 overflow-hidden min-h-0">

        {/* Left 9 columns */}
        <div className="col-span-9 flex flex-col gap-1.5 overflow-hidden min-h-0">

          {/* Charts row */}
          <div className="flex-1 grid grid-cols-12 gap-1.5 min-h-0 overflow-hidden">

            {/* Pace vs Target */}
            <div className="col-span-7 bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl p-3 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 flex-none">
                <span className="text-[13px] font-semibold text-[#000000] flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[#04D600] inline-block" />
                  Sales Pace vs Target
                </span>
                <div className="flex items-center gap-4 text-[11px] text-[#646768]">
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0 border-t-2 border-dashed border-[#022EE8]" />เป้า</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0.5 bg-[#04D600]" />จริง</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block w-5 h-0 border-t-2 border-dotted border-[#FFBA49]" />Forecast</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <svg viewBox={`0 0 ${pace.W} ${pace.H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
                  {pace.yLabels.map((y, i) => (
                    <g key={i}>
                      <line x1={pace.pL} y1={y.y.toFixed(1)} x2={pace.W - pace.pR} y2={y.y.toFixed(1)} stroke="#7A7A7A" strokeWidth="0.8" />
                      <text x={pace.pL - 4} y={y.y + 3} textAnchor="end" fontSize="9" fill="#858889">
                        {fmtCompact(y.val)}
                      </text>
                    </g>
                  ))}
                  {pace.xLabels.map((x, i) => (
                    <text key={i} x={x.x.toFixed(1)} y={pace.H - 6} textAnchor="middle" fontSize="9" fill="#858889">{x.label}</text>
                  ))}
                  <polyline points={pace.pacePoints} fill="none" stroke="#022EE8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
                  {pace.forecastPoints && (
                    <polyline points={pace.forecastPoints} fill="none" stroke="#FFBA49" strokeWidth="1.5" strokeDasharray="3 2" />
                  )}
                  {pace.actualPoints && (
                    <>
                      <polyline points={pace.actualPoints} fill="none" stroke="#04D600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <polygon
                        points={`${pace.pL},${pace.pT + pace.cH} ${pace.actualPoints} ${pace.pL + ((Math.min(thaiHour, pace.WORK_END) - pace.WORK_START) / (pace.WORK_END - pace.WORK_START)) * pace.cW},${pace.pT + pace.cH}`}
                        fill="#04D600" opacity="0.1"
                      />
                    </>
                  )}
                  {pace.curX !== null && pace.curY !== null && (
                    <>
                      <line x1={pace.curX.toFixed(1)} y1={pace.pT} x2={pace.curX.toFixed(1)} y2={pace.pT + pace.cH} stroke="#000000" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
                      <circle cx={pace.curX.toFixed(1)} cy={pace.curY.toFixed(1)} r="5" fill="#04D600" stroke="#FFFFFF" strokeWidth="2" />
                      <text
                        x={Math.min(Number(pace.curX.toFixed(1)) + 6, pace.W - pace.pR - 28)}
                        y={(Number(pace.curY.toFixed(1)) - 8).toFixed(1)}
                        fontSize="9.5"
                        fill="#04D600"
                        fontWeight="bold"
                      >
                        ฿{fmtCompact(pace.currentCum)}
                      </text>
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
            <div className="bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl p-3 flex flex-col overflow-hidden">
              <span className="text-[12px] font-semibold text-[#000000] mb-2.5 flex-none flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-[#022EE8] inline-block" />
                Team Funnel (วันนี้)
              </span>
              <div className="flex-1 flex flex-col justify-center gap-1.5 overflow-hidden">
                {funnelSteps.map((step, i) => {
                  const pct = funnelMax > 0 ? (step.count / funnelMax) * 100 : 0;
                  const colors = ["#022EE8", "#FFBA49", "#BD0404", "#04D600", "#5C5E60"];
                  return (
                    <div key={step.key}>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[11px] text-[#646768]">{step.label}</span>
                        <span className="text-[11px] font-semibold text-[#000000]">{step.count}</span>
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
            topTalkTime={top3TalkTime}
          />

          {/* AI Command Summary */}
          <div className="flex-none bg-gradient-to-br from-[#04D600]/10 to-[#022EE8]/10 border border-[#04D600]/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#04D600] to-[#022EE8] flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span className="text-[12px] font-semibold text-[#000000]">AI Command</span>
            </div>
            <p className="text-[12px] text-[#5A5D5E] leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{aiSummary}</p>
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
    green: "text-[#04D600]",
    cyan: "text-[#022EE8]",
    red: "text-[#BD0404]",
    yellow: "text-[#FFBA49]",
    default: "text-[#000000]",
  }[accent];
  const dotColor = {
    green: "bg-[#04D600]",
    cyan: "bg-[#022EE8]",
    red: "bg-[#BD0404]",
    yellow: "bg-[#FFBA49]",
    default: "bg-[#6B6D6F]",
  }[accent];
  const borderAccent = hero ? {
    green: "border-[#04D600]/50",
    cyan: "border-[#022EE8]/50",
    red: "border-[#BD0404]/50",
    yellow: "border-[#FFBA49]/50",
    default: "border-[#7A7A7A]",
  }[accent] : "border-[#7A7A7A]";

  const accentBar = {
    green: "bg-[#04D600]",
    cyan: "bg-[#022EE8]",
    red: "bg-[#BD0404]",
    yellow: "bg-[#FFBA49]",
    default: "bg-[#6B6D6F]",
  }[accent];

  const bgGlow = {
    green: "from-[#04D600]/10",
    cyan: "from-[#022EE8]/10",
    red: "from-[#BD0404]/10",
    yellow: "from-[#FFBA49]/10",
    default: "from-transparent",
  }[accent];

  if (hero) {
    return (
      <div className={`col-span-2 bg-gradient-to-b ${bgGlow} to-[#FFFFFF] border-2 ${borderAccent} rounded-xl px-5 py-2 flex flex-col justify-center relative overflow-hidden`}>
        <div className="relative flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
          <span className="text-[11px] text-[#646768] uppercase tracking-widest font-semibold">{label}</span>
        </div>
        <div className={`relative font-black leading-none text-[38px] tracking-tight mt-1 ${valColor}`}>
          {rawValue !== undefined
            ? <CountUpValue value={rawValue} prefix="฿" className={valColor} />
            : value}
        </div>
        <div className="relative text-[11px] text-[#646768] mt-1">{sub}</div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gradient-to-b ${bgGlow} to-[#FFFFFF] border border-[#7A7A7A] rounded-xl px-3 py-2 flex flex-col justify-center overflow-hidden`}>
      {/* Colored top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accentBar} rounded-t-xl`} />
      <div className="flex items-center gap-1.5 mb-0.5 mt-1">
        <span className="text-[10px] text-[#646768] uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className={`font-black leading-none ${big ? "text-[24px]" : "text-[20px]"} ${valColor}`}>{value}</div>
      <div className="text-[10px] text-[#858889] mt-0.5 truncate">{sub}</div>
    </div>
  );
}
