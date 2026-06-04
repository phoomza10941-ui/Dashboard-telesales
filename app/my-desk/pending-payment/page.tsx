import { getMyData, filterPending, getCurrentUser } from "@/lib/db";
import PendingPaymentClient from "./PendingPaymentClient";

export default async function PendingPaymentPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const pendingRows = filterPending(allRows);

  return <PendingPaymentClient pendingRows={pendingRows} />;
}
