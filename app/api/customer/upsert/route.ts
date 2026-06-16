import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertCustomer } from "@/lib/db";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  try {
    const customer = await upsertCustomer(user.id, {
      id: body.id,
      phone: body.phone,
      firstName: body.first_name,
      lastName: body.last_name,
      nickname: body.nickname,
      diseases: body.diseases,
      symptoms: body.symptoms,
      medications: body.medications,
      consultedDoc: body.consulted_doc,
      patientType: body.patient_type,
      orekaRecId: body.orekaRecId,
    });
    return NextResponse.json(customer);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upsert failed" },
      { status: 500 }
    );
  }
}
