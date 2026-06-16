import { getCurrentUser } from "@/lib/db";
import SideNav from "./components/SideNav";
import StickyKpiBar from "./components/StickyKpiBar";
import RealtimeRefresh from "@/app/components/RealtimeRefresh";
import PageTransition from "./components/PageTransition";

export default async function MyDeskLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const fullName = user?.fullName ?? "";
  const agentCode = user?.agentCode ?? "";
  const team = user?.team ?? "";
  const userId = user?.id ?? "";
  const avatarUrl = user?.avatarUrl ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <SideNav
        fullName={fullName} agentCode={agentCode} team={team}
        avatarUrl={avatarUrl} nickname={user?.nickname ?? ""}
        orekaExtGosell={user?.orekaExtGosell ?? ""}
        orekaExtHopeful={user?.orekaExtHopeful ?? ""}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <StickyKpiBar userId={userId} />
        <main className="flex-1 overflow-y-auto bg-[#F7F7F7] p-6">
          <RealtimeRefresh />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
