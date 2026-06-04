"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function DaySwitcher({
  selectedDate,
  todayISO,
}: {
  selectedDate: string;
  todayISO: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(date: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", date);
    params.set("view", "daily");
    router.push(`?${params.toString()}`);
  }

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const iso = d.toISOString().split("T")[0];
    if (iso <= todayISO) go(iso);
  }

  const isToday = selectedDate >= todayISO;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shiftDay(-1)}
        className="w-7 h-7 rounded-lg border border-[#E8E8E8] flex items-center justify-center text-[#8B8E8F] hover:bg-[#F7F7F7] transition-colors"
        aria-label="วันก่อน"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <input
        type="date"
        value={selectedDate}
        max={todayISO}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="text-[13px] font-semibold text-[#3D3D3D] bg-transparent border-none outline-none cursor-pointer"
      />

      <button
        onClick={() => shiftDay(1)}
        disabled={isToday}
        className="w-7 h-7 rounded-lg border border-[#E8E8E8] flex items-center justify-center text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="วันถัดไป"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
