import { getCurrentUser, getCustomers, Customer } from "@/lib/db";
import { getTodayRecordingsForExts } from "@/lib/oreka";
import { redirect } from "next/navigation";
import AnalyzeCallPanel from "./AnalyzeCallPanel";

export default async function CustomersListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // getCurrentUser() already returns orekaExtGosell / orekaExtHopeful as typed fields
  const orekaExtGosell = user.orekaExtGosell ?? "";
  const orekaExtHopeful = user.orekaExtHopeful ?? "";

  // Prefetch recordings + customers in parallel so panel opens instantly
  const exts = [orekaExtGosell, orekaExtHopeful].filter(Boolean);
  const [customers, recordings] = await Promise.all([
    getCustomers(user.id),
    exts.length > 0 ? getTodayRecordingsForExts(exts).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รายชื่อลูกค้า</h1>
        <p className="text-[13px] text-[#8B8E8F] mt-1">ข้อมูลลูกค้าที่ดึงจากสายโทรด้วย AI</p>
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
        <div className="bg-white border border-[#E8E8E8] rounded-2xl divide-y divide-[#E8E8E8]">
          {customers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              agentId={user.id}
              orekaExtGosell={orekaExtGosell}
              orekaExtHopeful={orekaExtHopeful}
              initialRecordings={recordings}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  agentId,
  orekaExtGosell,
  orekaExtHopeful,
  initialRecordings,
}: {
  customer: Customer;
  agentId: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
  initialRecordings: Awaited<ReturnType<typeof getTodayRecordingsForExts>>;
}) {
  const displayName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";
  const initial = (customer.firstName ?? customer.nickname ?? "?").charAt(0).toUpperCase();
  const hasData = !!(customer.firstName || customer.lastName || customer.diseases);

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
          hasData ? "bg-[#87DE81] text-white" : "bg-[#E8E8E8] text-[#8B8E8F]"
        }`}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#3D3D3D] flex items-center gap-2">
          {displayName}
          {customer.nickname && (
            <span className="text-[11px] text-[#8B8E8F] font-normal">({customer.nickname})</span>
          )}
        </div>
        <div className="text-[11px] text-[#8B8E8F] flex items-center gap-2 mt-0.5">
          {customer.diseases && <span>💊 {customer.diseases}</span>}
          {customer.phone && <span>📞 {customer.phone}</span>}
          {!hasData && <span className="text-[#C0C0C0]">ยังไม่มีข้อมูล AI</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <AnalyzeCallPanel
          agentId={agentId}
          customerId={customer.id}
          orekaExtGosell={orekaExtGosell}
          orekaExtHopeful={orekaExtHopeful}
          initialRecordings={initialRecordings}
          trigger={
            <button className="text-[11px] px-3 py-1.5 border border-[#58CEE8] text-[#58CEE8] rounded-lg hover:bg-[#f0fbff] transition-colors">
              🎙 วิเคราะห์สาย
            </button>
          }
        />
      </div>
    </div>
  );
}
