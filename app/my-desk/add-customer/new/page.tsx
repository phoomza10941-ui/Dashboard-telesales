import { getCurrentUser } from "@/lib/db";
import NewContactForm from "./NewContactForm";

export default async function NewContactPage() {
  const user = await getCurrentUser();
  const agentName = user?.nickname ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">กรอกข้อมูลลูกค้า</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          เพิ่มลูกค้าใหม่ — ชื่อ เบอร์โทร และช่องทาง (ยอดขายบันทึกทีหลังที่การ์ดลูกค้า)
        </p>
      </div>
      <NewContactForm agentName={agentName} />
    </div>
  );
}
