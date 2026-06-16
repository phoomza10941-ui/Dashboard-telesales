"use server";

import { getCurrentUser, reassignSales } from "@/lib/db";

export async function reassignSalesAction(saleIds: string[], newAgentId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "supervisor") {
    return { error: "Unauthorized" };
  }
  if (!saleIds.length || !newAgentId) {
    return { error: "Invalid input" };
  }
  try {
    await reassignSales(saleIds, newAgentId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
