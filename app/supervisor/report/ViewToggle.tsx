"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ViewToggle({
  view,
  todayISO,
}: {
  view: "monthly" | "daily";
  todayISO: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(newView: "monthly" | "daily") {
    const params = new URLSearchParams(searchParams.toString());
    if (newView === "daily") {
      params.set("view", "daily");
      if (!params.get("date")) params.set("date", todayISO);
      params.delete("month");
    } else {
      params.delete("view");
      params.delete("date");
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1">
      <button
        onClick={() => go("monthly")}
        className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
          view === "monthly"
            ? "bg-white text-[#3D3D3D] shadow-sm"
            : "text-[#8B8E8F] hover:text-[#3D3D3D]"
        }`}
      >
        รายเดือน
      </button>
      <button
        onClick={() => go("daily")}
        className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${
          view === "daily"
            ? "bg-white text-[#3D3D3D] shadow-sm"
            : "text-[#8B8E8F] hover:text-[#3D3D3D]"
        }`}
      >
        รายวัน
      </button>
    </div>
  );
}
