"use client";

import { useState } from "react";
import type { MonthlyAgentRow } from "@/lib/db";

function fmt(n: number) {
  return n.toLocaleString("th-TH");
}
function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default function ProductBreakdownTabs({
  agents,
  label,
}: {
  agents: MonthlyAgentRow[];
  label: string;
}) {
  const [tab, setTab] = useState<"gosell" | "hopeful">("gosell");

  const gosellAgents = agents
    .filter((a) => a.gosellTotal > 0)
    .sort((a, b) => b.gosellTotal - a.gosellTotal);

  const hopefulAgents = agents
    .filter((a) => a.hopefulTotal > 0)
    .sort((a, b) => b.hopefulTotal - a.hopefulTotal);

  const gosellTeamTotal = gosellAgents.reduce((s, a) => s + a.gosellTotal, 0);
  const hopefulTeamTotal = hopefulAgents.reduce((s, a) => s + a.hopefulTotal, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="text-[13px] font-semibold text-[#3D3D3D]">Product Breakdown — {label}</span>
          <p className="text-[11px] text-[#8B8E8F] mt-0.5">แยกยอดตามสินค้า GoSell / Hopeful รายคน</p>
        </div>

        {/* Tab toggle */}
        <div className="flex items-center bg-[#F7F7F7] rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setTab("gosell")}
            className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
              tab === "gosell"
                ? "bg-white text-[#3D3D3D] shadow-sm"
                : "text-[#8B8E8F] hover:text-[#3D3D3D]"
            }`}
          >
            GoSell
          </button>
          <button
            onClick={() => setTab("hopeful")}
            className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
              tab === "hopeful"
                ? "bg-white text-[#3D3D3D] shadow-sm"
                : "text-[#8B8E8F] hover:text-[#3D3D3D]"
            }`}
          >
            Hopeful
          </button>
        </div>
      </div>

      {/* GoSell tab */}
      {tab === "gosell" && (
        <div className="overflow-x-auto">
          {gosellAgents.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-[#8B8E8F]">ไม่มีข้อมูล GoSell เดือนนี้</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F7F7F7]">
                  {["#", "Agent", "CRM", "Upsell", "ยอด GoSell รวม", "% ของทีม", "Orders"].map((h) => (
                    <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-2.5 px-5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gosellAgents.map((a, i) => {
                  const maxTotal = gosellAgents[0].gosellTotal;
                  const teamShare = pct(a.gosellTotal, gosellTeamTotal);
                  const crmShare = pct(a.gosellCrm, a.gosellTotal);
                  const upsellShare = pct(a.gosellUpsell, a.gosellTotal);
                  return (
                    <tr key={a.agentId} className="border-t border-[#F7F7F7] hover:bg-[#F7F7F7]/60">
                      <td className="py-3 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-[#87DE81]/20 text-[#3D9B3A]"}`}>
                            {a.agentName.charAt(0)}
                          </div>
                          <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                          {i === 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Top</span>}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#3D3D3D]">฿{fmt(a.gosellCrm)}</span>
                          <span className="text-[10px] text-[#C0C0C0]">{crmShare}% ของตัว</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#3D3D3D]">฿{fmt(a.gosellUpsell)}</span>
                          <span className="text-[10px] text-[#C0C0C0]">{upsellShare}% ของตัว</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#3D9B3A]">฿{fmt(a.gosellTotal)}</span>
                          <div className="w-16 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                            <div className="h-full bg-[#87DE81] rounded-full" style={{ width: `${Math.round((a.gosellTotal / maxTotal) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-[#8B8E8F]">{teamShare}%</td>
                      <td className="py-3 px-5 text-[#3D3D3D]">{a.gosellOrders}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E8E8E8] bg-[#F7F7F7]">
                  <td colSpan={2} className="py-3 px-5 text-[11px] font-semibold text-[#8B8E8F]">ทีมรวม</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(gosellAgents.reduce((s, a) => s + a.gosellCrm, 0))}</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(gosellAgents.reduce((s, a) => s + a.gosellUpsell, 0))}</td>
                  <td className="py-3 px-5 font-bold text-[#3D9B3A]">฿{fmt(gosellTeamTotal)}</td>
                  <td className="py-3 px-5 text-[#8B8E8F]">100%</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">{gosellAgents.reduce((s, a) => s + a.gosellOrders, 0)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* Hopeful tab */}
      {tab === "hopeful" && (
        <div className="overflow-x-auto">
          {hopefulAgents.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-[#8B8E8F]">ไม่มีข้อมูล Hopeful เดือนนี้</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F7F7F7]">
                  {["#", "Agent", "ปิดจากเบอร์", "CRM", "Upsell", "ยอด Hopeful รวม", "% ของทีม", "Orders"].map((h) => (
                    <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-2.5 px-5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hopefulAgents.map((a, i) => {
                  const maxTotal = hopefulAgents[0].hopefulTotal;
                  const teamShare = pct(a.hopefulTotal, hopefulTeamTotal);
                  const phoneShare = pct(a.hopefulPhoneClose, a.hopefulTotal);
                  const crmShare = pct(a.hopefulCrm, a.hopefulTotal);
                  const upsellShare = pct(a.hopefulUpsell, a.hopefulTotal);
                  return (
                    <tr key={a.agentId} className="border-t border-[#F7F7F7] hover:bg-[#F7F7F7]/60">
                      <td className="py-3 px-5 text-[#8B8E8F] font-medium">{i + 1}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-[#022EE8]/15 text-[#022EE8]"}`}>
                            {a.agentName.charAt(0)}
                          </div>
                          <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                          {i === 0 && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-semibold">Top</span>}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#3D3D3D]">฿{fmt(a.hopefulPhoneClose)}</span>
                          <span className="text-[10px] text-[#C0C0C0]">{phoneShare}% ของตัว</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#3D3D3D]">฿{fmt(a.hopefulCrm)}</span>
                          <span className="text-[10px] text-[#C0C0C0]">{crmShare}% ของตัว</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#3D3D3D]">฿{fmt(a.hopefulUpsell)}</span>
                          <span className="text-[10px] text-[#C0C0C0]">{upsellShare}% ของตัว</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1A8FA8]">฿{fmt(a.hopefulTotal)}</span>
                          <div className="w-16 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                            <div className="h-full bg-[#022EE8] rounded-full" style={{ width: `${Math.round((a.hopefulTotal / maxTotal) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-[#8B8E8F]">{teamShare}%</td>
                      <td className="py-3 px-5 text-[#3D3D3D]">{a.hopefulOrders}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#E8E8E8] bg-[#F7F7F7]">
                  <td colSpan={2} className="py-3 px-5 text-[11px] font-semibold text-[#8B8E8F]">ทีมรวม</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(hopefulAgents.reduce((s, a) => s + a.hopefulPhoneClose, 0))}</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(hopefulAgents.reduce((s, a) => s + a.hopefulCrm, 0))}</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">฿{fmt(hopefulAgents.reduce((s, a) => s + a.hopefulUpsell, 0))}</td>
                  <td className="py-3 px-5 font-bold text-[#1A8FA8]">฿{fmt(hopefulTeamTotal)}</td>
                  <td className="py-3 px-5 text-[#8B8E8F]">100%</td>
                  <td className="py-3 px-5 font-semibold text-[#3D3D3D]">{hopefulAgents.reduce((s, a) => s + a.hopefulOrders, 0)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
