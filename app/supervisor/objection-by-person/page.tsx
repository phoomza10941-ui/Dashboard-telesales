import { getAllAgentsAnalysis } from "@/lib/db";

const OBJ_KEYS = ["แพง", "ขอคิดก่อน", "ถามญาติ", "ถามหมอ", "กลัวไม่เห็นผล"];

export default async function ObjectionByPersonPage() {
  const agents = await getAllAgentsAnalysis();

  // Team totals
  const totals: Record<string, number> = {};
  OBJ_KEYS.forEach((k) => {
    totals[k] = agents.reduce((s, a) => s + (a.objections[k] ?? 0), 0);
  });
  const topKey = OBJ_KEYS.reduce((a, b) => totals[a] > totals[b] ? a : b);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">ข้อโต้แย้งรายคน</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">วิเคราะห์จาก note field จริง — keyword ที่ตรวจ: แพง, คิดก่อน, ถามญาติ, ถามหมอ, กลัว</p>
      </div>

      {/* Team totals */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {OBJ_KEYS.map((k) => (
          <div key={k} className={`rounded-xl border px-3 py-3 text-center ${k === topKey && totals[k] > 0 ? "bg-red-50 border-red-200" : "bg-white border-[#E8E8E8]"}`}>
            <div className={`text-[20px] font-bold ${k === topKey && totals[k] > 0 ? "text-red-500" : "text-[#3D3D3D]"}`}>{totals[k]}</div>
            <div className={`text-[10px] mt-0.5 ${k === topKey && totals[k] > 0 ? "text-red-400 font-medium" : "text-[#8B8E8F]"}`}>{k}</div>
            {k === topKey && totals[k] > 0 && <div className="text-[9px] text-red-400 mt-0.5">Top ⚡</div>}
          </div>
        ))}
      </div>

      {/* Per-agent table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5">Agent</th>
                {OBJ_KEYS.map((k) => (
                  <th key={k} className="text-center text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4 whitespace-nowrap">{k}</th>
                ))}
                <th className="text-center text-[11px] text-[#8B8E8F] font-medium py-3.5 px-4">รวม</th>
                <th className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5">โค้ชเรื่อง</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={OBJ_KEYS.length + 3} className="py-12 text-center text-[12px] text-[#8B8E8F]">ยังไม่มีข้อมูล</td>
                </tr>
              ) : (
                <>
                  {agents.map((a) => {
                    const total = OBJ_KEYS.reduce((s, k) => s + (a.objections[k] ?? 0), 0);
                    const topObjKey = total > 0 ? OBJ_KEYS.reduce((x, b) => (a.objections[x] ?? 0) >= (a.objections[b] ?? 0) ? x : b) : null;
                    return (
                      <tr key={a.agentId} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[11px] font-bold">
                              {a.agentName.charAt(0)}
                            </div>
                            <span className="font-medium text-[#3D3D3D]">{a.agentName}</span>
                          </div>
                        </td>
                        {OBJ_KEYS.map((k) => {
                          const v = a.objections[k] ?? 0;
                          const isTop = k === topObjKey && v > 0;
                          return (
                            <td key={k} className="py-4 px-4 text-center">
                              {v > 0 ? (
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-semibold ${isTop ? "bg-red-100 text-red-600" : "bg-[#F7F7F7] text-[#8B8E8F]"}`}>
                                  {v}
                                </span>
                              ) : <span className="text-[#E8E8E8]">—</span>}
                            </td>
                          );
                        })}
                        <td className="py-4 px-4 text-center font-semibold text-[#3D3D3D]">{total || "—"}</td>
                        <td className="py-4 px-5">
                          {topObjKey && (a.objections[topObjKey] ?? 0) > 0 ? (
                            <span className="text-[11px] bg-[#022EE8]/10 text-[#2AAAC8] px-2.5 py-1 rounded-full font-medium">{topObjKey}</span>
                          ) : <span className="text-[#8B8E8F] text-[11px]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-[#F7F7F7] font-semibold">
                    <td className="py-3 px-5 text-[12px] text-[#3D3D3D]">รวมทีม</td>
                    {OBJ_KEYS.map((k) => (
                      <td key={k} className="py-3 px-4 text-center text-[12px] text-[#3D3D3D]">{totals[k] || "—"}</td>
                    ))}
                    <td className="py-3 px-4 text-center text-[12px] text-[#3D3D3D]">
                      {OBJ_KEYS.reduce((s, k) => s + totals[k], 0) || "—"}
                    </td>
                    <td className="py-3 px-5">
                      {totals[topKey] > 0 && (
                        <span className="text-[11px] bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-medium">⚡ {topKey}</span>
                      )}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E8E8E8]">
          <p className="text-[10px] text-[#C0C0C0]">คำนวณจากการ parse note field — ยิ่ง agents กรอก note ละเอียด ผลยิ่งแม่น</p>
        </div>
      </div>
    </div>
  );
}
