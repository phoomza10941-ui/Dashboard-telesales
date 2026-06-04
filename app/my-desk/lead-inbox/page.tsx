export default function LeadInboxPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">Lead Inbox</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">Lead ที่ได้รับและยังไม่ได้โทร</p>
      </div>
      <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
        <div className="text-4xl mb-3">📥</div>
        <p className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีระบบ Lead เชื่อมต่อ</p>
        <p className="text-[12px] text-[#8B8E8F] mt-1 max-w-sm mx-auto">
          Lead Inbox ต้องการแหล่งข้อมูล Lead แยกต่างหาก เช่น Facebook Lead Ads API หรือ CRM ภายนอก
        </p>
      </div>
    </div>
  );
}
