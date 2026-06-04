"use client";

import { useRef, useState, useTransition } from "react";
import { updateDailyTarget } from "@/app/actions/config";

export default function TargetConfigForm({ currentTarget }: { currentTarget: number }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError("");
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateDailyTarget(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  const presets = [50000, 80000, 100000, 150000, 200000];

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <label className="text-[12px] font-medium text-[#3D3D3D] block mb-2">
          ยอดเป้าหมายวันนี้ (บาท)
        </label>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#8B8E8F]">฿</span>
            <input
              ref={inputRef}
              name="target"
              type="number"
              defaultValue={currentTarget}
              min={1000}
              step={1000}
              required
              className="w-full pl-7 pr-4 py-2.5 text-[15px] font-semibold bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl focus:outline-none focus:border-[#022EE8] focus:bg-white transition-colors text-[#3D3D3D]"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 bg-[#022EE8] text-white text-[13px] font-semibold rounded-xl hover:bg-[#4BB8D4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>

        {/* Preset buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { if (inputRef.current) inputRef.current.value = String(p); }}
              className="text-[11px] text-[#8B8E8F] border border-[#E8E8E8] hover:border-[#022EE8] hover:text-[#022EE8] px-3 py-1 rounded-lg transition-colors"
            >
              ฿{p.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {saved && (
        <div className="flex items-center gap-2 text-[#3D9B3A] bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-[12px] font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          บันทึกแล้ว — เป้าจะอัปเดตในทุก Dashboard ทันที
        </div>
      )}
      {error && (
        <div className="text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-[12px]">
          {error}
        </div>
      )}
    </form>
  );
}
