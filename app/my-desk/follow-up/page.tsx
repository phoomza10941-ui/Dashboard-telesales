import { getMyData, filterFollowUp, getCurrentUser } from "@/lib/db";
import FollowUpClient from "./FollowUpClient";

export default async function FollowUpPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const followUpRows = filterFollowUp(allRows);

  return <FollowUpClient followUpRows={followUpRows} />;
}
