import { getMyData, filterClosed, getCurrentUser } from "@/lib/db";
import CustomersListClient from "./CustomersListClient";

export default async function CustomersListPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const closedRows = filterClosed(allRows);
  const hasOrekaExt = !!(user?.orekaExtGosell || user?.orekaExtHopeful);

  return (
    <CustomersListClient
      rows={closedRows}
      allRows={allRows}
      hasOrekaExt={hasOrekaExt}
    />
  );
}
