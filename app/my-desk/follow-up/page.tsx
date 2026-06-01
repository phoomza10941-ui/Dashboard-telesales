import { getMyData, filterFollowUp, getCurrentUser } from "@/lib/db";
import UpdateNotePanel from "@/app/my-desk/components/UpdateNotePanel";

const FOLLOW_UP_PRESETS = ["โอนแล้ว", "นัดโทรพรุ่งนี้", "ไม่รับสาย", "ติดตามอีกครั้ง", "ยกเลิก"];

export default async function FollowUpPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const followUpRows = filterFollowUp(allRows);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Follow-up</h1>
          <p className="text-[12px] text-[#8B8E8F] mt-0.5">
            รายการที่หมายเหตุระบุว่าต้องติดตาม / นัดโทร
          </p>
        </div>
        <div className="text-[12px] text-[#8B8E8F] bg-white border border-[#E8E8E8] rounded-lg px-3 py-1.5">
          ทั้งหมด <span className="font-semibold text-[#3D3D3D]">{followUpRows.length} เคส</span>
        </div>
      </div>

      {followUpRows.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#58CEE8]/10 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58CEE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="6"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีรายการ Follow-up</p>
          <p className="text-[12px] text-[#8B8E8F] mt-1">
            รายการที่หมายเหตุมีคำว่า &ldquo;ติดตาม&rdquo; หรือ &ldquo;นัด&rdquo; จะแสดงที่นี่
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {followUpRows.map((row, i) => {
            const total = row.phoneClose + row.upsell + row.crm;
            return (
              <div key={i} className="bg-white border border-[#58CEE8]/25 rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#58CEE8]/15 flex items-center justify-center text-[#0E8FA8] text-[12px] font-bold shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-[#3D3D3D]">{row.name}</span>
                      <span className="text-[10px] bg-[#58CEE8]/10 text-[#0E8FA8] px-2 py-0.5 rounded-full">
                        ติดตาม
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-1.5">
                      {row.product && <span className="text-[11px] text-[#8B8E8F]">📦 {row.product}</span>}
                      {row.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {row.phone}</span>}
                      {total > 0 && <span className="text-[11px] font-semibold text-[#3D9B3A]">฿{total.toLocaleString()}</span>}
                      <span className="text-[11px] text-[#C0C0C0]">{row.date}</span>
                    </div>
                    {row.note && (
                      <div className="bg-[#F7F7F7] rounded-lg px-3 py-2">
                        <p className="text-[11px] text-[#8B8E8F]">📝 {row.note}</p>
                      </div>
                    )}
                    {row.id && (
                      <UpdateNotePanel
                        saleId={row.id}
                        currentNote={row.note}
                        presets={FOLLOW_UP_PRESETS}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button className="bg-[#87DE81] text-white text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#6BC965]">
                      โทร
                    </button>
                    <button className="bg-[#58CEE8]/15 text-[#0E8FA8] text-[12px] font-medium px-4 py-1.5 rounded-lg hover:bg-[#58CEE8]/25">
                      ส่งข้อความ
                    </button>
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
