import { getMyData, filterPending, getCurrentUser } from "@/lib/db";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";

const PENDING_PRESETS = ["โอนแล้ว", "รอสลิป", "รอยืนยันอีกครั้ง", "ยกเลิก"];

export default async function PendingPaymentPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const pendingRows = filterPending(allRows);
  const totalPending = pendingRows.reduce((s, r) => s + r.phoneClose + r.upsell + r.crm, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Pending Payment</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            รายการที่หมายเหตุระบุว่ารอโอน / รอยืนยัน
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
          <div className="text-[11px] text-[#8B8E8F] mb-1">ยอดรอรับรวม</div>
          <div className="text-[22px] font-bold text-[#3D9B3A]">฿{totalPending.toLocaleString()}</div>
        </div>
        <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
          <div className="text-[11px] text-[#8B8E8F] mb-1">จำนวนเคส</div>
          <div className={`text-[22px] font-bold ${pendingRows.length > 0 ? "text-[#FF6B6B]" : "text-[#3D3D3D]"}`}>
            {pendingRows.length} เคส
          </div>
        </div>
      </div>

      {pendingRows.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#87DE81]/15 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#87DE81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีรายการรอโอน</p>
          <p className="text-[12px] text-[#8B8E8F] mt-1">
            รายการที่หมายเหตุมีคำว่า &ldquo;รอโอน&rdquo; หรือ &ldquo;รอยืนยัน&rdquo; จะแสดงที่นี่
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRows.map((row, i) => {
            const total = row.upsell + row.crm;
            return (
              <div key={i} className="bg-white border border-[#FF6B6B]/25 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#87DE81]/20 flex items-center justify-center text-[#3D9B3A] text-[12px] font-bold shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-[#3D3D3D]">{row.name}</span>
                      <span className="text-[11px] bg-[#FF6B6B]/10 text-[#FF6B6B] px-2 py-0.5 rounded-full font-medium">
                        รอดำเนินการ
                      </span>
                    </div>
                    {row.product && <p className="text-[12px] text-[#8B8E8F] mb-1">📦 {row.product}</p>}
                    {row.phone && <p className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</p>}
                    <div className="mt-2 bg-[#F7F7F7] rounded-lg px-3 py-2">
                      <p className="text-[11px] text-[#8B8E8F]">📝 หมายเหตุ: <span className="text-[#3D3D3D]">{row.note}</span></p>
                    </div>
                    {row.id && (
                      <UpdateNotePanel
                        saleId={row.id}
                        currentNote={row.note}
                        presets={PENDING_PRESETS}
                      />
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[20px] font-bold text-[#3D3D3D] mb-3">
                      {total > 0 ? `฿${total.toLocaleString()}` : "—"}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button className="bg-[#87DE81] text-white text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#6BC965]">
                        ตามโอน
                      </button>
                      <button className="bg-[#58CEE8]/15 text-[#0E8FA8] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#58CEE8]/25">
                        แจ้ง Sup
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
