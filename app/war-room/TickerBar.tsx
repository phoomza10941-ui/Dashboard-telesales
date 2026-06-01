"use client";

import { useRef, useEffect, useState } from "react";

type TickerItem = {
  level: "red" | "yellow" | "green";
  text: string;
};

const DOT: Record<TickerItem["level"], string> = {
  red: "bg-[#FF6B6B]",
  yellow: "bg-[#FFBA49]",
  green: "bg-[#87DE81]",
};

const TEXT: Record<TickerItem["level"], string> = {
  red: "text-[#FF6B6B]",
  yellow: "text-[#FFBA49]",
  green: "text-[#87DE81]",
};

export default function TickerBar({ items }: { items: TickerItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(30);

  const copies = Math.max(Math.ceil(4 / Math.max(items.length, 1)), 1);
  const oneSet = Array.from({ length: copies }, () => items).flat();
  const track = [...oneSet, ...oneSet];

  useEffect(() => {
    if (!trackRef.current) return;
    const oneSetWidth = trackRef.current.scrollWidth / 2;
    setDuration(Math.max(oneSetWidth / 70, 8));
  }, [items]);

  return (
    <div className="flex-none bg-[#1A1D27] border-t border-[#252836] h-9 flex items-center overflow-hidden">
      <div className="flex-none flex items-center gap-2 px-4 border-r border-[#252836] h-full shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#87DE81] animate-pulse" />
        <span className="text-[11px] font-bold text-[#9099A8] uppercase tracking-widest whitespace-nowrap">
          Live Alerts
        </span>
      </div>

      <div className="flex-1 overflow-hidden min-w-0 h-full flex items-center">
        <div
          ref={trackRef}
          className="flex items-center whitespace-nowrap will-change-transform"
          style={{ animation: `warroom-ticker ${duration}s linear infinite` }}
        >
          {track.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-6">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[item.level]}`} />
              <span className={`text-[12px] font-semibold ${TEXT[item.level]}`}>{item.text}</span>
              <span className="text-[#404050] mx-2">|</span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes warroom-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
