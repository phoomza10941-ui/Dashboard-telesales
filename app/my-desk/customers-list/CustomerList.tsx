"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AnalyzeCallPanel from "./AnalyzeCallPanel";
import { CallSummarySection } from "@/app/my-desk/components/customer-cards/CallSummarySection";
import { CallCalendar } from "@/app/my-desk/components/customer-cards/CallCalendar";
import type { Customer } from "@/lib/db";

interface OrekaRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

type BulkStatus = "ok" | "skipped" | "error";
interface BulkResult { name: string; status: BulkStatus; }

// Normalize phone: strip non-digits, take last 9 digits for matching
function normPhone(p: string) { return p.replace(/\D/g, "").slice(-9); }

function findBestRec(phone: string, recs: OrekaRecording[]): OrekaRecording | null {
  const norm = normPhone(phone);
  if (!norm) return null;
  const matches = recs.filter((r) => normPhone(r.remoteParty) === norm && r.duration >= 60);
  if (!matches.length) return null;
  return matches.reduce((best, r) => (r.duration > best.duration ? r : best));
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
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkCurrent, setBulkCurrent] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const extracted = customers.filter(hasAiData);
  const pending = customers.filter((c) => !hasAiData(c));
  const hasOrekaExt = !!(orekaExtGosell || orekaExtHopeful);

  async function runBulkAnalyze() {
    const targets = pending.filter((c) => c.phone);
    if (!targets.length) return;
    setBulkRunning(true);
    setBulkDone(0);
    setBulkTotal(targets.length);
    setBulkCurrent("");
    setBulkResults(null);
    const results: BulkResult[] = [];
    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.nickname || c.phone || "?";
      setBulkDone(i);
      setBulkCurrent(name);
      const rec = findBestRec(c.phone!, initialRecordings);
      if (!rec) {
        results.push({ name, status: "skipped" });
        continue;
      }
      try {
        const account = orekaExtGosell && rec.localParty === orekaExtGosell ? "gosell" : "hopeful";
        const analyzeRes = await fetch("/api/customer/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orekaRecordingId: rec.id, account }),
        });
        if (!analyzeRes.ok) throw new Error("analyze failed");
        const { fields } = await analyzeRes.json();
        const customerId = c.id.startsWith("__sales__") ? undefined : c.id;
        const upsertRes = await fetch("/api/customer/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customerId,
            agentId,
            orekaRecId: rec.id,
            phone: rec.remoteParty ?? c.phone,
            ...(c.nickname && !fields.first_name ? { nickname: c.nickname } : {}),
            ...fields,
          }),
        });
        if (!upsertRes.ok) throw new Error("upsert failed");
        results.push({ name, status: "ok" });
      } catch {
        results.push({ name, status: "error" });
      }
    }
    setBulkDone(targets.length);
    setBulkCurrent("");
    setBulkRunning(false);
    setBulkResults(results);
  }

  const tabs = [
    { id: "extracted" as const, label: "ดึงข้อมูลแล้ว", count: extracted.length },
    { id: "pending" as const, label: "ยังไม่ได้ดึง", count: pending.length },
  ];

  const list = tab === "extracted" ? extracted : pending;

  const bulkPct = bulkTotal > 0 ? Math.round((bulkDone / bulkTotal) * 100) : 0;
  const bulkOkCount = bulkResults?.filter((r) => r.status === "ok").length ?? 0;
  const bulkSkipCount = bulkResults?.filter((r) => r.status === "skipped").length ?? 0;
  const bulkErrCount = bulkResults?.filter((r) => r.status === "error").length ?? 0;

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

      {/* Bulk analyze — only on pending tab */}
      {tab === "pending" && pending.length > 0 && hasOrekaExt && (
        <div className="mb-4">
          {/* Progress / results panel */}
          {(bulkRunning || bulkResults) && (
            <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 mb-3 space-y-3">
              {bulkRunning ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-[#8B8E8F] truncate max-w-[70%]">
                      🎙 {bulkCurrent || "กำลังเริ่ม..."}
                    </span>
                    <span className="text-[14px] font-semibold text-[#3D3D3D] tabular-nums shrink-0">
                      {bulkDone} / {bulkTotal} ({bulkPct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-[#E8E8E8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#87DE81] rounded-full transition-all duration-300"
                      style={{ width: `${bulkPct}%` }}
                    />
                  </div>
                </>
              ) : bulkResults && (
                <>
                  <div className="text-[13px] font-semibold text-[#3D3D3D]">✅ วิเคราะห์เสร็จแล้ว</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-[#f0fdf4] border border-[#87DE81]/30 rounded-xl p-2.5">
                      <div className="text-[18px] font-bold text-[#87DE81]">{bulkOkCount}</div>
                      <div className="text-[10px] text-[#8B8E8F] mt-0.5">สำเร็จ</div>
                    </div>
                    <div className="bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-2.5">
                      <div className="text-[18px] font-bold text-[#8B8E8F]">{bulkSkipCount}</div>
                      <div className="text-[10px] text-[#8B8E8F] mt-0.5">ไม่มีสาย</div>
                    </div>
                    <div className="bg-[#fff5f5] border border-red-100 rounded-xl p-2.5">
                      <div className="text-[18px] font-bold text-red-400">{bulkErrCount}</div>
                      <div className="text-[10px] text-[#8B8E8F] mt-0.5">พลาด</div>
                    </div>
                  </div>
                  {bulkOkCount > 0 && (
                    <button
                      onClick={() => { setBulkResults(null); startTransition(() => router.refresh()); }}
                      className="w-full bg-[#87DE81] hover:bg-[#76cc70] text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
                    >
                      ดูผลลัพธ์
                    </button>
                  )}
                  {bulkOkCount === 0 && (
                    <button
                      onClick={() => setBulkResults(null)}
                      className="w-full border border-[#E8E8E8] text-[#8B8E8F] text-[13px] py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors"
                    >
                      ปิด
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Bulk trigger button */}
          {!bulkRunning && !bulkResults && (
            <button
              onClick={runBulkAnalyze}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-[#58CEE8] text-[#58CEE8] text-[13px] font-medium py-3 rounded-2xl hover:bg-[#f0fbff] transition-colors"
            >
              🎙 วิเคราะห์ทั้งหมด ({pending.filter((c) => c.phone).length} ราย)
            </button>
          )}
        </div>
      )}

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
  const todayISO = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const displayName = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.nickname || "—";
  const showNicknameBadge = !!(c.nickname && (c.firstName || c.lastName));
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
            {showNicknameBadge && (
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
              customerId={c.id.startsWith("__sales__") ? undefined : c.id}
              prefillPhone={c.id.startsWith("__sales__") ? (c.phone ?? undefined) : undefined}
              prefillName={c.id.startsWith("__sales__") ? (c.nickname ?? undefined) : undefined}
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

          {/* Call calendar */}
          {c.phone && (
            <div className="px-5 pt-2 pb-1">
              <div className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-2">
                ประวัติการโทร
              </div>
              <CallCalendar
                phone={c.phone}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          )}

          {/* AI call summary + coaching tips */}
          {c.phone && (
            <CallSummarySection phone={c.phone} hasOrekaExt={hasOrekaExt} />
          )}

          {!c.phone && (
            <div className="px-5 py-4 text-[11px] text-[#C0C0C0] text-center">
              ไม่มีเบอร์โทร — ไม่สามารถดึงประวัติการโทรได้
            </div>
          )}
        </div>
      )}
    </div>
  );
}
