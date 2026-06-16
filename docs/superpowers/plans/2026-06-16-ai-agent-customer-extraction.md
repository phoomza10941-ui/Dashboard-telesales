# AI Agent — Customer Extraction + Notion Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull product knowledge from Notion and inject it into OpenAI calls; transcribe Oreka recordings with Whisper and extract structured customer health fields into a new `customers` table; add supervisor config UI.

**Architecture:** `lib/notion.ts` fetches + caches the Notion page as plain text (30-min TTL). `lib/call-summary.ts` gets a new `extractCustomerInfo()` that runs Whisper then GPT with Notion context injected. A new API route `/api/customer/analyze` orchestrates the flow. The customer list page at `/my-desk/customers-list` shows customers and opens a slide-in panel for the extraction flow. Supervisor config lives as a new card in `/supervisor/settings`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (adminClient), OpenAI SDK v6 (gpt-4o-mini + gpt-4o-transcribe), Notion REST API v2022-06-28, Tailwind CSS v4

---

## File Map

| File | Action |
|------|--------|
| `scripts/add-customers-table.sql` | Create — migration script |
| `lib/notion.ts` | Create — Notion fetch + 30-min cache |
| `lib/db.ts` | Edit — add `Customer` type + 5 new functions |
| `lib/call-summary.ts` | Edit — add `extractCustomerInfo()` + Notion injection |
| `app/api/customer/analyze/route.ts` | Create — POST endpoint |
| `app/api/supervisor/ai-fields/route.ts` | Create — GET/POST for field config |
| `app/my-desk/customers-list/page.tsx` | Create — server component |
| `app/my-desk/customers-list/AnalyzeCallPanel.tsx` | Create — client slide-in panel |
| `app/supervisor/settings/page.tsx` | Edit — add AI Agent card |

---

## Task 1: Database Migration

**Files:**
- Create: `scripts/add-customers-table.sql`

- [ ] **Step 1: Write the SQL migration**

Create `scripts/add-customers-table.sql`:

```sql
-- customers table: one profile per customer, scoped to agent
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES auth.users NOT NULL,
  phone         TEXT,
  first_name    TEXT,
  last_name     TEXT,
  nickname      TEXT,
  diseases      TEXT,
  symptoms      TEXT,
  medications   TEXT,
  consulted_doc TEXT,
  patient_type  TEXT,
  oreka_rec_id  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents see own customers" ON customers
  FOR ALL USING (agent_id = auth.uid());

-- Allow admin/service role to bypass RLS
CREATE POLICY "service role bypass" ON customers
  FOR ALL TO service_role USING (true);

-- AI extraction fields config (stored in team_config)
-- Key: 'ai_extraction_fields', Value: JSON object of field toggles
-- Insert default if not exists
INSERT INTO team_config (key, value)
VALUES ('ai_extraction_fields', '{"first_name":true,"last_name":true,"nickname":true,"diseases":true,"symptoms":true,"medications":true,"consulted_doc":true,"patient_type":true}')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard → SQL Editor → paste and run the script.

Verify with:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'customers';
SELECT * FROM team_config WHERE key = 'ai_extraction_fields';
```

Expected: 14 columns in customers, one row in team_config.

- [ ] **Step 3: Commit**

```bash
git add scripts/add-customers-table.sql
git commit -m "feat(db): add customers table + ai_extraction_fields config"
```

---

## Task 2: Notion Product Knowledge Module

**Files:**
- Create: `lib/notion.ts`

- [ ] **Step 1: Create lib/notion.ts**

```typescript
const NOTION_PAGE_ID = "32fb29d9a9fe815794cef7a6ae6dad39";
const NOTION_VERSION = "2022-06-28";
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { text: string; expiresAt: number } | null = null;

async function fetchBlocks(blockId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
    }
  );
  if (!res.ok) throw new Error(`Notion API ${res.status}`);
  const data = await res.json();

  let text = "";
  for (const block of data.results ?? []) {
    const richText: string = extractRichText(block);
    if (richText) text += richText + "\n";
    if (block.has_children) {
      const childText = await fetchBlocks(block.id, token);
      if (childText) text += childText;
    }
  }
  return text;
}

function extractRichText(block: Record<string, unknown>): string {
  const type = block.type as string;
  if (!type) return "";
  const content = block[type] as Record<string, unknown> | undefined;
  if (!content) return "";

  if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
    const parts = (content.rich_text as Array<{ plain_text: string }> ?? [])
      .map((r) => r.plain_text)
      .join("");
    return `\n=== ${parts} ===`;
  }

  if (type === "divider") return "";
  if (type === "table_of_contents") return "";

  const rtArray = content.rich_text as Array<{ plain_text: string }> | undefined;
  if (!Array.isArray(rtArray)) return "";
  return rtArray.map((r) => r.plain_text).join("").trim();
}

export async function getProductKnowledge(): Promise<string> {
  const token = process.env.NOTION_TOKEN;
  if (!token) return "";

  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.text;

  try {
    const text = await fetchBlocks(NOTION_PAGE_ID, token);
    cache = { text, expiresAt: now + CACHE_TTL_MS };
    return text;
  } catch {
    return cache?.text ?? "";
  }
}

export function clearProductKnowledgeCache(): void {
  cache = null;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/notion.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/notion.ts
git commit -m "feat(notion): add product knowledge fetch + 30-min cache"
```

---

## Task 3: DB Layer — Customer Functions

**Files:**
- Modify: `lib/db.ts`

- [ ] **Step 1: Add Customer type and functions to lib/db.ts**

Add at the end of `lib/db.ts`:

```typescript
// ─── Customer profile ────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  agentId: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  diseases: string | null;
  symptoms: string | null;
  medications: string | null;
  consultedDoc: string | null;
  patientType: string | null;
  orekaRecId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id as string,
    agentId: r.agent_id as string,
    phone: (r.phone as string) ?? null,
    firstName: (r.first_name as string) ?? null,
    lastName: (r.last_name as string) ?? null,
    nickname: (r.nickname as string) ?? null,
    diseases: (r.diseases as string) ?? null,
    symptoms: (r.symptoms as string) ?? null,
    medications: (r.medications as string) ?? null,
    consultedDoc: (r.consulted_doc as string) ?? null,
    patientType: (r.patient_type as string) ?? null,
    orekaRecId: (r.oreka_rec_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function getCustomers(agentId: string): Promise<Customer[]> {
  const { data, error } = await adminClient
    .from("customers")
    .select("*")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map(rowToCustomer);
}

export async function upsertCustomer(
  agentId: string,
  fields: Partial<Omit<Customer, "id" | "agentId" | "createdAt" | "updatedAt">> & { id?: string }
): Promise<Customer> {
  const payload: Record<string, unknown> = {
    agent_id: agentId,
    phone: fields.phone ?? null,
    first_name: fields.firstName ?? null,
    last_name: fields.lastName ?? null,
    nickname: fields.nickname ?? null,
    diseases: fields.diseases ?? null,
    symptoms: fields.symptoms ?? null,
    medications: fields.medications ?? null,
    consulted_doc: fields.consultedDoc ?? null,
    patient_type: fields.patientType ?? null,
    oreka_rec_id: fields.orekaRecId ?? null,
    notes: fields.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  if (fields.id) payload.id = fields.id;

  const { data, error } = await adminClient
    .from("customers")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "upsert failed");
  return rowToCustomer(data);
}

// ─── AI extraction field config ───────────────────────────────────────────────

export interface AiExtractionFields {
  first_name: boolean;
  last_name: boolean;
  nickname: boolean;
  diseases: boolean;
  symptoms: boolean;
  medications: boolean;
  consulted_doc: boolean;
  patient_type: boolean;
}

const DEFAULT_AI_FIELDS: AiExtractionFields = {
  first_name: true, last_name: true, nickname: true,
  diseases: true, symptoms: true, medications: true,
  consulted_doc: true, patient_type: true,
};

export async function getAiExtractionFields(): Promise<AiExtractionFields> {
  const { data } = await adminClient
    .from("team_config")
    .select("value")
    .eq("key", "ai_extraction_fields")
    .single();
  if (!data?.value) return DEFAULT_AI_FIELDS;
  return { ...DEFAULT_AI_FIELDS, ...(data.value as Partial<AiExtractionFields>) };
}

export async function setAiExtractionFields(fields: AiExtractionFields): Promise<void> {
  const { error } = await adminClient
    .from("team_config")
    .upsert({ key: "ai_extraction_fields", value: fields }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add Customer type, getCustomers, upsertCustomer, AI field config"
```

---

## Task 4: extractCustomerInfo() in call-summary.ts

**Files:**
- Modify: `lib/call-summary.ts`

- [ ] **Step 1: Add extractCustomerInfo function**

At the end of `lib/call-summary.ts`, add:

```typescript
export interface ExtractedCustomerFields {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  diseases?: string;
  symptoms?: string;
  medications?: string;
  consulted_doc?: string;
  patient_type?: string;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  nickname: "ชื่อเล่น",
  diseases: "โรคเป็นอยู่",
  symptoms: "อาการตอนนี้",
  medications: "ยาที่กำลังทานอยู่",
  consulted_doc: "ปรึกษาหมอมั้ย",
  patient_type: "คนที่ทาน",
};

export async function extractCustomerInfo(
  transcript: string,
  enabledFields: Record<string, boolean>,
  productKnowledge: string
): Promise<ExtractedCustomerFields> {
  const activeFields = Object.entries(enabledFields)
    .filter(([, v]) => v)
    .map(([k]) => `- ${FIELD_LABELS[k] ?? k} (field: ${k})`);

  if (activeFields.length === 0) return {};

  const systemPrompt = [
    "คุณเป็น AI ที่ช่วยดึงข้อมูลลูกค้าจากบทสนทนาสายโทรศัพท์ภาษาไทย",
    productKnowledge
      ? `\nข้อมูลสินค้า (context เพิ่มเติม):\n${productKnowledge}`
      : "",
    "\nดึงเฉพาะข้อมูลที่พูดถึงในสายเท่านั้น ถ้าไม่มีการพูดถึง field ใด ให้ละ field นั้นออก",
    "\nส่งกลับเป็น JSON object ที่มี key เป็น field name ด้านล่าง:",
    activeFields.join("\n"),
    "\nกฎ:",
    "- first_name/last_name/nickname: ตรงตามที่พูด",
    "- diseases: คั่นด้วยคอมมา",
    "- medications: ชื่อยา คั่นด้วยคอมมา",
    "- consulted_doc: คำตอบสั้น รวมความถี่ถ้ามี (เช่น 'ใช่ — ทุก 3 เดือน')",
    "- patient_type: 'ตัวเอง' หรือ 'คนในครอบครัว — [ความสัมพันธ์]'",
    "- symptoms: อธิบายสั้น ๆ",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
    temperature: 0,
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? "{}") as ExtractedCustomerFields;
  } catch {
    return {};
  }
}
```

Note: `openai` is already initialized at the top of `call-summary.ts` — reuse it.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/call-summary.ts
git commit -m "feat(ai): add extractCustomerInfo with Notion context injection"
```

---

## Task 5: API Route — POST /api/customer/analyze

**Files:**
- Create: `app/api/customer/analyze/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { transcribeAudio, downloadAudio } from "@/lib/call-summary";
import { extractCustomerInfo } from "@/lib/call-summary";
import { getAiExtractionFields } from "@/lib/db";
import { getProductKnowledge } from "@/lib/notion";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaRecordingId, account } = await req.json() as {
    orekaRecordingId: string;
    account?: "gosell" | "hopeful";
  };
  if (!orekaRecordingId) {
    return NextResponse.json({ error: "orekaRecordingId required" }, { status: 400 });
  }

  try {
    // 1. Download audio from Oreka
    const audioBuffer = await downloadAudio(orekaRecordingId, account ?? "gosell");

    // 2. Transcribe with Whisper
    const transcript = await transcribeAudio(audioBuffer);
    if (!transcript) {
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    // 3. Get enabled fields + product knowledge in parallel
    const [enabledFields, productKnowledge] = await Promise.all([
      getAiExtractionFields(),
      getProductKnowledge(),
    ]);

    // 4. Extract customer info
    const fields = await extractCustomerInfo(transcript, enabledFields, productKnowledge);

    return NextResponse.json({ fields, transcript });
  } catch (err) {
    console.error("[customer/analyze]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Check that transcribeAudio and downloadAudio are exported from call-summary.ts**

Run:
```bash
grep -n "^export" lib/call-summary.ts
```

If `transcribeAudio` or `downloadAudio` are not exported, add `export` keyword to their function declarations in `lib/call-summary.ts`.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/customer/analyze/route.ts lib/call-summary.ts
git commit -m "feat(api): POST /api/customer/analyze — Whisper + GPT extraction"
```

---

## Task 6: API Route — GET/POST /api/supervisor/ai-fields

**Files:**
- Create: `app/api/supervisor/ai-fields/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAiExtractionFields, setAiExtractionFields, AiExtractionFields } from "@/lib/db";

async function requireSupervisor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function GET() {
  const user = await requireSupervisor();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fields = await getAiExtractionFields();
  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const user = await requireSupervisor();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fields = await req.json() as AiExtractionFields;
  await setAiExtractionFields(fields);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/supervisor/ai-fields/route.ts
git commit -m "feat(api): GET/POST /api/supervisor/ai-fields for field config"
```

---

## Task 7: Customer List Page

**Files:**
- Create: `app/my-desk/customers-list/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import { getCurrentUser } from "@/lib/db";
import { getCustomers, Customer } from "@/lib/db";
import { redirect } from "next/navigation";
import AnalyzeCallPanel from "./AnalyzeCallPanel";

export default async function CustomersListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const customers = await getCustomers(user.id);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รายชื่อลูกค้า</h1>
        <p className="text-[13px] text-[#8B8E8F] mt-1">
          ข้อมูลลูกค้าที่ดึงจากสายโทรด้วย AI
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-12 text-center">
          <div className="text-[32px] mb-3">👤</div>
          <div className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีข้อมูลลูกค้า</div>
          <div className="text-[12px] text-[#8B8E8F] mt-1">
            กดปุ่ม &ldquo;วิเคราะห์สาย&rdquo; หลังจากคุยกับลูกค้าเพื่อดึงข้อมูลอัตโนมัติ
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl divide-y divide-[#E8E8E8]">
          {customers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              agentId={user.id}
              orekaExtGosell={user.orekaExtGosell}
              orekaExtHopeful={user.orekaExtHopeful}
            />
          ))}
        </div>
      )}

      {/* Floating analyze button when no customers yet */}
      {customers.length === 0 && (
        <div className="mt-4 flex justify-center">
          <AnalyzeCallPanel
            agentId={user.id}
            customerId={undefined}
            orekaExtGosell={user.orekaExtGosell}
            orekaExtHopeful={user.orekaExtHopeful}
            trigger={
              <button className="flex items-center gap-2 bg-[#58CEE8] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#3DB8D4] transition-colors">
                🎙 วิเคราะห์สายแรก
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}

function CustomerRow({
  customer,
  agentId,
  orekaExtGosell,
  orekaExtHopeful,
}: {
  customer: Customer;
  agentId: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
}) {
  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—";
  const initial = (customer.firstName ?? customer.nickname ?? "?").charAt(0).toUpperCase();
  const hasData = !!(customer.firstName || customer.lastName || customer.diseases);

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${
          hasData ? "bg-[#87DE81] text-white" : "bg-[#E8E8E8] text-[#8B8E8F]"
        }`}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#3D3D3D] flex items-center gap-2">
          {displayName}
          {customer.nickname && (
            <span className="text-[11px] text-[#8B8E8F] font-normal">({customer.nickname})</span>
          )}
        </div>
        <div className="text-[11px] text-[#8B8E8F] flex items-center gap-2 mt-0.5">
          {customer.diseases && <span>💊 {customer.diseases}</span>}
          {customer.phone && <span>📞 {customer.phone}</span>}
          {!hasData && <span className="text-[#C0C0C0]">ยังไม่มีข้อมูล AI</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <AnalyzeCallPanel
          agentId={agentId}
          customerId={customer.id}
          orekaExtGosell={orekaExtGosell}
          orekaExtHopeful={orekaExtHopeful}
          trigger={
            <button className="text-[11px] px-3 py-1.5 border border-[#58CEE8] text-[#58CEE8] rounded-lg hover:bg-[#f0fbff] transition-colors">
              🎙 วิเคราะห์สาย
            </button>
          }
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/my-desk/customers-list/page.tsx
git commit -m "feat(ui): add customers-list page with customer rows"
```

---

## Task 8: AnalyzeCallPanel Client Component

**Files:**
- Create: `app/my-desk/customers-list/AnalyzeCallPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";
import { useState, useEffect, useTransition, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface OrekaRecording {
  id: string;
  timestamp: string;
  duration: number;
  direction: "IN" | "OUT";
  localParty: string;
  remoteParty: string;
}

interface ExtractedFields {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  diseases?: string;
  symptoms?: string;
  medications?: string;
  consulted_doc?: string;
  patient_type?: string;
}

const FIELD_META: { key: keyof ExtractedFields; label: string }[] = [
  { key: "first_name", label: "ชื่อ" },
  { key: "last_name", label: "นามสกุล" },
  { key: "nickname", label: "ชื่อเล่น" },
  { key: "diseases", label: "โรคเป็นอยู่" },
  { key: "symptoms", label: "อาการตอนนี้" },
  { key: "medications", label: "ยาที่กำลังทานอยู่" },
  { key: "consulted_doc", label: "ปรึกษาหมอมั้ย" },
  { key: "patient_type", label: "คนที่ทาน" },
];

export default function AnalyzeCallPanel({
  agentId,
  customerId,
  orekaExtGosell,
  orekaExtHopeful,
  trigger,
}: {
  agentId: string;
  customerId?: string;
  orekaExtGosell: string;
  orekaExtHopeful: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "loading" | "results">("pick");
  const [recordings, setRecordings] = useState<OrekaRecording[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [selectedRec, setSelectedRec] = useState<OrekaRecording | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields>({});
  const [editedFields, setEditedFields] = useState<ExtractedFields>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setSelectedRec(null);
    setExtracted({});
    setEditedFields({});
    setError("");

    setLoadingRec(true);
    const exts = [orekaExtGosell, orekaExtHopeful].filter(Boolean).join(",");
    fetch(`/api/oreka/today-recordings?exts=${encodeURIComponent(exts)}`)
      .then((r) => r.json())
      .then((d) => setRecordings(d.recordings ?? []))
      .catch(() => setRecordings([]))
      .finally(() => setLoadingRec(false));
  }, [open, orekaExtGosell, orekaExtHopeful]);

  async function handleAnalyze() {
    if (!selectedRec) return;
    setStep("loading");
    setError("");
    try {
      const account = orekaExtGosell && selectedRec.localParty === orekaExtGosell
        ? "gosell"
        : "hopeful";
      const res = await fetch("/api/customer/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orekaRecordingId: selectedRec.id, account }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "วิเคราะห์ไม่สำเร็จ");
      setExtracted(data.fields ?? {});
      setEditedFields(data.fields ?? {});
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setStep("pick");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/customer/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customerId,
          agentId,
          orekaRecId: selectedRec?.id,
          phone: selectedRec?.remoteParty,
          ...editedFields,
        }),
      });
      setOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function formatTime(ts: string) {
    return new Date(ts).toLocaleTimeString("th-TH", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{trigger}</span>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-[#E8E8E8] shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E8E8]">
              <div className="text-[13px] font-semibold text-[#3D3D3D]">🎙 วิเคราะห์สายโทร</div>
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full hover:bg-[#F7F7F7] flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Step: Pick recording */}
              {step === "pick" && (
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
                    เลือกการโทรวันนี้
                  </div>
                  {loadingRec ? (
                    <div className="text-[12px] text-[#C0C0C0] text-center py-8 animate-pulse">
                      กำลังดึงรายการสาย...
                    </div>
                  ) : recordings.length === 0 ? (
                    <div className="text-[12px] text-[#8B8E8F] text-center py-8">
                      ไม่พบการโทรวันนี้
                      <div className="text-[11px] text-[#C0C0C0] mt-1">
                        ตรวจสอบเบอร์ dtac ของคุณในโปรไฟล์
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recordings.map((rec) => (
                        <button
                          key={rec.id}
                          onClick={() => setSelectedRec(rec)}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            selectedRec?.id === rec.id
                              ? "border-[#87DE81] bg-[#f0fdf4]"
                              : "border-[#E8E8E8] hover:border-[#87DE81] hover:bg-[#f0fdf4]"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="font-medium text-[#3D3D3D]">
                              {rec.direction === "IN" ? "📞 สายเข้า" : "📲 สายออก"} — {formatTime(rec.timestamp)}
                            </span>
                            <span className="text-[#8B8E8F]">{formatDuration(rec.duration)}</span>
                          </div>
                          <div className="text-[11px] text-[#8B8E8F] mt-0.5">{rec.remoteParty}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {error && <p className="text-[11px] text-red-500">{error}</p>}
                </div>
              )}

              {/* Step: Loading */}
              {step === "loading" && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-8 h-8 border-2 border-[#87DE81] border-t-transparent rounded-full animate-spin" />
                  <div className="text-[12px] text-[#8B8E8F] text-center">
                    กำลังถอดเสียงและวิเคราะห์ด้วย AI...
                    <div className="text-[11px] text-[#C0C0C0] mt-1">ใช้เวลาประมาณ 30–60 วินาที</div>
                  </div>
                </div>
              )}

              {/* Step: Results */}
              {step === "results" && (
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide">
                    ข้อมูลที่ดึงได้ — แก้ไขได้ก่อนบันทึก
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_META.map(({ key, label }) => {
                      const found = extracted[key] !== undefined;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl p-3 ${
                            found ? "bg-[#F7F7F7]" : "bg-[#fffbf0] border border-[#f0c040]"
                          } ${key === "diseases" || key === "medications" || key === "symptoms" ? "col-span-2" : ""}`}
                        >
                          <div className="text-[10px] text-[#8B8E8F] mb-1">{label}</div>
                          {found ? (
                            <input
                              type="text"
                              value={editedFields[key] ?? ""}
                              onChange={(e) => setEditedFields((p) => ({ ...p, [key]: e.target.value }))}
                              className="w-full text-[12px] text-[#3D3D3D] bg-transparent outline-none border-b border-transparent focus:border-[#87DE81] transition-colors"
                            />
                          ) : (
                            <div className="text-[11px] text-[#856404] italic">ไม่ได้พูดถึงในสาย</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {error && <p className="text-[11px] text-red-500">{error}</p>}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-[#E8E8E8] flex gap-2">
              {step === "pick" && (
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedRec}
                  className="flex-1 bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-40 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
                >
                  วิเคราะห์สายนี้
                </button>
              )}
              {step === "results" && (
                <>
                  <button
                    onClick={() => setStep("pick")}
                    className="px-4 py-2.5 text-[13px] text-[#8B8E8F] border border-[#E8E8E8] rounded-xl hover:bg-[#F7F7F7] transition-colors"
                  >
                    เลือกสายใหม่
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-40 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
                  >
                    {saving ? "กำลังบันทึก..." : "✓ บันทึกข้อมูลลูกค้า"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Create the upsert API route that AnalyzeCallPanel calls**

Create `app/api/customer/upsert/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertCustomer } from "@/lib/db";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
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
}
```

- [ ] **Step 3: Create the today-recordings API route**

Create `app/api/oreka/today-recordings/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTodayRecordingsForExts } from "@/lib/oreka";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exts = req.nextUrl.searchParams.get("exts") ?? "";
  const extList = exts.split(",").map((e) => e.trim()).filter(Boolean);
  if (extList.length === 0) return NextResponse.json({ recordings: [] });

  try {
    const recordings = await getTodayRecordingsForExts(extList);
    return NextResponse.json({ recordings });
  } catch {
    return NextResponse.json({ recordings: [] });
  }
}
```

- [ ] **Step 4: Add getTodayRecordingsForExts to lib/oreka.ts**

Open `lib/oreka.ts` and add this function at the end:

```typescript
export async function getTodayRecordingsForExts(
  exts: string[]
): Promise<{ id: string; timestamp: string; duration: number; direction: "IN" | "OUT"; localParty: string; remoteParty: string }[]> {
  // Get today's date range in UTC (Thai day = UTC - 7h)
  const now = new Date();
  const thaiOffsetMs = 7 * 60 * 60 * 1000;
  const thaiMidnight = new Date(now.getTime() - ((now.getTime() + thaiOffsetMs) % (24 * 60 * 60 * 1000)));
  const startdate = thaiMidnight.toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const enddate = new Date(thaiMidnight.getTime() + 24 * 60 * 60 * 1000)
    .toISOString().replace(/[-:T]/g, "").slice(0, 15);

  // Use existing getRecordingsPage from oreka.ts or call login + fetch
  // Fetch from both accounts and merge
  const results: { id: string; timestamp: string; duration: number; direction: "IN" | "OUT"; localParty: string; remoteParty: string }[] = [];

  for (const account of ["gosell", "hopeful"] as const) {
    try {
      const recs = await getRecordingsByAccount(account, startdate, enddate, exts);
      results.push(...recs);
    } catch {
      // skip failed account
    }
  }

  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getRecordingsByAccount(
  account: "gosell" | "hopeful",
  startdate: string,
  enddate: string,
  exts: string[]
): Promise<{ id: string; timestamp: string; duration: number; direction: "IN" | "OUT"; localParty: string; remoteParty: string }[]> {
  const token = await loginOreka(account);
  const baseUrl = process.env.OREKA_BASE_URL!;
  const localPartyFilter = exts.map((e) => `localParty=${encodeURIComponent(e)}`).join("&");
  const url = `${baseUrl}/orktrack/rest/recordings?range=custom&startdate=${startdate}&enddate=${enddate}&pagesize=100&${localPartyFilter}`;

  const res = await fetch(url, {
    headers: { Authorization: token },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.objects ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    timestamp: r.timestamp as string,
    duration: r.duration as number,
    direction: (r.direction as string) === "OUT" ? "OUT" : "IN",
    localParty: r.localParty as string,
    remoteParty: r.remoteParty as string,
  }));
}
```

Note: `loginOreka` is the existing login function in `lib/oreka.ts` — check its exact name with `grep -n "function login\|export.*login" lib/oreka.ts` and use the correct name.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/my-desk/customers-list/AnalyzeCallPanel.tsx app/api/customer/upsert/route.ts app/api/oreka/today-recordings/route.ts lib/oreka.ts
git commit -m "feat(ui): AnalyzeCallPanel + upsert + today-recordings API routes"
```

---

## Task 9: Supervisor Settings — AI Agent Card

**Files:**
- Modify: `app/supervisor/settings/page.tsx`

- [ ] **Step 1: Add AiAgentConfigCard client component**

Create `app/supervisor/settings/AiAgentConfigCard.tsx`:

```typescript
"use client";
import { useState } from "react";

interface AiFields {
  first_name: boolean;
  last_name: boolean;
  nickname: boolean;
  diseases: boolean;
  symptoms: boolean;
  medications: boolean;
  consulted_doc: boolean;
  patient_type: boolean;
}

const FIELD_LABELS: { key: keyof AiFields; thai: string }[] = [
  { key: "first_name", thai: "ชื่อ" },
  { key: "last_name", thai: "นามสกุล" },
  { key: "nickname", thai: "ชื่อเล่น" },
  { key: "diseases", thai: "โรคเป็นอยู่" },
  { key: "symptoms", thai: "อาการตอนนี้" },
  { key: "medications", thai: "ยาที่กำลังทานอยู่" },
  { key: "consulted_doc", thai: "ปรึกษาหมอมั้ย" },
  { key: "patient_type", thai: "คนที่ทาน" },
];

export default function AiAgentConfigCard({
  initialFields,
  notionConnected,
}: {
  initialFields: AiFields;
  notionConnected: boolean;
}) {
  const [fields, setFields] = useState<AiFields>(initialFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  function toggle(key: keyof AiFields) {
    setFields((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  async function handleSaveFields() {
    setSaving(true);
    try {
      await fetch("/api/supervisor/ai-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleForceSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      await fetch("/api/notion/sync", { method: "POST" });
      setSyncMsg("✓ ซิงค์สำเร็จ");
    } catch {
      setSyncMsg("ซิงค์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(""), 4000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#f0f8ff] flex items-center justify-center shrink-0">
          <span className="text-[18px]">🤖</span>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#3D3D3D]">AI Agent — การดึงข้อมูล</div>
          <div className="text-[12px] text-[#8B8E8F] mt-0.5">
            ตั้งค่าการเชื่อมต่อ Notion และเลือกฟิลด์ที่ AI จะดึงจากสายโทร
          </div>
        </div>
      </div>

      {/* Section A: Notion */}
      <div>
        <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
          Product Knowledge — Notion
        </div>
        <div className="flex items-center justify-between p-3 bg-[#F7F7F7] rounded-xl">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${notionConnected ? "bg-[#87DE81]" : "bg-red-400"}`}
            />
            <span className="text-[12px] text-[#3D3D3D]">
              {notionConnected ? "เชื่อมต่อ Notion แล้ว" : "ไม่ได้เชื่อมต่อ — ตั้งค่า NOTION_TOKEN ใน .env.local"}
            </span>
          </div>
          {notionConnected && (
            <button
              onClick={handleForceSync}
              disabled={syncing}
              className="text-[11px] text-[#58CEE8] hover:underline disabled:opacity-50"
            >
              {syncing ? "กำลังซิงค์..." : "Force Sync"}
            </button>
          )}
        </div>
        {syncMsg && <p className="text-[11px] text-[#87DE81] mt-1">{syncMsg}</p>}
      </div>

      {/* Section B: Field toggles */}
      <div>
        <div className="text-[11px] font-semibold text-[#8B8E8F] uppercase tracking-wide mb-3">
          ฟิลด์ที่ให้ AI ดึงจากสาย
        </div>
        <div className="space-y-2">
          {FIELD_LABELS.map(({ key, thai }) => (
            <label key={key} className="flex items-center justify-between py-2 cursor-pointer group">
              <span className="text-[13px] text-[#3D3D3D] group-hover:text-[#3D3D3D]">{thai}</span>
              <button
                role="switch"
                aria-checked={fields[key]}
                onClick={() => toggle(key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  fields[key] ? "bg-[#87DE81]" : "bg-[#E8E8E8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    fields[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
        <button
          onClick={handleSaveFields}
          disabled={saving}
          className="mt-4 w-full bg-[#87DE81] hover:bg-[#76cc70] disabled:opacity-50 text-[#3D3D3D] text-[13px] font-medium py-2.5 rounded-xl transition-colors"
        >
          {saving ? "กำลังบันทึก..." : saved ? "✓ บันทึกแล้ว" : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the notion/sync API route**

Create `app/api/notion/sync/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { clearProductKnowledgeCache } from "@/lib/notion";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  clearProductKnowledgeCache();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Add AiAgentConfigCard to the settings page**

Open `app/supervisor/settings/page.tsx`. Find the section that renders the Oreka card (search for `AgentOrekaExtForm`). Add the import at the top:

```typescript
import AiAgentConfigCard from "./AiAgentConfigCard";
import { getAiExtractionFields } from "@/lib/db";
```

In the `Promise.all()` data-loading block, add `getAiExtractionFields()`:

```typescript
const [dailyTarget, agents, products, monthlyTargets, orekaAgents, aiFields] =
  await Promise.all([
    getDailyTarget(),
    getAllAgentsAnalysis(),
    getProducts(),
    getMonthlyTargetsForAllAgents(currentThaiMonthKey()),
    getAgentsWithOrekaExt(),
    getAiExtractionFields(),
  ]);
```

Then after the Oreka card section, add:

```tsx
{/* AI Agent config */}
<SectionLabel>AI Agent</SectionLabel>
<AiAgentConfigCard
  initialFields={aiFields}
  notionConnected={!!process.env.NOTION_TOKEN}
/>
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/supervisor/settings/AiAgentConfigCard.tsx app/supervisor/settings/page.tsx app/api/notion/sync/route.ts
git commit -m "feat(supervisor): add AI Agent config card with Notion status + field toggles"
```

---

## Task 10: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Notion integration**

Navigate to `/supervisor/settings`. Verify:
- AI Agent card appears below Oreka section
- Notion status shows 🟢 (NOTION_TOKEN is set)
- Click "Force Sync" — should show "✓ ซิงค์สำเร็จ"
- Toggle a field off, click "บันทึก" — should persist on page refresh

- [ ] **Step 3: Test customer list page**

Navigate to `/my-desk/customers-list`. Verify:
- Page loads with empty state or customer rows
- "วิเคราะห์สาย" button opens the slide-in panel
- Panel shows today's recordings (or "ไม่พบการโทรวันนี้" if none)

- [ ] **Step 4: Test full extraction flow** (requires Oreka recording today)

1. Open AnalyzeCallPanel, select a recording
2. Click "วิเคราะห์สายนี้"
3. Wait ~30–60s for Whisper + GPT
4. Verify extracted fields appear in colored cards
5. Click "✓ บันทึกข้อมูลลูกค้า"
6. Verify customer row appears in the list with extracted data

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: AI customer extraction from voice + Notion product knowledge"
```
