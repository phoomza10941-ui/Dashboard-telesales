import { getMyData, getCurrentUser, getAgentTarget } from "@/lib/db";
import PerformanceClient from "./PerformanceClient";

export default async function MyPerformancePage() {
  const user = await getCurrentUser();
  const [data, dailyTarget] = await Promise.all([
    user ? getMyData(user.id) : Promise.resolve(null),
    user ? getAgentTarget(user.id) : Promise.resolve(80000),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">My Performance</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ผลงานของคุณจาก Supabase</p>
      </div>
      <PerformanceClient data={data} dailyTarget={dailyTarget} />
    </div>
  );
}
