import { getMyData, getCurrentUser, parseNoteStatus } from "@/lib/db";
import PriorityQueueClient from "./PriorityQueueClient";

export default async function PriorityQueuePage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];

  const activeRows = allRows.filter((r) => {
    const s = parseNoteStatus(r.note);
    return s !== "closed" && s !== "lost";
  });

  return <PriorityQueueClient activeRows={activeRows} />;
}
