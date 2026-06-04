import { getCurrentUser, getCoachingSessions } from "@/lib/db";

export default async function CoachingPage() {
  const user = await getCurrentUser();
  const allSessions = await getCoachingSessions().catch(() => []);

  // Filter to sessions for this agent by nickname
  const sessions = user
    ? allSessions.filter((s) => s.agentName === user.nickname)
    : [];

  const latest = sessions[0] ?? null;
  const history = sessions.slice(1);

  const RESULT_LABEL: Record<string, string> = {
    improved: "ดีขึ้น",
    ok: "โอเค",
    pending: "รอดู",
  };
  const RESULT_STYLE: Record<string, string> = {
    improved: "bg-green-100 text-green-700",
    ok: "bg-blue-100 text-blue-600",
    pending: "bg-[#F7F7F7] text-[#8B8E8F]",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Coaching / Feedback</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">Feedback และประวัติการโค้ชจาก Supervisor</p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-10 text-center">
          <p className="text-[13px] text-[#8B8E8F]">ยังไม่มีการโค้ชจาก Supervisor</p>
        </div>
      ) : (
        <>
          {/* Latest coaching note */}
          {latest && (
            <div className="bg-white border border-[#022EE8]/30 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#022EE8]/20 flex items-center justify-center text-[#0E8FA8] text-[11px] font-bold shrink-0">
                  Sup
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-semibold text-[#0E8FA8]">Note จาก Supervisor ล่าสุด</p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${RESULT_STYLE[latest.result] ?? RESULT_STYLE.pending}`}>
                      {RESULT_LABEL[latest.result] ?? "รอดู"}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-[#3D3D3D] mb-1">{latest.topic}</p>
                  {latest.actionItem && (
                    <p className="text-[13px] text-[#3D3D3D] leading-relaxed">
                      <span className="text-[#8B8E8F]">Action: </span>{latest.actionItem}
                    </p>
                  )}
                  {latest.followUpDate && latest.followUpDate !== "—" && (
                    <p className="text-[12px] text-[#8B8E8F] mt-1">นัดติดตาม: {latest.followUpDate}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white border border-[#E8E8E8] rounded-xl p-5">
              <h2 className="text-[13px] font-semibold text-[#3D3D3D] mb-4">ประวัติ Feedback ย้อนหลัง</h2>
              <div className="space-y-0">
                {history.map((h) => {
                  const date = new Date(h.createdAt);
                  const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
                  const res = RESULT_STYLE[h.result] ?? RESULT_STYLE.pending;
                  const resLabel = RESULT_LABEL[h.result] ?? "รอดู";
                  return (
                    <div key={h.id} className="flex items-center gap-4 py-3 border-b border-[#E8E8E8] last:border-0">
                      <div className="w-16 text-[11px] text-[#8B8E8F] shrink-0">{dateStr}</div>
                      <div className="flex-1">
                        <span className="text-[12px] font-medium text-[#3D3D3D]">{h.topic}</span>
                        {h.actionItem && (
                          <p className="text-[11px] text-[#8B8E8F] mt-0.5">{h.actionItem}</p>
                        )}
                      </div>
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${res}`}>{resLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
