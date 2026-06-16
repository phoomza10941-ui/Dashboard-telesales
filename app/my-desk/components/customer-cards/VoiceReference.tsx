"use client";
import { useState } from "react";

export function VoiceReference({
  recordingId,
  account,
}: {
  recordingId: string;
  account?: "gosell" | "hopeful";
}) {
  const [open, setOpen] = useState(false);

  if (!recordingId) return null;

  const src = account
    ? `/api/oreka/audio/${recordingId}?account=${account}`
    : `/api/oreka/audio/${recordingId}`;

  return (
    <div className="border-t border-[#F0F0F0]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-medium text-[#8B8E8F] hover:bg-[#FAFAFA] transition-colors"
      >
        <span>🎧 ฟังเสียงอ้างอิง</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3">
          <audio
            controls
            preload="none"
            className="w-full h-9 mt-2"
            src={src}
          />
        </div>
      )}
    </div>
  );
}
