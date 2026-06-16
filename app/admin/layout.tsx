import { getCurrentUser } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") redirect("/my-desk/today-command");

  return <>{children}</>;
}
