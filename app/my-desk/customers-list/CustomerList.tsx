"use client";
import { useState } from "react";
import AnalyzeCallPanel from "./AnalyzeCallPanel";
import type { Customer } from "@/lib/db";

interface OrekaRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

const DETAIL_FIELDS: { key: keyof Customer; label: string }[] = [
  { key: "diseases", label: "โรคเป็นอยู่" },
  { key: "symptoms", label: "อาการตอนนี้" },
  { key: "medications", label: "ยาที่กำลังทานอยู่" },
  { key: "consultedDoc", label: "ปรึกษาหมอมั้ย" },
  { key: "patientType", label: "คนที่ทาน" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "notes", label: "หมายเหตุ" },
];

export default function CustomerList({
  customers,
  agentId,
  orekaExtGosell,
  orekaExtHopeful,
  initialRecordings,
}: {
  customers: Customer[];
  agentId: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
  initialRecordings: OrekaRecording[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (customers.length === 0) return null;

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl divide-y divide-[#E8E8E8]">
      {customers.map((c) => {
        const isExpanded = expandedId === c.id;
        const displayName =
          [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
        const initial = (c.firstName ?? c.nickname ?? "?").charAt(0).toUpperCase();
        const hasData = !!(c.firstName || c.lastName || c.diseases);
        const filledFields = DETAIL_FIELDS.filter(({ key }) => !!c[key]);

        return (
          <div key={c.id}>
            {/* Row — click to expand */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors select-none"
              onClick={() => setExpandedId(isExpanded ? null : c.id)}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 transition-colors ${
                  hasData ? "bg-[#87DE81] text-white" : "bg-[#E8E8E8] text-[#8B8E8F]"
                }`}
              >
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#3D3D3D] flex items-center gap-2">
                  {displayName}
                  {c.nickname && (
                    <span className="text-[11px] text-[#8B8E8F] font-normal">({c.nickname})</span>
                  )}
                </div>
                <div className="text-[11px] text-[#8B8E8F] flex items-center gap-2 mt-0.5">
                  {c.diseases && <span>💊 {c.diseases}</span>}
                  {c.phone && !c.diseases && <span>📞 {c.phone}</span>}
                  {!hasData && <span className="text-[#C0C0C0]">ยังไม่มีข้อมูล AI</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <AnalyzeCallPanel
                  agentId={agentId}
                  customerId={c.id}
                  orekaExtGosell={orekaExtGosell}
                  orekaExtHopeful={orekaExtHopeful}
                  initialRecordings={initialRecordings}
                  trigger={
                    <button className="text-[11px] px-3 py-1.5 border border-[#58CEE8] text-[#58CEE8] rounded-lg hover:bg-[#f0fbff] transition-colors">
                      🎙 วิเคราะห์สาย
                    </button>
                  }
                />
              </div>

              {/* Chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C0C0C0"
                strokeWidth="2"
                className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div className="px-5 pb-5 bg-[#FAFAFA] border-t border-[#F0F0F0]">
                {filledFields.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[#C0C0C0]">
                    ยังไม่มีข้อมูล — กด &ldquo;วิเคราะห์สาย&rdquo; เพื่อดึงข้อมูลจาก AI
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-4">
                    {DETAIL_FIELDS.map(({ key, label }) => {
                      const value = c[key] as string | null;
                      if (!value) return null;
                      const isWide =
                        key === "diseases" ||
                        key === "symptoms" ||
                        key === "medications" ||
                        key === "consultedDoc" ||
                        key === "notes";
                      return (
                        <div
                          key={key}
                          className={`bg-white border border-[#E8E8E8] rounded-xl p-3 ${
                            isWide ? "col-span-2" : ""
                          }`}
                        >
                          <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
                          <div className="text-[12px] text-[#3D3D3D] font-medium">{value}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
