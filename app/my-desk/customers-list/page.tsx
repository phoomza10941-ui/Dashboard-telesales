import { getCurrentUser, getCustomers } from "@/lib/db";
import { getTodayRecordingsForExts } from "@/lib/oreka";
import { redirect } from "next/navigation";
import AnalyzeCallPanel from "./AnalyzeCallPanel";
import CustomerList from "./CustomerList";
import AddCustomerPanel from "./AddCustomerPanel";

export default async function CustomersListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orekaExtGosell = user.orekaExtGosell ?? "";
  const orekaExtHopeful = user.orekaExtHopeful ?? "";

  const exts = [orekaExtGosell, orekaExtHopeful].filter(Boolean);
  const [customers, recordings] = await Promise.all([
    getCustomers(user.id),
    exts.length > 0 ? getTodayRecordingsForExts(exts).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รายชื่อลูกค้า</h1>
          <p className="text-[13px] text-[#8B8E8F] mt-1">ข้อมูลลูกค้าที่ดึงจากสายโทรด้วย AI</p>
        </div>
        <AddCustomerPanel agentId={user.id} />
      </div>

      {customers.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-12 text-center">
          <div className="text-[32px] mb-3">👤</div>
          <div className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีข้อมูลลูกค้า</div>
          <div className="text-[12px] text-[#8B8E8F] mt-1">
            กดปุ่ม &ldquo;วิเคราะห์สาย&rdquo; หลังจากคุยกับลูกค้าเพื่อดึงข้อมูลอัตโนมัติ
          </div>
          <div className="mt-4 flex justify-center">
            <AnalyzeCallPanel
              agentId={user.id}
              orekaExtGosell={orekaExtGosell}
              orekaExtHopeful={orekaExtHopeful}
              initialRecordings={recordings}
              trigger={
                <button className="flex items-center gap-2 bg-[#58CEE8] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#3DB8D4] transition-colors">
                  🎙 วิเคราะห์สายแรก
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <CustomerList
          customers={customers}
          agentId={user.id}
          orekaExtGosell={orekaExtGosell}
          orekaExtHopeful={orekaExtHopeful}
          initialRecordings={recordings}
        />
      )}
    </div>
  );
}
