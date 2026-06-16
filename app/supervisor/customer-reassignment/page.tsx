import { redirect } from "next/navigation";
import { getCurrentUser, getAgentProfiles } from "@/lib/db";
import ReassignmentClient from "./ReassignmentClient";

export default async function CustomerReassignmentPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") redirect("/login");

  const agents = await getAgentProfiles();

  return (
    <div className="flex flex-col gap-5 h-full p-6 overflow-hidden">
      <div>
        <h1 className="text-[16px] font-semibold text-[#3D3D3D]">โอนลูกค้า</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          เลือก Agent ที่ไม่อยู่ และโอนลูกค้าไปให้ Agent ที่พร้อม
        </p>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        <ReassignmentClient agents={agents} />
      </div>
    </div>
  );
}
