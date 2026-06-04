import { NextRequest, NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/avatar.jpg`;

  const { error } = await adminClient.storage
    .from("avatars")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = adminClient.storage.from("avatars").getPublicUrl(path);

  // Bust cache by appending a timestamp query param
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return NextResponse.json({ url });
}
