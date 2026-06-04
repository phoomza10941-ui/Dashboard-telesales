import { getMyData, filterLost, getCurrentUser } from "@/lib/db";
import CanceledClient from "./CanceledClient";

export default async function CanceledPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const lostRows = filterLost(data?.rows ?? []);

  return <CanceledClient lostRows={lostRows} />;
}
