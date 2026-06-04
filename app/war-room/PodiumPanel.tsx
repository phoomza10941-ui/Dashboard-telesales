"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
export interface PodiumEntry {
  name: string;
  display: string;
  sub: string;
  rawValue?: number;
  avatarUrl?: string;
}

interface Props {
  topSales: PodiumEntry[];
  topOrders: PodiumEntry[];
  topAov: PodiumEntry[];
  topProduct: PodiumEntry[];
  topFollowUp: PodiumEntry[];
  topTalkTime: PodiumEntry[];
}

const TABS = [
  { key: "sales", label: "Top Sales" },
  { key: "orders", label: "Top Orders" },
  { key: "aov", label: "Top AOV" },
  { key: "product", label: "Top Product" },
  { key: "followup", label: "Top FU" },
  { key: "talktime", label: "Top Talk" },
] as const;

type TabKey = typeof TABS[number]["key"];

const PODIUM_COLOR = ["#F5A623", "#9BA8B5", "#C07A3A"] as const;
const PODIUM_FLEX = ["58%", "38%", "24%"] as const;
// display order: silver left (slot0), gold center (slot1), bronze right (slot2)
const SLOT_RANK = [1, 0, 2] as const;
const SLOT_DELAY = [0.15, 0, 0.3] as const;

function MedalIcon({ rank, size }: { rank: number; size: number }) {
  const colors = ["#F5A623", "#9BA8B5", "#C07A3A"];
  const c = colors[rank];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={c} opacity="0.25" />
      <circle cx="12" cy="12" r="8" fill={c} />
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="white">
        {rank + 1}
      </text>
    </svg>
  );
}

function TrophyIcon({ size }: { size: number }) {
  const G = "#F5A623";   // gold
  const S = "#FFD97A";   // shine
  const D = "#C07A1A";   // dark gold
  // 10×10 pixel grid, crispEdges for blocky pixel look
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges">
      <defs>
        <filter id="px-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.4" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>
      <g filter="url(#px-shadow)">
        {/* Cup top */}
        <rect x="2" y="0" width="6" height="1" fill={G} />
        {/* Cup upper row */}
        <rect x="1" y="1" width="8" height="1" fill={G} />
        {/* Cup body (rows 2–3) */}
        <rect x="2" y="2" width="6" height="2" fill={G} />
        {/* Left handle */}
        <rect x="0" y="2" width="1" height="2" fill={G} />
        {/* Right handle */}
        <rect x="9" y="2" width="1" height="2" fill={G} />
        {/* Handle shadow gaps (makes handles obvious) */}
        <rect x="1" y="2" width="1" height="2" fill={D} />
        <rect x="8" y="2" width="1" height="2" fill={D} />
        {/* Cup lower row */}
        <rect x="1" y="4" width="8" height="1" fill={G} />
        {/* Cup base edge */}
        <rect x="2" y="5" width="6" height="1" fill={D} />
        {/* Stem */}
        <rect x="4" y="6" width="2" height="2" fill={G} />
        {/* Base */}
        <rect x="1" y="8" width="8" height="1" fill={G} />
        <rect x="1" y="9" width="8" height="1" fill={D} />
        {/* Shine (top-left of cup) */}
        <rect x="2" y="1" width="2" height="1" fill={S} />
        <rect x="2" y="2" width="1" height="2" fill={S} />
        {/* Star pixel in cup centre */}
        <rect x="5" y="2" width="1" height="1" fill={S} />
      </g>
    </svg>
  );
}

const TAB_KEYS = TABS.map((t) => t.key) as TabKey[];

export default function PodiumPanel(props: Props) {
  const [active, setActive] = useState<TabKey>("sales");

  useEffect(() => {
    const id = setInterval(() => {
      setActive((cur) => {
        const idx = TAB_KEYS.indexOf(cur);
        return TAB_KEYS[(idx + 1) % TAB_KEYS.length];
      });
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const entries: PodiumEntry[] = {
    sales: props.topSales,
    orders: props.topOrders,
    aov: props.topAov,
    product: props.topProduct,
    followup: props.topFollowUp,
    talktime: props.topTalkTime,
  }[active] ?? [];

  const podiumEntries = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const podiumSlots = SLOT_RANK.map((rankIdx) => podiumEntries[rankIdx] ?? null);

  return (
    <div className="flex-1 bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl p-3 flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex-none mb-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-semibold text-[#000000]">Top Performers</span>
          <motion.span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#04D600]/15 text-[#04D600]"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            วันนี้
          </motion.span>
        </div>

        <div className="flex gap-1 flex-wrap">
          {TABS.map((t) => (
            <motion.button
              key={t.key}
              onClick={() => setActive(t.key)}
              whileTap={{ scale: 0.92 }}
              className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer ${active === t.key
                ? "bg-[#000000] text-[#FFFFFF]"
                : "bg-[#CECECE] text-[#646768] hover:bg-[#E4E4E4]"
                }`}
            >
              {t.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Podium ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          className="flex-1 flex items-end justify-center gap-2 px-1 min-h-0 overflow-hidden"
          style={{ minHeight: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {podiumEntries.length === 0 ? (
            <p className="text-[12px] text-[#646768] self-center">ยังไม่มีข้อมูล</p>
          ) : (
            podiumSlots.map((entry, slotIdx) => {
              const rank = SLOT_RANK[slotIdx];
              const delay = SLOT_DELAY[slotIdx];
              if (!entry) return <div key={slotIdx} className="flex-1" />;

              const avatarDisplayH = 40;

              return (
                <div key={`${active}-${slotIdx}`} className="flex flex-col items-center flex-1 h-full justify-end relative">
                  <motion.div
                    className="w-full rounded-t-xl flex items-center justify-center relative overflow-visible"
                    style={{ flex: `0 0 ${PODIUM_FLEX[rank]}`, backgroundColor: PODIUM_COLOR[rank] }}
                    initial={{ scaleY: 0, originY: 1 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <motion.span
                      className="text-white font-black"
                      style={{ fontSize: rank === 0 ? "34px" : "24px", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: delay + 0.5 }}
                    >
                      {rank + 1}
                    </motion.span>
                  </motion.div>

                  {/* Avatar + trophy badge floating just above the podium bar */}
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 z-20"
                    style={{ bottom: `calc(${PODIUM_FLEX[rank]} + 4px)` }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22, delay: delay + 0.45 }}
                  >
                    <div className="relative">
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.name}
                          className="rounded-full object-cover ring-2 ring-white"
                          style={{ width: avatarDisplayH, height: avatarDisplayH }}
                        />
                      ) : (
                        <div
                          className="rounded-full bg-[#022EE8]/20 flex items-center justify-center ring-2 ring-white"
                          style={{ width: avatarDisplayH, height: avatarDisplayH }}
                        >
                          <span className="text-[#022EE8] font-bold" style={{ fontSize: rank === 0 ? "16px" : "13px" }}>
                            {entry.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      {/* Trophy / medal badge on top-right of avatar */}
                      <motion.div
                        className="absolute -top-2 -right-2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 18, delay: delay + 0.7 }}
                      >
                        {rank === 0 ? (
                          <TrophyIcon size={22} />
                        ) : (
                          <MedalIcon rank={rank} size={18} />
                        )}
                      </motion.div>
                    </div>
                  </motion.div>

                  <motion.div
                    className="absolute left-0 right-0 text-center px-0.5 z-10 pointer-events-none"
                    style={{ bottom: `calc(${PODIUM_FLEX[rank]} + ${avatarDisplayH}px + 8px)` }}
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: delay + 0.7, ease: "easeOut" }}
                  >
                    <div
                      className="font-bold text-[#000000] leading-tight truncate text-center"
                      style={{ fontSize: rank === 0 ? "13px" : "11px", fontWeight: rank === 0 ? 900 : 700 }}
                    >
                      {entry.name}
                    </div>
                    <div
                      className="font-semibold leading-tight"
                      style={{
                        fontSize: rank === 0 ? "12px" : "10px",
                        color: rank === 0 ? "#E8920A" : rank === 1 ? "#7A8E9A" : "#A0622A",
                      }}
                    >
                      {entry.display}
                    </div>
                    <div className="text-[10px] text-[#646768]">{entry.sub}</div>
                  </motion.div>
                </div>
              );
            })
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Leaderboard (rank 4+) ───────────────────────────────────────── */}
      {restEntries.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`lb-${active}`}
            className="flex-none mt-2 pt-2 border-t border-[#7A7A7A]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {restEntries.map((entry, i) => {
              const rank = i + 4;
              const gap = podiumEntries[2]?.rawValue !== undefined && entry.rawValue !== undefined
                ? podiumEntries[2].rawValue - entry.rawValue
                : null;
              const isNext = i === 0;

              return (
                <motion.div
                  key={`${active}-lb-${i}`}
                  className={`flex items-center gap-2 px-1.5 py-[5px] rounded-lg mb-0.5 ${isNext ? "bg-[#CECECE]/70" : ""}`}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.6 + i * 0.07, ease: "easeOut" }}
                >
                  {/* Rank badge */}
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${isNext ? "bg-[#FFBA49]/20 text-[#FFBA49]" : "bg-[#CECECE] text-[#858889]"
                    }`}>
                    {rank}
                  </span>

                  {/* Name */}
                  <span className={`flex-1 text-[11px] font-semibold truncate ${isNext ? "text-[#5A5D5E]" : "text-[#646768]"}`}>
                    {entry.name}
                  </span>

                  {/* Value */}
                  <span className={`text-[11px] font-black shrink-0 tabular-nums ${isNext ? "text-[#000000]" : "text-[#646768]"}`}>
                    {entry.display}
                  </span>

                  {/* Gap to podium for the next-in-line only */}
                  {isNext && gap !== null && gap > 0 && (
                    <span className="text-[9px] font-bold text-[#FFBA49]/80 shrink-0 whitespace-nowrap">
                      -{active === "talktime"
                        ? gap >= 3600 ? `${Math.floor(gap / 3600)}h${Math.floor((gap % 3600) / 60)}m` : `${Math.floor(gap / 60)}m`
                        : gap >= 1000 ? `฿${Math.round(gap / 1000)}k` : `฿${gap}`}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
