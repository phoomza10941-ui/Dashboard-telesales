import { getAllAgentsAnalysis } from "@/lib/db";

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default async function FunnelDiagnosisPage() {
  const agents = await getAllAgentsAnalysis();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#000000]">วิเคราะห์ Funnel รายคน</h1>
        <p className="text-[12px] text-[#000000] mt-0.5">
          วิเคราะห์สถานะเคสรายคน — คำนวณจาก note field ในระบบ
        </p>
      </div>

      {agents.length === 0 ? (
        <EmptyState msg="ยังไม่มีข้อมูล — รอ agents กรอกข้อมูลลูกค้า" />
      ) : (
        <div className="flex-1 grid grid-cols-1 gap-4 overflow-auto pb-1">
          {agents.map((a) => {
            const sc = a.statusCounts;
            const closed = sc["closed"] ?? 0;
            const pending = sc["pending_transfer"] ?? 0;
            const followUp = sc["follow_up"] ?? 0;
            const lost = sc["lost"] ?? 0;
            const inProg = sc["in_progress"] ?? 0;
            const total = a.allOrders;

            const closeRate = pct(closed, total);
            const pendingPct = pct(pending, total);
            const lostPct = pct(lost, total);

            const bottleneck =
              total === 0 ? { label: "ยังไม่มีเคส", color: "text-[#8B8E8F] bg-[#F7F7F7]", tip: "ยังไม่มีข้อมูล" } :
                closeRate < 20 ? { label: "ปิดน้อยเกินไป", color: "text-red-500 bg-red-50", tip: `ปิดได้แค่ ${closeRate}% — ฝึก closing script` } :
                  pendingPct > 30 ? { label: "รอโอนค้างเยอะ", color: "text-amber-600 bg-amber-50", tip: `รอโอน ${pendingPct}% ของเคสทั้งหมด — เร่งปิดโอน` } :
                    lostPct > 30 ? { label: "หลุดเยอะ", color: "text-red-500 bg-red-50", tip: `หลุด ${lostPct}% — ปรับ approach` } :
                      { label: "ปกติ", color: "text-[#3D9B3A] bg-green-50", tip: "Funnel ไหลดี" };

            const steps = [
              { label: "ทั้งหมด", val: total, color: "bg-[#C8C8C8]" },
              { label: "รอโอน", val: pending, color: "bg-amber-400" },
              { label: "ตาม", val: followUp, color: "bg-[#022EE8]" },
              { label: "ปิดแล้ว", val: closed, color: "bg-[#26D100]" },
              { label: "หลุด", val: lost, color: "bg-red-700" },
              { label: "กำลังดำเนินการ", val: inProg, color: "bg-[#8B8E8F]/30" },
            ];

            return (
              <div key={a.agentId} className="bg-white rounded-2xl border border-[#E8E8E8] p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[14px] font-bold">
                      {a.agentName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#3D3D3D]">{a.agentName}</div>
                      <div className="text-[11px] text-[#8B8E8F]">{total} เคสทั้งหมด · ปิด {closeRate}%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${bottleneck.color}`}>
                      {bottleneck.label}
                    </span>
                    <div className="text-[10px] text-[#8B8E8F] mt-1 max-w-[200px] text-right">{bottleneck.tip}</div>
                  </div>
                </div>

                {/* Bar chart */}
                <div className="flex items-end gap-2 mb-3">
                  {steps.map((s) => {
                    const h = total > 0 ? Math.max(Math.round((s.val / total) * 80), s.val > 0 ? 6 : 2) : 2;
                    return (
                      <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[11px] font-semibold text-[#3D3D3D]">{s.val}</span>
                        <div className={`w-full rounded-t-md ${s.color}`} style={{ height: `${h}px` }} />
                        <span className="text-[9px] text-[#8B8E8F] whitespace-nowrap">{s.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Metrics */}
                <div className="flex gap-3 pt-3 border-t border-[#F7F7F7]">
                  {[
                    { label: "อัตราปิด", val: closeRate, warn: closeRate < 20 },
                    { label: "รอโอน %", val: pendingPct, warn: pendingPct > 30, isWarn: true },
                    { label: "หลุด %", val: lostPct, warn: lostPct > 30, isLoss: true },
                    { label: "ยอดรวม", val: null, label2: `฿${a.allSales.toLocaleString()}` },
                  ].map((m, i) => (
                    <div key={i} className="flex-1 text-center">
                      <div className="text-[10px] text-[#8B8E8F]">{m.label}</div>
                      <div className={`text-[14px] font-bold mt-0.5 ${m.isLoss ? "text-red-400" : m.isWarn && m.warn ? "text-amber-500" : m.warn ? "text-amber-500" : m.val !== null && m.val >= 20 ? "text-[#3D9B3A]" : "text-[#3D3D3D]"}`}>
                        {m.label2 ?? `${m.val}%`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] flex items-center justify-center">
      <p className="text-[13px] text-[#8B8E8F]">{msg}</p>
    </div>
  );
}
