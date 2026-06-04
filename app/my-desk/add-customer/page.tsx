import { getCurrentUser, getProducts } from "@/lib/db";
import AddCustomerForm from "./AddCustomerForm";

export default async function AddCustomerPage() {
  const [user, products] = await Promise.all([getCurrentUser(), getProducts()]);
  const agentName = user?.nickname ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">กรอกข้อมูลลูกค้า</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">
          บันทึกข้อมูลลงใน Supabase โดยตรง — ไม่ต้องเปิด Sheets แยก
        </p>
      </div>
      <AddCustomerForm agentName={agentName} products={products} />
    </div>
  );
}
