import { getCurrentUser } from "@/lib/db";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">โปรไฟล์ของฉัน</h1>
        <p className="text-[13px] text-[#8B8E8F] mt-0.5">ตั้งค่าข้อมูลส่วนตัวและเบอร์ Oreka</p>
      </div>
      <ProfileForm
        fullName={user.fullName}
        nickname={user.nickname}
        agentCode={user.agentCode}
        team={user.team}
      />
      <div className="max-w-lg mt-6">
        <ChangePasswordForm username={user.username} />
      </div>
    </div>
  );
}
