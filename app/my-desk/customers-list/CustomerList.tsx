"use client";
import { useState } from "react";
import AnalyzeCallPanel from "./AnalyzeCallPanel";
import { CallSummarySection } from "@/app/my-desk/components/customer-cards/CallSummarySection";
import type { Customer } from "@/lib/db";

interface OrekaRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

const DETAIL_FIELDS: { key: keyof Customer; label: string; wide?: boolean }[] = [
  { key: "diseases", label: "โรคเป็นอยู่", wide: true },
  { key: "symptoms", label: "อาการตอนนี้", wide: true },
  { key: "medications", label: "ยาที่กำลังทานอยู่", wide: true },
  { key: "consultedDoc", label: "ปรึกษาหมอมั้ย" },
  { key: "patientType", label: "คนที่ทาน" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "notes", label: "หมายเหตุ", wide: true },
];

function hasAiData(c: Customer) {
  return !!(c.firstName || c.lastName || c.diseases || c.symptoms || c.medications);
}

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
  const [tab, setTab] = useState<"extracted" | "pending">("extracted");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const extracted = customers.filter(hasAiData);
  const pending = customers.filter((c) => !hasAiData(c));
  const hasOrekaExt = !!(orekaExtGosell || orekaExtHopeful);

  const tabs = [
    { id: "extracted" as const, label: "ดึงข้อมูลแล้ว", count: extracted.length },
    { id: "pending" as const, label: "ยังไม่ได้ดึง", count: pending.length },
  ];

  const list = tab === "extracted" ? extracted : pending;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 bg-[#F7F7F7] p-1 rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setExpandedId(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              tab === t.id
                ? "bg-white text-[#3D3D3D] shadow-sm"
                : "text-[#8B8E8F] hover:text-[#3D3D3D]"
            }`}
          >
            {t.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
              tab === t.id ? "bg-[#87DE81] text-white" : "bg-[#E8E8E8] text-[#8B8E8F]"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-10 text-center">
          <div className="text-[28px] mb-2">{tab === "extracted" ? "✅" : "🎙"}</div>
          <div className="text-[13px] font-medium text-[#3D3D3D]">
            {tab === "extracted" ? "ยังไม่มีลูกค้าที่ดึงข้อมูลแล้ว" : "ลูกค้าทุกคนมีข้อมูลครบแล้ว"}
          </div>
          <div className="text-[11px] text-[#8B8E8F] mt-1">
            {tab === "extracted"
              ? "กดแท็บ \"ยังไม่ได้ดึง\" เพื่อเริ่มวิเคราะห์สาย"
              : "ไม่มีลูกค้าที่รอการวิเคราะห์"}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl divide-y divide-[#E8E8E8]">
          {list.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c}
              agentId={agentId}
              orekaExtGosell={orekaExtGosell}
              orekaExtHopeful={orekaExtHopeful}
              initialRecordings={initialRecordings}
              hasOrekaExt={hasOrekaExt}
              showDetails={tab === "extracted"}
              isExpanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerCard({
  customer: c,
  agentId,
  orekaExtGosell,
  orekaExtHopeful,
  initialRecordings,
  hasOrekaExt,
  showDetails,
  isExpanded,
  onToggle,
}: {
  customer: Customer;
  agentId: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
  initialRecordings: OrekaRecording[];
  hasOrekaExt: boolean;
  showDetails: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const displayName = [c.firstName, c.lastName].filter(Boolean).join(" ") || "—";
  const initial = (c.firstName ?? c.nickname ?? c.phone ?? "?").charAt(0).toUpperCase();
  const filledFields = DETAIL_FIELDS.filter(({ key }) => !!c[key]);

  return (
    <div>
      {/* Row */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors select-none"
        onClick={onToggle}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
          showDetails ? "bg-[#87DE81] text-white" : "bg-[#E8E8E8] text-[#8B8E8F]"
        }`}>
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#3D3D3D] flex items-center gap-2">
            {displayName}
            {c.nickname && (
              <span className="text-[11px] text-[#8B8E8F] font-normal">({c.nickname})</span>
            )}
          </div>
          <div className="text-[11px] text-[#8B8E8F] flex items-center gap-2 mt-0.5 flex-wrap">
            {c.diseases && <span>💊 {c.diseases}</span>}
            {c.phone && <span>📞 {c.phone}</span>}
            {!showDetails && !c.phone && (
              <span className="text-[#C0C0C0]">ยังไม่มีข้อมูล</span>
            )}
          </div>
        </div>

        {!showDetails && (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <AnalyzeCallPanel
              agentId={agentId}
              customerId={c.id}
              orekaExtGosell={orekaExtGosell}
              orekaExtHopeful={orekaExtHopeful}
              initialRecordings={initialRecordings}
              trigger={
                <button className="text-[11px] px-3 py-1.5 rounded-lg transition-colors border border-[#58CEE8] text-[#58CEE8] hover:bg-[#f0fbff]">
                  🎙 วิเคราะห์สาย
                </button>
              }
            />
          </div>
        )}

        {/* Chevron — only show if expandable */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#C0C0C0" strokeWidth="2"
          className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded detail — only on "extracted" tab */}
      {isExpanded && showDetails && (
        <div className="bg-[#FAFAFA] border-t border-[#F0F0F0]">

          {/* Health profile grid */}
          {filledFields.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <div className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
                ข้อมูลสุขภาพ
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filledFields.map(({ key, label, wide }) => {
                  const value = c[key] as string | null;
                  if (!value) return null;
                  return (
                    <div
                      key={key}
                      className={`bg-white border border-[#E8E8E8] rounded-xl p-3 ${wide ? "col-span-2" : ""}`}
                    >
                      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
                      <div className="text-[12px] text-[#3D3D3D] font-medium">{value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI call summary + coaching tips */}
          {c.phone && (
            <CallSummarySection phone={c.phone} hasOrekaExt={hasOrekaExt} />
          )}

          {!c.phone && (
            <div className="px-5 py-4 text-[11px] text-[#C0C0C0] text-center">
              ไม่มีเบอร์โทร — ไม่สามารถดึงสรุปการโทรได้
            </div>
          )}
        </div>
      )}
    </div>
  );
}
