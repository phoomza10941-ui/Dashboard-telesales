"use server";

import { addProduct, deleteProduct } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addProductAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("ชื่อสินค้าว่างเปล่า");
  await addProduct(name);
  revalidatePath("/supervisor/settings");
  revalidatePath("/my-desk/add-customer");
}

export async function deleteProductAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("ไม่พบชื่อสินค้า");
  await deleteProduct(name);
  revalidatePath("/supervisor/settings");
  revalidatePath("/my-desk/add-customer");
}
