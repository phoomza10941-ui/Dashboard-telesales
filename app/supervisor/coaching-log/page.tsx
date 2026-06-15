import { getCoachingSessions, getAllAgentsAnalysis } from "@/lib/db";
import CoachingForm from "./CoachingForm";

const RESULT_STYLE: Record<string, { label: string; style: string }> = {
  improved: { label: "ดีขึ้น", style: "bg-green-100 text-green-700" },
  ok:       { label: "โอเค",   style: "bg-blue-100 text-blue-600" },
  pending:  { label: "รอดู",   style: "bg-[#F7F7F7] text-[#8B8E8F]" },
};

export default async function CoachingLogPage() {
  const [sessions, agents] = await Promise.all([
    getCoachingSessions().catch(() => []),
    getAllAgentsAnalysis().catch(() => []),
  ]);
  const agentNames = agents.map((a) => a.agentName);

  const improved = sessions.filter((s) => s.result === "improved").length;
  const pending  = sessions.filter((s) => s.result === "pending").length;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">บันทึก Coaching</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ประวัติการโค้ช / ติดตามผล — บันทึกลง Database</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
          <div className="text-[10px] text-[#8B8E8F] mb-1">โค้ชทั้งหมด</div>
          <div className="text-[22px] font-bold text-[#3D3D3D]">{sessions.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
          <div className="text-[10px] text-[#8B8E8F] mb-1">ดีขึ้นแล้ว</div>
          <div className="text-[22px] font-bold text-[#3D9B3A]">{improved}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E8E8] px-4 py-3.5">
          <div className="text-[10px] text-[#8B8E8F] mb-1">รอติดตามผล</div>
          <div className="text-[22px] font-bold text-amber-500">{pending}</div>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-5 mb-5">
        <CoachingForm agents={agentNames} />
      </div>

      {/* Sessions table */}
      <div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-[#E8E8E8]">
                {["วันที่", "Agent", "หัวข้อโค้ช", "Action", "นัดติดตาม", "ผล"].map((h) => (
                  <th key={h} className="text-left text-[11px] text-[#8B8E8F] font-medium py-3.5 px-5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[12px] text-[#8B8E8F]">
                    ยังไม่มีการบันทึก — เริ่มบันทึกการโค้ชด้านบน
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const res = RESULT_STYLE[s.result] ?? RESULT_STYLE.pending;
                  const date = new Date(s.createdAt);
                  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
                  return (
                    <tr key={s.id} className="border-b border-[#F7F7F7] hover:bg-[#F7F7F7]/60 transition-colors">
                      <td className="py-4 px-5 text-[#8B8E8F]">{dateStr}</td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#022EE8] text-[10px] font-bold">
                            {s.agentName.charAt(0)}
                          </div>
                          <span className="font-medium text-[#3D3D3D]">{s.agentName}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[#3D3D3D]">{s.topic}</td>
                      <td className="py-4 px-5 text-[#8B8E8F]">{s.actionItem || "—"}</td>
                      <td className="py-4 px-5 text-[#8B8E8F]">{s.followUpDate || "—"}</td>
                      <td className="py-4 px-5">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${res.style}`}>{res.label}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
