"use client";
import { useState } from "react";
import type { AgentData } from "@/lib/db";
import { fmtBahtCompact, fmtBaht } from "@/lib/format";

type Period = "Today" | "7 Days" | "28 Days" | "All";
const periods: Period[] = ["Today", "7 Days", "28 Days", "All"];
const periodLabel: Record<Period, string> = {
  "Today": "วันนี้",
  "7 Days": "7 วัน",
  "28 Days": "28 วัน",
  "All": "ทั้งหมด",
};

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function matchesDate(dateStr: string, from: Date) {
  const parts = dateStr.split("/");
  if (parts.length < 3) return false;
  const year = parseInt(parts[2]) > 2500 ? parseInt(parts[2]) - 543 : parseInt(parts[2]);
  const rowDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
  return rowDate >= from;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function PerformanceClient({
  data, dailyTarget, talkSeconds = 0, talkCalls = 0, hasOrekaExt = false,
}: {
  data: AgentData | null; dailyTarget: number;
  talkSeconds?: number; talkCalls?: number; hasOrekaExt?: boolean;
}) {
  const [period, setPeriod] = useState<Period>("28 Days");

  const rows = data?.rows ?? [];
  const today = todayStr();

  const filtered = rows.filter((r) => {
    if (period === "Today")  return r.date.startsWith(today) || r.date === today;
    if (period === "7 Days") return matchesDate(r.date, daysAgo(7));
    if (period === "28 Days")return matchesDate(r.date, daysAgo(28));
    return true;
  });

  const totalSales      = filtered.reduce((s, r) => s + r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell, 0);
  const totalPhoneClose = filtered.reduce((s, r) => s + r.phoneClose, 0);
  const totalUpsell     = filtered.reduce((s, r) => s + r.upsell, 0);
  const totalCrm        = filtered.reduce((s, r) => s + r.crm, 0);
  const orders      = filtered.length;
  const aov         = orders > 0 ? Math.round(totalSales / orders) : 0;
  const target      = period === "Today" ? dailyTarget : period === "7 Days" ? dailyTarget * 7 : period === "28 Days" ? dailyTarget * 28 : dailyTarget * 30;
  const pct         = target > 0 ? Math.min(Math.round((totalSales / target) * 100), 100) : 0;

  // 28-day trend
  const trendMap = new Map<string, number>();
  rows.forEach((r) => {
    const key = r.date;
    trendMap.set(key, (trendMap.get(key) ?? 0) + r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell);
  });

  const trend: number[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = daysAgo(i);
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const ce = d.getFullYear();
    const be = ce + 543;
    trend.push(trendMap.get(`${dd}/${mm}/${ce}`) ?? trendMap.get(`${dd}/${mm}/${be}`) ?? 0);
  }

  const maxVal = Math.max(...trend, 1);
  const w = 600; const h = 80; const pad = 4;
  const pts = trend.map((v, i) => {
    const x = pad + (i / (trend.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v / maxVal) * (h - pad * 2));
    return `${x},${y}`;
  });
  const area = `${pad},${h} ` + pts.join(" ") + ` ${w - pad},${h}`;

  // Product breakdown
  const productMap = new Map<string, number>();
  filtered.forEach((r) => {
    if (r.product) productMap.set(r.product, (productMap.get(r.product) ?? 0) + 1);
  });
  const products = [...productMap.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      {/* Period toggle */}
      <div className="flex gap-1 bg-white border border-[#E8E8E8] rounded-xl p-1 w-fit">
        {periods.map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              period === p ? "bg-[#87DE81] text-white shadow-sm" : "text-[#8B8E8F] hover:text-[#3D3D3D] hover:bg-[#F7F7F7]"
            }`}>{periodLabel[p]}</button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="ยอดขาย"    value={fmtBahtCompact(totalSales)} />
        <MetricCard label="Orders"     value={`${orders}`} />
        <MetricCard label="% ถึงเป้า"  value={`${pct}%`} accent={pct>=100?"green":pct>=70?"neutral":"red"} />
        <MetricCard label="ปิดจากเบอร์" value={fmtBahtCompact(totalPhoneClose)} />
        <MetricCard label="Upsell"     value={fmtBahtCompact(totalUpsell)} />
        <MetricCard label="CRM"        value={fmtBahtCompact(totalCrm)} />
      </div>

      {/* Talk Time card (today only) */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58CEE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <h3 className="text-[13px] font-semibold text-[#3D3D3D]">Talk Time วันนี้</h3>
          <span className="text-[10px] text-[#8B8E8F] ml-auto">dtac OneCall</span>
        </div>
        {!hasOrekaExt ? (
          <div className="flex items-center gap-3 bg-[#F7F7F7] rounded-lg px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[12px] text-[#8B8E8F]">ยังไม่ได้เลือกเบอร์ dtac — คลิกชื่อของคุณด้านซ้ายเพื่อตั้งค่า</p>
          </div>
        ) : talkSeconds === 0 ? (
          <div className="flex items-center gap-3 bg-[#F7F7F7] rounded-lg px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="text-[12px] text-[#8B8E8F]">ยังไม่มีสายวันนี้ หรือระบบยังไม่อัปเดต</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-[28px] font-black text-[#58CEE8] leading-none">{fmtDuration(talkSeconds)}</div>
              <div className="text-[10px] text-[#8B8E8F] mt-1">เวลาคุยรวม</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-black text-[#3D3D3D] leading-none">{talkCalls}</div>
              <div className="text-[10px] text-[#8B8E8F] mt-1">สายทั้งหมด</div>
            </div>
            <div className="text-center">
              <div className="text-[28px] font-black text-[#3D3D3D] leading-none">
                {talkCalls > 0 ? fmtDuration(Math.round(talkSeconds / talkCalls)) : "—"}
              </div>
              <div className="text-[10px] text-[#8B8E8F] mt-1">เฉลี่ยต่อสาย</div>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-[#3D3D3D]">ความคืบหน้าถึงเป้า ({periodLabel[period]})</span>
          <span className="text-[13px] font-bold text-[#3D3D3D]">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${Math.min(pct,100)}%`,
            background: pct>=100?"#87DE81":pct>=70?"#022EE8":"#F59E0B"
          }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-[#8B8E8F]">฿0</span>
          <span className="text-[10px] text-[#8B8E8F]">{fmtBahtCompact(target)}</span>
        </div>
      </div>

      {/* 28-day trend */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#3D3D3D]">Trend ยอดขาย 28 วันล่าสุด</h3>
          <span className="text-[11px] text-[#8B8E8F]">สูงสุด {fmtBaht(maxVal)}</span>
        </div>
        {maxVal <= 1 ? (
          <p className="text-[12px] text-[#8B8E8F] text-center py-4">ยังไม่มีข้อมูลเพียงพอ</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#87DE81" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#87DE81" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={area} fill="url(#areaGrad)" />
              <polyline points={pts.join(" ")} fill="none" stroke="#87DE81" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={w - pad} cy={h - pad - ((trend[27] / maxVal) * (h - pad * 2))} r="4" fill="#87DE81" />
            </svg>
            <div className="flex justify-between mt-1 px-0.5">
              {[27, 20, 13, 6, 0].map((daysBack) => {
                const d = daysAgo(daysBack);
                const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
                return (
                  <span key={daysBack} className="text-[10px] text-[#C0C0C0]">{label}</span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Product breakdown */}
      {products.length > 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
          <h3 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">สินค้าที่ขายได้ ({periodLabel[period]})</h3>
          <div className="space-y-2.5">
            {products.map(([prod, count]) => {
              const pctBar = Math.round((count / orders) * 100);
              return (
                <div key={prod}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[12px] text-[#3D3D3D]">{prod}</span>
                    <span className="text-[11px] font-semibold text-[#8B8E8F]">{count} รายการ ({pctBar}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#87DE81]" style={{ width: `${pctBar}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: "green"|"red"|"neutral" }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl px-4 py-4">
      <div className="text-[11px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[20px] font-bold ${
        accent==="green"?"text-[#3D9B3A]":accent==="red"?"text-[#FF6B6B]":"text-[#3D3D3D]"
      }`}>{value}</div>
    </div>
  );
}
