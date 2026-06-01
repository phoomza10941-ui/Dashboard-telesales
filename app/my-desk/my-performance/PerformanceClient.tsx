"use client";
import { useState } from "react";
import type { AgentData } from "@/lib/db";

type Period = "Today" | "7 Days" | "28 Days" | "All";
const periods: Period[] = ["Today", "7 Days", "28 Days", "All"];
const DAILY_TARGET = 80000;

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

export default function PerformanceClient({ data }: { data: AgentData | null }) {
  const [period, setPeriod] = useState<Period>("28 Days");

  const rows = data?.rows ?? [];
  const today = todayStr();

  const filtered = rows.filter((r) => {
    if (period === "Today")  return r.date.startsWith(today) || r.date === today;
    if (period === "7 Days") return matchesDate(r.date, daysAgo(7));
    if (period === "28 Days")return matchesDate(r.date, daysAgo(28));
    return true;
  });

  const totalSales      = filtered.reduce((s, r) => s + r.phoneClose + r.upsell + r.crm, 0);
  const totalPhoneClose = filtered.reduce((s, r) => s + r.phoneClose, 0);
  const totalUpsell     = filtered.reduce((s, r) => s + r.upsell, 0);
  const totalCrm        = filtered.reduce((s, r) => s + r.crm, 0);
  const orders      = filtered.length;
  const aov         = orders > 0 ? Math.round(totalSales / orders) : 0;
  const target      = period === "Today" ? DAILY_TARGET : period === "7 Days" ? DAILY_TARGET * 7 : period === "28 Days" ? DAILY_TARGET * 28 : DAILY_TARGET * 30;
  const pct         = target > 0 ? Math.min(Math.round((totalSales / target) * 100), 100) : 0;

  // 28-day trend
  const trendMap = new Map<string, number>();
  rows.forEach((r) => {
    const key = r.date;
    trendMap.set(key, (trendMap.get(key) ?? 0) + r.phoneClose + r.upsell + r.crm);
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
            }`}>{p}</button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="ยอดขาย"    value={`฿${(totalSales/1000).toFixed(1)}K`} />
        <MetricCard label="Orders"     value={`${orders}`} />
        <MetricCard label="% ถึงเป้า"  value={`${pct}%`} accent={pct>=100?"green":pct>=70?"neutral":"red"} />
        <MetricCard label="ปิดจากเบอร์" value={`฿${(totalPhoneClose/1000).toFixed(1)}K`} />
        <MetricCard label="Upsell"     value={`฿${(totalUpsell/1000).toFixed(1)}K`} />
        <MetricCard label="CRM"        value={`฿${(totalCrm/1000).toFixed(1)}K`} />
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-[#3D3D3D]">Progress ถึงเป้า ({period})</span>
          <span className="text-[13px] font-bold text-[#3D3D3D]">{pct}%</span>
        </div>
        <div className="w-full h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{
            width: `${Math.min(pct,100)}%`,
            background: pct>=100?"#87DE81":pct>=70?"#58CEE8":"#F59E0B"
          }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-[#8B8E8F]">฿0</span>
          <span className="text-[10px] text-[#8B8E8F]">฿{(target/1000).toFixed(0)}K</span>
        </div>
      </div>

      {/* 28-day trend */}
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold text-[#3D3D3D]">Trend ยอดขาย 28 วันล่าสุด</h3>
          <span className="text-[11px] text-[#8B8E8F]">สูงสุด ฿{maxVal.toLocaleString()}</span>
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
          <h3 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">สินค้าที่ขายได้ ({period})</h3>
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
