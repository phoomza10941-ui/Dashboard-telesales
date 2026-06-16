"use client";
import { useState } from "react";

interface StickyKpiBarUIProps {
  sales: number;
  orders: number;
  urgentAlerts: number;
  dailyTarget: number;
  isPersonalTarget: boolean;
  monthlyTarget: number | null;
  monthlySales: number;
  aov: number;
  gap: number;
  pct: number;
  billsNeeded: number;
  monthlyPct: number | null;
  salesFormatted: string;
  salesFull: string;
  dailyTargetFormatted: string;
  dailyTargetFull: string;
  aovFormatted: string;
  aovFull: string;
  gapFormatted: string;
  gapFull: string;
  monthlySalesFormatted: string;
  monthlyTargetFormatted: string;
}

export default function StickyKpiBarUI({
  orders,
  urgentAlerts,
  isPersonalTarget,
  monthlyTarget,
  pct,
  billsNeeded,
  monthlyPct,
  salesFormatted,
  salesFull,
  dailyTargetFormatted,
  dailyTargetFull,
  aovFormatted,
  aovFull,
  gapFormatted,
  gapFull,
  monthlySalesFormatted,
  monthlyTargetFormatted,
}: StickyKpiBarUIProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <header className="bg-white border-b border-[#E8E8E8] px-6 shrink-0">
      {/* Primary row — always visible */}
      <div className="flex items-center gap-0 h-[56px]">
        <KpiItem label="ยอดวันนี้" value={salesFormatted} title={salesFull} accent="green" />
        <Divider />
        <KpiItem
          label={isPersonalTarget ? "เป้าส่วนตัว" : "เป้าทีม"}
          value={dailyTargetFormatted}
          title={dailyTargetFull}
          accent={isPersonalTarget ? "cyan" : undefined}
        />
        <Divider />
        <div className="flex items-center gap-3 px-5">
          <div>
            <div className="text-[10px] text-[#8B8E8F] mb-1">% ถึงเป้าวัน</div>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                <div className="h-full bg-[#87DE81] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-[#3D3D3D] tabular-nums whitespace-nowrap">{pct}%</span>
            </div>
          </div>
        </div>
        <Divider />
        <KpiItem label="Orders" value={`${orders}`} />

        <div className="ml-auto flex items-center gap-3">
          {urgentAlerts > 0 && (
            <div className="flex items-center gap-1.5 bg-[#FF6B6B]/10 text-[#FF6B6B] px-3 py-1.5 rounded-lg">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-[12px] font-semibold">{urgentAlerts} Alert ด่วน</span>
            </div>
          )}
          {/* Expand/collapse toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            title={expanded ? "ซ่อนข้อมูลเพิ่มเติม" : "ดูข้อมูลเพิ่มเติม"}
            className="flex items-center gap-1 text-[10px] text-[#C0C0C0] hover:text-[#8B8E8F] transition-colors px-2 py-1 rounded-lg hover:bg-[#F7F7F7]"
          >
            <span className="hidden sm:inline">{expanded ? "น้อยลง" : "เพิ่มเติม"}</span>
            <svg
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Secondary row — expandable */}
      {expanded && (
        <div className="flex items-center gap-0 pb-3 border-t border-[#F7F7F7] pt-2">
          <KpiItemSm label="AOV" value={aovFull !== "" ? aovFormatted : "—"} title={aovFull || undefined} />
          <DividerSm />
          <KpiItemSm label="เหลืออีก" value={gapFormatted} title={gapFull} />
          <DividerSm />
          <KpiItemSm label="ต้องปิดเพิ่ม" value={`${billsNeeded} บิล`} />
          {monthlyTarget !== null && monthlyPct !== null && (
            <>
              <DividerSm />
              <div className="flex items-center gap-3 px-4">
                <div>
                  <div className="text-[9px] text-[#8B8E8F] mb-0.5">% เป้าเดือน</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 bg-[#E8E8E8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#022EE8] rounded-full" style={{ width: `${monthlyPct}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-[#0E8FA8]">{monthlyPct}%</span>
                  </div>
                  <div className="text-[9px] text-[#C0C0C0] mt-0.5 whitespace-nowrap">
                    {monthlySalesFormatted} / {monthlyTargetFormatted}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function KpiItem({ label, value, title, accent }: { label: string; value: string; title?: string; accent?: "green" | "cyan" }) {
  const valueColor =
    accent === "green" ? "text-[#3D9B3A]" :
    accent === "cyan"  ? "text-[#0E8FA8]" :
    "text-[#3D3D3D]";
  return (
    <div className="px-5 flex flex-col justify-center">
      <div className="text-[10px] text-[#8B8E8F] mb-0.5">{label}</div>
      <div title={title} className={`text-[13px] font-semibold leading-none tabular-nums whitespace-nowrap ${valueColor}`}>{value}</div>
    </div>
  );
}

function KpiItemSm({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="px-4 flex flex-col justify-center">
      <div className="text-[9px] text-[#8B8E8F] mb-0.5">{label}</div>
      <div title={title} className="text-[11px] font-semibold leading-none tabular-nums whitespace-nowrap text-[#3D3D3D]">{value}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-[#E8E8E8]" />;
}

function DividerSm() {
  return <div className="w-px h-5 bg-[#E8E8E8]" />;
}
