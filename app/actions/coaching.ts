"use server";

import { addCoachingSession, updateCoachingResult, getCurrentUser } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createCoachingSession(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const agentName = formData.get("agentName") as string;
  const topic = formData.get("topic") as string;
  const actionItem = (formData.get("actionItem") as string) ?? "";
  const followUpDate = (formData.get("followUpDate") as string) ?? "";

  if (!agentName || !topic) throw new Error("Agent and topic are required");

  await addCoachingSession({
    agentName,
    topic,
    actionItem,
    followUpDate,
    result: "pending",
    createdBy: user.id,
  });

  revalidatePath("/supervisor/coaching-log");
}

export async function markCoachingResult(id: string, result: string) {
  await updateCoachingResult(id, result);
  revalidatePath("/supervisor/coaching-log");
}
