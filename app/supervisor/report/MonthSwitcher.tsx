"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function MonthSwitcher({
  monthKeys,
  selectedKey,
  labels,
}: {
  monthKeys: string[];
  selectedKey: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idx = monthKeys.indexOf(selectedKey);

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", key);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => idx > 0 && go(monthKeys[idx - 1])}
        disabled={idx <= 0}
        className="w-7 h-7 rounded-lg border border-[#E8E8E8] flex items-center justify-center text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="เดือนก่อน"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M7.5 2L4 6l3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <select
        value={selectedKey}
        onChange={(e) => go(e.target.value)}
        className="text-[13px] font-semibold text-[#3D3D3D] bg-transparent border-none outline-none cursor-pointer appearance-none px-1"
      >
        {monthKeys.map((k) => (
          <option key={k} value={k}>{labels[k] ?? k}</option>
        ))}
      </select>

      <button
        onClick={() => idx < monthKeys.length - 1 && go(monthKeys[idx + 1])}
        disabled={idx >= monthKeys.length - 1}
        className="w-7 h-7 rounded-lg border border-[#E8E8E8] flex items-center justify-center text-[#8B8E8F] hover:bg-[#F7F7F7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="เดือนถัดไป"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M4.5 2L8 6l-3.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
