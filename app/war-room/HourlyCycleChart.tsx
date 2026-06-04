"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fmtCompact } from "@/lib/format";

interface HourlyPoint {
  hour: number;
  sales: number;
  orders: number;
}

// ── Hourly Sales Bar Chart ─────────────────────────────────────────────────────

function HourlySalesChart({
  data,
  displayHours,
  thaiHour,
}: {
  data: HourlyPoint[];
  displayHours: number[];
  thaiHour: number;
}) {
  const byHour = Object.fromEntries(data.map((d) => [d.hour, d]));
  const maxSales = Math.max(...displayHours.map((h) => byHour[h]?.sales ?? 0), 1);

  return (
    <div className="flex-1 flex items-end gap-1.5 min-h-0 pb-1">
      {displayHours.map((h) => {
        const s = byHour[h]?.sales ?? 0;
        const pct = Math.max((s / maxSales) * 100, s > 0 ? 3 : 0);
        const isCurrent = h === thaiHour;
        const isFuture = h > thaiHour;
        const barColor = isCurrent ? "#04D600" : isFuture ? "#6B6D6F" : "#022EE8";
        const barOpacity = isCurrent ? 1 : isFuture ? 0.4 : 0.7;
        return (
          <div key={h} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <span className={`text-[10px] ${isCurrent ? "text-[#04D600] font-bold" : "text-[#646768]"}`}>
              {isCurrent && s === 0 ? "·" : s > 0 ? fmtCompact(s) : ""}
            </span>
            <div className="w-full flex items-end" style={{ height: "80%" }}>
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: isFuture ? "100%" : `${pct}%`,
                  minHeight: s > 0 ? "2px" : isFuture ? "0" : "0",
                  backgroundColor: barColor,
                  opacity: isFuture ? 0.12 : barOpacity,
                  border: isFuture ? "1px dashed #6B6D6F" : "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <span className={`text-[10px] ${isCurrent ? "text-[#04D600] font-bold" : isFuture ? "text-[#6B6D6F]" : "text-[#858889]"}`}>{h}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── AOV Line Chart (SVG) ───────────────────────────────────────────────────────

function AovLineChart({
  data,
  displayHours,
  thaiHour,
}: {
  data: HourlyPoint[];
  displayHours: number[];
  thaiHour: number;
}) {
  const byHour = Object.fromEntries(data.map((d) => [d.hour, d]));

  const aovPoints = displayHours.map((h) => {
    const d = byHour[h];
    return d && d.orders > 0 ? Math.round(d.sales / d.orders) : null;
  });

  const validAovs = aovPoints.filter((v): v is number => v !== null);
  const maxAov = Math.max(...validAovs, 1);
  const minAov = Math.min(...validAovs, 0);
  const range = Math.max(maxAov - minAov, 1);

  const W = 320, H = 120;
  const pL = 36, pR = 8, pT = 12, pB = 24;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const n = displayHours.length;
  const xOf = (i: number) => pL + (i / (n - 1)) * cW;
  const yOf = (v: number) => pT + cH - ((v - minAov) / range) * cH;

  // Build polyline of valid consecutive points
  const segments: { x: number; y: number; hour: number; aov: number }[][] = [];
  let seg: { x: number; y: number; hour: number; aov: number }[] = [];
  displayHours.forEach((h, i) => {
    const aov = aovPoints[i];
    if (aov !== null) {
      seg.push({ x: xOf(i), y: yOf(aov), hour: h, aov });
    } else {
      if (seg.length >= 2) segments.push(seg);
      seg = [];
    }
  });
  if (seg.length >= 2) segments.push(seg);

  // Area fill for each segment
  const areaPath = (pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return "";
    const base = pT + cH;
    return `M ${pts[0].x},${base} L ${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} L ${pts[pts.length - 1].x},${base} Z`;
  };

  // Y axis labels
  const yTicks = [0, 0.5, 1].map((p) => ({
    val: Math.round(minAov + p * range),
    y: yOf(minAov + p * range),
  }));

  const allDots = displayHours.map((h, i) => ({
    h,
    i,
    aov: aovPoints[i],
    isCurrent: h === thaiHour,
    isFuture: h > thaiHour,
  })).filter((d) => d.aov !== null);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pL} y1={t.y.toFixed(1)} x2={W - pR} y2={t.y.toFixed(1)} stroke="#7A7A7A" strokeWidth="0.8" />
            <text x={pL - 3} y={t.y + 3.5} textAnchor="end" fontSize="8.5" fill="#858889">
              {fmtCompact(t.val)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {displayHours.map((h, i) => (
          <text key={h} x={xOf(i).toFixed(1)} y={H - 5} textAnchor="middle" fontSize="8.5"
            fill={h === thaiHour ? "#04D600" : h > thaiHour ? "#6B6D6F" : "#858889"}
            fontWeight={h === thaiHour ? "bold" : "normal"}>
            {h}
          </text>
        ))}

        {/* Area + line per segment */}
        {segments.map((pts, si) => (
          <g key={si}>
            <path d={areaPath(pts)} fill="#022EE8" opacity="0.08" />
            <polyline
              points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke="#022EE8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {/* Dots */}
        {allDots.map((d) => (
          <g key={d.h} opacity={d.isFuture ? 0.35 : 1}>
            <circle
              cx={xOf(d.i).toFixed(1)}
              cy={yOf(d.aov!).toFixed(1)}
              r={d.isCurrent ? "4.5" : "3"}
              fill={d.isCurrent ? "#04D600" : d.isFuture ? "#6B6D6F" : "#022EE8"}
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            {d.isCurrent && (
              <circle
                cx={xOf(d.i).toFixed(1)}
                cy={yOf(d.aov!).toFixed(1)}
                r="7"
                fill="none"
                stroke="#04D600"
                strokeWidth="1"
                opacity="0.35"
              />
            )}
          </g>
        ))}

        {/* Tooltip labels above dots for current */}
        {allDots.filter((d) => d.isCurrent).map((d) => (
          <text key={"lbl-" + d.h}
            x={xOf(d.i).toFixed(1)}
            y={(yOf(d.aov!) - 9).toFixed(1)}
            textAnchor="middle"
            fontSize="9"
            fill="#04D600"
            fontWeight="bold">
            ฿{d.aov!.toLocaleString()}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Cycling wrapper ────────────────────────────────────────────────────────────

export default function HourlyCycleChart({
  hourlyData,
  displayHours,
  thaiHour,
  intervalMs = 9000,
}: {
  hourlyData: HourlyPoint[];
  displayHours: number[];
  thaiHour: number;
  intervalMs?: number;
}) {
  const [view, setView] = useState<0 | 1>(0); // 0 = sales, 1 = aov

  useEffect(() => {
    const id = setInterval(() => setView((v) => (v === 0 ? 1 : 0)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const titles = ["ยอดรายชั่วโมง", "AOV รายชั่วโมง"];
  const subtitles = ["ยอดขาย (฿) แต่ละชั่วโมง", "ค่าเฉลี่ยต่อบิล (฿) แต่ละชั่วโมง"];

  return (
    <div className="col-span-5 bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl p-3 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 flex-none">
        <div className="flex flex-col gap-0">
          <AnimatePresence mode="wait">
            <motion.span
              key={view}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.3 }}
              className="text-[13px] font-semibold text-[#000000] leading-tight"
            >
              {titles[view]}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait">
            <motion.span
              key={"sub-" + view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="text-[10px] text-[#858889] leading-tight"
            >
              {subtitles[view]}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center gap-1 shrink-0">
          {[0, 1].map((i) => (
            <button
              key={i}
              onClick={() => setView(i as 0 | 1)}
              className={`rounded-full transition-all duration-300 ${
                i === view
                  ? "w-3 h-1.5 bg-[#022EE8]"
                  : "w-1.5 h-1.5 bg-[#6B6D6F] hover:bg-[#858889]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Chart area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.35 }}
          className="flex-1 flex flex-col min-h-0"
        >
          {view === 0 ? (
            <HourlySalesChart data={hourlyData} displayHours={displayHours} thaiHour={thaiHour} />
          ) : (
            <AovLineChart data={hourlyData} displayHours={displayHours} thaiHour={thaiHour} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
