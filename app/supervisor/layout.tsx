export const dynamic = "force-dynamic";
import { getDailyTarget, getAllAgentsAnalysis, getCurrentUser } from "@/lib/db";
import SupervisorNav from "./components/SupervisorNav";
import RealtimeRefresh from "@/app/components/RealtimeRefresh";
import { redirect } from "next/navigation";
import PageTransition from "@/app/my-desk/components/PageTransition";

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") redirect("/my-desk/today-command");

  const [dailyTarget, agents] = await Promise.all([
    getDailyTarget(),
    getAllAgentsAnalysis(),
  ]);

  const todayTotal = agents.reduce((s, a) => s + a.todaySales, 0);
  const pct = Math.min(Math.round((todayTotal / dailyTarget) * 100), 100);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <SupervisorNav fullName={user.fullName || user.nickname} avatarUrl={user.avatarUrl} nickname={user.nickname} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-[#E8E8E8] px-6 h-[56px] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#87DE81] animate-pulse" />
            <span className="text-[13px] font-semibold text-[#3D3D3D]">แดชบอร์ด Supervisor</span>
            <span className="text-[11px] text-[#8B8E8F] bg-[#F7F7F7] px-2 py-0.5 rounded-full">สด</span>
          </div>

          <div className="flex items-center gap-5">
            {/* Team progress vs target */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#8B8E8F]">ยอดทีมวันนี้</span>
              <span className="text-[13px] font-semibold text-[#3D3D3D]">฿{todayTotal.toLocaleString()}</span>
              <span className="text-[11px] text-[#8B8E8F]">/</span>
              <span className="text-[12px] font-semibold text-[#022EE8]">฿{dailyTarget.toLocaleString()}</span>
              <div className="w-20 h-1.5 bg-[#E8E8E8] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${pct >= 80 ? "bg-[#87DE81]" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-[12px] font-bold ${pct >= 80 ? "text-[#3D9B3A]" : pct >= 50 ? "text-amber-600" : "text-red-500"}`}>
                {pct}%
              </span>
            </div>

            <div className="w-px h-5 bg-[#E8E8E8]" />

            <div className="flex items-center gap-1.5 text-[12px] text-[#8B8E8F]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              <span>{agents.length} คน</span>
            </div>

            <span className="text-[11px] text-[#8B8E8F]">
              {new Date().toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F7F7F7] p-6">
          <RealtimeRefresh />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
