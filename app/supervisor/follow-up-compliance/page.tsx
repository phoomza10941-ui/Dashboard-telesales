import { getAllAgentsAnalysis } from "@/lib/db";

function pct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

export default async function FollowUpCompliancePage() {
  const agents = await getAllAgentsAnalysis();

  const data = agents.map((a) => {
    const due  = a.followUpRows.length;
    // Closed follow-ups = followUpRows that also contain "ปิด"
    const done = a.followUpRows.filter((r) => r.note.toLowerCase().includes("ปิด")).length;
    const rate = pct(done, due);
    return { name: a.agentName, due, done, remaining: due - done, rate, agentId: a.agentId };
  });

  const totalDue  = data.reduce((s, d) => s + d.due, 0);
  const totalDone = data.reduce((s, d) => s + d.done, 0);
  const teamRate  = pct(totalDone, totalDue);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">Follow-up Compliance</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ทีมตามลูกค้าครบไหม — คำนวณจาก note field จริง</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <KpiCard label="ต้องตามทั้งหมด" value={`${totalDue} เคส`} />
        <KpiCard label="ตามแล้วปิดได้" value={`${totalDone} เคส`} accent="green" />
        <KpiCard label="ยังค้างอยู่" value={`${totalDue - totalDone} เคส`} accent={totalDue - totalDone > 0 ? "red" : "green"} />
      </div>

      {/* Team progress */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-[#3D3D3D]">ภาพรวมทีม</span>
          <span className={`text-[16px] font-bold ${teamRate >= 80 ? "text-[#3D9B3A]" : teamRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {teamRate}%
          </span>
        </div>
        <div className="w-full h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${teamRate >= 80 ? "bg-[#87DE81]" : teamRate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${teamRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-[#8B8E8F]">
          <span>{totalDone}/{totalDue} เคส</span>
          <span>{teamRate >= 80 ? "ดี" : teamRate >= 50 ? "ต้องเร่ง" : totalDue === 0 ? "ยังไม่มีข้อมูล" : "วิกฤต"}</span>
        </div>
      </div>

      {/* Per-agent */}
      <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["Agent", "Follow-up เคส", "ปิดได้", "ยังค้าง", "% ปิด", "สถานะ"].map((h) => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[12px] text-[#8B8E8F]">ยังไม่มีข้อมูล</td>
                </tr>
              ) : (
                data.slice().sort((a, b) => a.rate - b.rate).map((d) => {
                  const barColor = d.rate >= 80 ? "bg-[#87DE81]" : d.rate >= 50 ? "bg-amber-400" : "bg-red-400";
                  const statusStyle =
                    d.due === 0      ? "text-[#8B8E8F] bg-[#F7F7F7]" :
                    d.rate >= 80     ? "text-[#3D9B3A] bg-green-50" :
                    d.rate >= 50     ? "text-amber-600 bg-amber-50" :
                    "text-red-500 bg-red-50";
                  const statusLabel =
                    d.due === 0 ? "—" : d.rate >= 80 ? "ครบ" : d.rate >= 50 ? "ต้องเร่ง" : "วิกฤต";
                  return (
                    <tr key={d.agentId} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold">
                            {d.name.charAt(0)}
                          </div>
                          <span className="font-medium text-[#3D3D3D]">{d.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#3D3D3D]">{d.due}</td>
                      <td className="py-4 px-5 font-medium text-[#3D9B3A]">{d.done}</td>
                      <td className="py-4 px-5">
                        <span className={d.remaining > 0 ? "font-semibold text-red-500" : "text-[#8B8E8F]"}>{d.remaining}</span>
                      </td>
                      <td className="py-4 px-5">
                        {d.due > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-[#E8E8E8] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${d.rate}%` }} />
                            </div>
                            <span className={`font-semibold text-[12px] ${d.rate >= 80 ? "text-[#3D9B3A]" : d.rate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {d.rate}%
                            </span>
                          </div>
                        ) : <span className="text-[#8B8E8F]">—</span>}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${statusStyle}`}>{statusLabel}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8]">
          <p className="text-[10px] text-[#C0C0C0]">Follow-up = note มีคำ: ติดตาม / follow / นัด / โทรตาม | ปิดได้ = follow-up + มีคำ &ldquo;ปิด&rdquo;</p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "red" }) {
  const color = accent === "green" ? "text-[#3D9B3A]" : accent === "red" ? "text-red-500" : "text-[#3D3D3D]";
  return (
    <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
      <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
      <div className={`text-[18px] font-bold ${color}`}>{value}</div>
    </div>
  );
}
