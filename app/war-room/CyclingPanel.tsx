"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface CycleBar {
  label: string;
  value: string;
  pct: number;
  color: string;
}

export interface CyclePanel {
  id: string;
  title: string;
  badge?: string;
  empty?: string;
  bars: CycleBar[];
}

export default function CyclingPanel({
  panels,
  intervalMs = 8000,
}: {
  panels: CyclePanel[];
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = (nextIdx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIdx(nextIdx);
    if (panels.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % panels.length),
      intervalMs,
    );
  };

  useEffect(() => {
    if (panels.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % panels.length),
      intervalMs,
    );
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [panels.length, intervalMs]);

  const panel = panels[idx];

  return (
    <div className="bg-[#FFFFFF] border border-[#7A7A7A] rounded-xl p-3 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 flex-none">
        <AnimatePresence mode="wait">
          <motion.span
            key={panel.id + "-title"}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.22 }}
            className="text-[12px] font-semibold text-[#000000]"
          >
            {panel.title}
          </motion.span>
        </AnimatePresence>

        <div className="flex items-center gap-2 shrink-0">
          {panel.badge && (
            <AnimatePresence mode="wait">
              <motion.span
                key={panel.id + "-badge"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] text-[#646768]"
              >
                {panel.badge}
              </motion.span>
            </AnimatePresence>
          )}

          {/* Dot indicators */}
          {panels.length > 1 && (
            <div className="flex items-center gap-1">
              {panels.map((_, i) => (
                <button
                  key={i}
                  onClick={() => resetTimer(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === idx
                      ? "w-3 h-1.5 bg-[#022EE8]"
                      : "w-1.5 h-1.5 bg-[#6B6D6F] hover:bg-[#858889]"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={panel.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.28 }}
            className="h-full flex flex-col justify-center gap-1.5"
          >
            {panel.bars.length === 0 ? (
              <p className="text-[11px] text-[#646768] text-center">{panel.empty ?? "ไม่มีข้อมูล"}</p>
            ) : (
              panel.bars.map((bar) => (
                <div key={bar.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[11px] text-[#646768] truncate max-w-[75%]">{bar.label}</span>
                    <span className="text-[11px] font-semibold text-[#000000]">{bar.value}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#C4C4C4] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${bar.pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: bar.color }}
                    />
                  </div>
                </div>
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
