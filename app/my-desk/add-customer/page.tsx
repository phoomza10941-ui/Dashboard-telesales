import { getMyData, getCurrentUser, getProducts } from "@/lib/db";
import AddCustomerCardsClient from "./AddCustomerCardsClient";

export default async function AddCustomerPage() {
  const user = await getCurrentUser();
  const [data, products] = await Promise.all([
    user ? getMyData(user.id) : null,
    getProducts(),
  ]);
  const allRows = data?.rows ?? [];
  const hasOrekaExt = !!(user?.orekaExtGosell || user?.orekaExtHopeful);

  return (
    <AddCustomerCardsClient
      rows={allRows}
      hasOrekaExt={hasOrekaExt}
      agentName={user?.nickname ?? ""}
      products={products}
    />
  );
}
