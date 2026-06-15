import { getCurrentUser, getAppointments } from "@/lib/db";
import AppointmentCalendar from "./AppointmentCalendar";

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  const now = new Date(Date.now() + 7 * 3600000);
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const appointments = user ? await getAppointments(user.id, { month }) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">นัดหมาย</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">จัดการตารางนัดหมายลูกค้า</p>
      </div>
      <AppointmentCalendar initialAppointments={appointments} initialMonth={month} />
    </div>
  );
}
