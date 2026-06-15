import { getMyData, getCurrentUser, getAgentTarget } from "@/lib/db";
import { getTalkTimeByAgentSafe } from "@/lib/oreka";
import PerformanceClient from "./PerformanceClient";

export default async function MyPerformancePage() {
  const user = await getCurrentUser();
  const [data, dailyTarget, talkTimeResult] = await Promise.all([
    user ? getMyData(user.id) : Promise.resolve(null),
    user ? getAgentTarget(user.id) : Promise.resolve(80000),
    getTalkTimeByAgentSafe(),
  ]);

  // Filter talk time to only this user's ext numbers
  const myExts = new Set([user?.orekaExtGosell, user?.orekaExtHopeful].filter(Boolean) as string[]);
  const myTalkTime = (talkTimeResult.data ?? []).filter(a => myExts.has(a.orekaExt));
  const totalTalkSeconds = myTalkTime.reduce((s, a) => s + a.totalSeconds, 0);
  const totalCalls = myTalkTime.reduce((s, a) => s + a.callCount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">ผลงานของฉัน</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ผลงานของคุณจาก Supabase</p>
      </div>
      <PerformanceClient
        data={data}
        dailyTarget={dailyTarget}
        talkSeconds={totalTalkSeconds}
        talkCalls={totalCalls}
        hasOrekaExt={myExts.size > 0}
      />
    </div>
  );
}
