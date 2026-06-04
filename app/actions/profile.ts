"use server";

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCurrentUser, setMyOrekaExt } from "@/lib/db";
import { invalidateTalkTimeCache } from "@/lib/oreka";
import { revalidatePath } from "next/cache";

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-()]/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("66")) return "+" + s;
  if (s.startsWith("0")) return "+66" + s.slice(1);
  return s;
}

export async function saveMyOrekaExt(gosell: string, hopeful: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  await setMyOrekaExt(user.id, normalizePhone(gosell), normalizePhone(hopeful));
  invalidateTalkTimeCache();
  revalidatePath("/my-desk", "layout");
  revalidatePath("/supervisor/talk-time");
}

export async function updateNickname(nickname: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  const trimmed = nickname.trim();
  if (!trimmed) throw new Error("Nickname cannot be empty");

  await supabase.auth.updateUser({ data: { nickname: trimmed } });
  await adminClient.from("profiles").update({ nickname: trimmed }).eq("id", user.id);

  revalidatePath("/my-desk", "layout");
}

export async function updateAvatarUrl(url: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.auth.updateUser({ data: { avatar_url: url } });

  revalidatePath("/my-desk", "layout");
}
