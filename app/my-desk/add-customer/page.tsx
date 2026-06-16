import { getMyData, getCurrentUser } from "@/lib/db";
import AddCustomerCardsClient from "./AddCustomerCardsClient";

export default async function AddCustomerPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const hasOrekaExt = !!(user?.orekaExtGosell || user?.orekaExtHopeful);

  return <AddCustomerCardsClient rows={allRows} hasOrekaExt={hasOrekaExt} />;
}
