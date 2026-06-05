"use server";

import { setDailyTarget, setAgentTarget, setAgentMonthlyTarget, setAgentOrekaExt, setOrekaLabel, setOrekaClosed, getCurrentUser } from "@/lib/db";
import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Normalize a Thai phone to Oreka's "+66..." Local Party format.
function normalizeThaiPhone(raw: string): string {
  const s = raw.replace(/[\s\-()]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("66")) return "+" + s;
  if (s.startsWith("0")) return "+66" + s.slice(1);
  return s;
}

export async function bulkUpdateAgentOrekaExt(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const agentIds = (formData.get("agentIds") as string ?? "").split(",").filter(Boolean);

  await Promise.all(
    agentIds.flatMap((agentId) => [
      setAgentOrekaExt(agentId, normalizeThaiPhone(String(formData.get(`oreka_${agentId}`) ?? ""))),
      adminClient.from("profiles").update({
        oreka_ext_hopeful: normalizeThaiPhone(String(formData.get(`oreka_hopeful_${agentId}`) ?? "")) || null,
      }).eq("id", agentId),
    ])
  );

  revalidatePath("/supervisor/settings");
  revalidatePath("/supervisor/talk-time");
}

export async function updateDailyTarget(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const raw = formData.get("target");
  const value = Number(raw);
  if (isNaN(value) || value <= 0) throw new Error("Invalid target value");

  await setDailyTarget(value, user.id);

  // Refresh all dashboards that show the target
  revalidatePath("/supervisor", "layout");
  revalidatePath("/my-desk", "layout");
  revalidatePath("/war-room");
}

export async function bulkUpdateAgentMonthlyTargets(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const monthKey = String(formData.get("monthKey") ?? "").trim();
  if (!monthKey) throw new Error("Missing month");

  const agentIds = (formData.get("agentIds") as string ?? "").split(",").filter(Boolean);

  await Promise.all(
    agentIds.map((agentId) => {
      const raw = formData.get(`target_${agentId}`);
      const value = Number(raw);
      if (!raw || isNaN(value) || value <= 0) return Promise.resolve();
      return setAgentMonthlyTarget(agentId, monthKey, value, user.id);
    })
  );

  revalidatePath("/supervisor/settings");
  revalidatePath("/my-desk", "layout");
}

export async function bulkUpdateAgentTargets(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const agentIds = (formData.get("agentIds") as string ?? "").split(",").filter(Boolean);

  await Promise.all(
    agentIds.map((agentId) => {
      const raw = formData.get(`target_${agentId}`);
      const value = Number(raw);
      if (!raw || isNaN(value) || value <= 0) return Promise.resolve();
      return setAgentTarget(agentId, value, user.id);
    })
  );

  revalidatePath("/supervisor", "layout");
  revalidatePath("/my-desk", "layout");
  revalidatePath("/war-room");
}

export async function saveOrekaLabel(ext: string, label: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  await setOrekaLabel(ext, label, user.id);
  revalidatePath("/supervisor/talk-time");
}

export async function toggleOrekaClosed(account: string, ext: string, closed: boolean) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  await setOrekaClosed(account, ext, closed, user.id);
  revalidatePath("/supervisor/talk-time");
}

export async function updateAgentTarget(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const agentId = String(formData.get("agentId") ?? "").trim();
  const raw = formData.get("target");
  const value = Number(raw);
  if (!agentId) throw new Error("No agent selected");
  if (isNaN(value) || value <= 0) throw new Error("Invalid target value");

  await setAgentTarget(agentId, value, user.id);

  revalidatePath("/supervisor", "layout");
  revalidatePath("/my-desk", "layout");
  revalidatePath("/war-room");
}
