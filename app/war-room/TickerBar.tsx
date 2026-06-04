"use client";

import { useRef, useEffect, useState } from "react";

type TickerItem = {
  level: "red" | "yellow" | "green";
  text: string;
};

const DOT: Record<TickerItem["level"], string> = {
  red: "bg-[#BD0404]",
  yellow: "bg-[#FFBA49]",
  green: "bg-[#04D600]",
};

const TEXT: Record<TickerItem["level"], string> = {
  red: "text-[#BD0404]",
  yellow: "text-[#FFBA49]",
  green: "text-[#04D600]",
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
    <div className="flex-none bg-[#FFFFFF] border-t border-[#7A7A7A] h-9 flex items-center overflow-hidden">
      <div className="flex-none flex items-center gap-2 px-4 border-r border-[#7A7A7A] h-full shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#04D600] animate-pulse" />
        <span className="text-[11px] font-bold text-[#646768] uppercase tracking-widest whitespace-nowrap">
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
              <span className="text-[#5C5E60] mx-2">|</span>
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
