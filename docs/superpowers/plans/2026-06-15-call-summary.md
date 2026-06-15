# Call Summary After Called Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent manually triggers a call summary from a customer profile; system fetches the Oreka recording, transcribes with Whisper, summarizes with GPT-4o, stores and displays result. Also adds "ติดต่อใหม่" tab in customers-list showing unknown Oreka contacts.

**Architecture:** Agent clicks "สรุปการโทรล่าสุด" in the customer profile modal → `POST /api/call-summary/generate` with `{ phone }` → server fetches last 7 days of agent's Oreka recordings filtered by that phone → downloads audio → Whisper transcription → GPT-4o summary → saved to `call_summaries` table → returned to client. Cached on `recording_id` so re-clicking is free. Separate `GET /api/oreka/contacts` powers the "ติดต่อใหม่" tab.

**Tech Stack:** Next.js 16 App Router, Supabase (postgres + auth), `openai` v6 (Whisper + GPT-4o), existing `lib/oreka.ts` helpers (`getOrekaToken`, `refreshOrekaToken`), `lib/oreka-format.ts` (`toOrekaStamp`), Tailwind CSS v4.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/add-call-summaries-table.sql` | Create | DB migration for `call_summaries` table + RLS |
| `package.json` | Modify | Move `openai` from devDependencies → dependencies |
| `lib/call-summary.ts` | Create | Core: download audio, Whisper, GPT-4o, save/fetch from DB |
| `app/api/call-summary/generate/route.ts` | Create | POST `{ phone }` — on-demand summary for one customer |
| `app/api/call-summary/route.ts` | Create | GET `?phone=xxx` — fetch saved summaries for customer profile |
| `app/api/oreka/contacts/route.ts` | Create | GET — agent's Oreka call history grouped by remoteParty |
| `app/my-desk/customers-list/page.tsx` | Modify | Pass `hasOrekaExt` prop to client |
| `app/my-desk/customers-list/CustomersListClient.tsx` | Modify | Add tabs, unknown contacts tab, summary section with manual button |

---

## Task 1: DB Migration + Move openai to dependencies

**Files:**
- Create: `scripts/add-call-summaries-table.sql`
- Modify: `package.json`

- [ ] **Step 1: Create the SQL migration file**

```sql
-- scripts/add-call-summaries-table.sql
CREATE TABLE IF NOT EXISTS call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  duration INTEGER,
  called_at TIMESTAMPTZ,
  transcript TEXT,
  summary TEXT,
  coaching_tips JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE call_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_own_summaries" ON call_summaries
  FOR ALL USING (agent_id = auth.uid());

CREATE INDEX IF NOT EXISTS call_summaries_agent_phone_idx
  ON call_summaries(agent_id, phone);

CREATE INDEX IF NOT EXISTS call_summaries_recording_id_idx
  ON call_summaries(recording_id);
```

- [ ] **Step 2: Run the migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run the file contents. Verify the `call_summaries` table appears in Table Editor with all columns.

- [ ] **Step 3: Move openai to dependencies in package.json**

In `package.json`, remove `"openai": "^6.42.0"` from `devDependencies` and add it to `dependencies`:

```json
"dependencies": {
  "@dicebear/collection": "^9.4.2",
  "@dicebear/core": "^9.4.2",
  "@supabase/ssr": "^0.10.3",
  "@supabase/supabase-js": "^2.106.2",
  "bcryptjs": "^3.0.3",
  "framer-motion": "^12.40.0",
  "googleapis": "^173.0.0",
  "iron-session": "^8.0.4",
  "jspdf": "^4.2.1",
  "jspdf-autotable": "^5.0.8",
  "next": "16.2.6",
  "openai": "^6.42.0",
  "react": "19.2.4",
  "react-dom": "19.2.4"
}
```

- [ ] **Step 4: Add OPENAI_API_KEY to .env.local**

Open `.env.local` and add:
```
OPENAI_API_KEY=sk-...your-key-here...
```

- [ ] **Step 5: Reinstall to update lockfile**

```bash
npm install
```
Expected: exits 0, lockfile updated.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-call-summaries-table.sql package.json package-lock.json
git commit -m "feat(call-summary): add call_summaries table migration, move openai to deps"
```

---

## Task 2: Core Library — `lib/call-summary.ts`

**Files:**
- Create: `lib/call-summary.ts`

Core pipeline: find latest Oreka recording for a phone, download audio, transcribe, summarize, save. Also fetches saved summaries.

**Key imports from existing code:**
- `getOrekaToken(accountId)` and `refreshOrekaToken(accountId)` from `@/lib/oreka`
- `type AccountId` from `@/lib/oreka`
- `toOrekaStamp(date)` from `@/lib/oreka-format` — converts Date to `"YYYYMMDD_HHMMSS"` UTC string
- `adminClient` from `@/lib/supabase/admin` — Supabase service role client

- [ ] **Step 1: Create `lib/call-summary.ts`**

```ts
// lib/call-summary.ts
import OpenAI from "openai";
import { adminClient } from "./supabase/admin";
import { getOrekaToken, refreshOrekaToken } from "./oreka";
import type { AccountId } from "./oreka";
import { toOrekaStamp } from "./oreka-format";

const BASE = process.env.OREKA_BASE_URL ?? "";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `คุณคือผู้เชี่ยวชาญด้านการฝึกอบรมพนักงานขาย Telesales ในประเทศไทย
วิเคราะห์บทสนทนาที่ถอดความมาแล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

รูปแบบ JSON:
{
  "summary": "สรุปบทสนทนา 2-3 ประโยค: ลูกค้าสนใจอะไร มีข้อโต้แย้งอะไร ผลลัพธ์คืออะไร",
  "coaching_tips": [
    "คำแนะนำที่ 1 (เฉพาะเจาะจง เช่น วิธีตอบข้อโต้แย้ง หรือเทคนิคปิดการขาย)",
    "คำแนะนำที่ 2"
  ]
}

coaching_tips ต้องมี 2-3 ข้อ เป็นคำแนะนำที่ปฏิบัติได้จริง ไม่ใช่คำทั่วไป`;

export interface CallSummaryResult {
  recordingId: string;
  phone: string;
  summary: string;
  coachingTips: string[];
  duration: number;
  calledAt: string;
}

export interface SavedCallSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

// Download audio buffer from Oreka mediastream
async function downloadAudio(recordingId: number | string, accountId: AccountId): Promise<Buffer> {
  if (!BASE) throw new Error("OREKA_BASE_URL not configured");
  const url = `${BASE}/orktrack/rest/mediastream/${recordingId}`;

  async function doFetch(token: string) {
    return fetch(url, { headers: { Authorization: token } });
  }

  let token = await getOrekaToken(accountId);
  let res = await doFetch(token);
  if (res.status === 401 || res.status === 403) {
    token = await refreshOrekaToken(accountId);
    res = await doFetch(token);
  }
  if (!res.ok) throw new Error(`Oreka audio download failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Transcribe audio buffer with OpenAI Whisper
async function transcribe(audioBuffer: Buffer, recordingId: string): Promise<string> {
  const file = new File([audioBuffer], `recording-${recordingId}.wav`, { type: "audio/wav" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "th",
  });
  return result.text;
}

// Summarize transcript with GPT-4o
async function summarize(transcript: string): Promise<{ summary: string; coaching_tips: string[] }> {
  if (!transcript.trim()) {
    return { summary: "ไม่พบเนื้อหาการสนทนา", coaching_tips: [] };
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SUMMARY_PROMPT },
      { role: "user", content: transcript },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary ?? "ไม่สามารถสรุปได้",
      coaching_tips: Array.isArray(parsed.coaching_tips) ? parsed.coaching_tips : [],
    };
  } catch {
    return { summary: raw, coaching_tips: [] };
  }
}

// Find the most recent Oreka recording between this agent and the given customer phone (last 7 days)
async function findLatestRecording(
  orekaExtGosell: string,
  orekaExtHopeful: string,
  customerPhone: string,
): Promise<{ id: number; duration: number; calledAt: string; accountId: AccountId } | null> {
  if (!BASE) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const startUtc = toOrekaStamp(sevenDaysAgo);
  const endUtc = toOrekaStamp(now);

  const pairs: Array<{ ext: string; accountId: AccountId }> = [];
  if (orekaExtGosell)  pairs.push({ ext: orekaExtGosell,  accountId: "gosell" });
  if (orekaExtHopeful) pairs.push({ ext: orekaExtHopeful, accountId: "hopeful" });

  let best: { id: number; duration: number; calledAt: string; accountId: AccountId } | null = null;

  for (const { ext, accountId } of pairs) {
    try {
      const url =
        `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
        `&page=1&pagesize=1000&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;

      let token = await getOrekaToken(accountId);
      let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
      if (res.status === 401 || res.status === 403) {
        token = await refreshOrekaToken(accountId);
        res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
      }
      if (!res.ok) continue;

      const data = await res.json();
      for (const r of data?.objects ?? []) {
        if (r.localParty !== ext || r.remoteParty !== customerPhone) continue;
        if (!best || r.timestamp > best.calledAt) {
          best = { id: r.id, duration: Number(r.duration) || 0, calledAt: r.timestamp, accountId };
        }
      }
    } catch (e) {
      console.error(`[call-summary] findLatestRecording (${accountId}) failed:`, e);
    }
  }

  return best;
}

// Main entry: generate summary for a customer phone number (manual trigger)
export async function generateSummaryForPhone(
  agentId: string,
  orekaExtGosell: string,
  orekaExtHopeful: string,
  customerPhone: string,
): Promise<CallSummaryResult | null> {
  const recording = await findLatestRecording(orekaExtGosell, orekaExtHopeful, customerPhone);
  if (!recording) return null;

  // Return cached result if already processed
  const { data: existing } = await adminClient
    .from("call_summaries")
    .select("*")
    .eq("recording_id", String(recording.id))
    .single();

  if (existing) {
    return {
      recordingId: existing.recording_id,
      phone: existing.phone,
      summary: existing.summary,
      coachingTips: Array.isArray(existing.coaching_tips) ? existing.coaching_tips : [],
      duration: existing.duration ?? 0,
      calledAt: existing.called_at ?? "",
    };
  }

  // Process new recording
  const audioBuffer = await downloadAudio(recording.id, recording.accountId);
  const transcript = await transcribe(audioBuffer, String(recording.id));
  const { summary, coaching_tips } = await summarize(transcript);

  await adminClient.from("call_summaries").insert({
    agent_id: agentId,
    recording_id: String(recording.id),
    phone: customerPhone,
    duration: recording.duration,
    called_at: recording.calledAt,
    transcript,
    summary,
    coaching_tips,
  });

  return {
    recordingId: String(recording.id),
    phone: customerPhone,
    summary,
    coachingTips: coaching_tips,
    duration: recording.duration,
    calledAt: recording.calledAt,
  };
}

// Fetch saved summaries for a customer phone (for customer profile display)
export async function getSummariesForPhone(
  agentId: string,
  phone: string,
): Promise<SavedCallSummary[]> {
  const { data } = await adminClient
    .from("call_summaries")
    .select("id, summary, coaching_tips, duration, called_at, created_at")
    .eq("agent_id", agentId)
    .eq("phone", phone)
    .not("transcript", "is", null)
    .order("called_at", { ascending: false })
    .limit(5);

  return (data ?? []).map((r) => ({
    id: r.id,
    summary: r.summary,
    coachingTips: Array.isArray(r.coaching_tips) ? r.coaching_tips : [],
    duration: r.duration,
    calledAt: r.called_at,
    createdAt: r.created_at,
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors from `lib/call-summary.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/call-summary.ts
git commit -m "feat(call-summary): add core pipeline lib (Oreka → Whisper → GPT-4o → DB)"
```

---

## Task 3: API Route — `POST /api/call-summary/generate`

**Files:**
- Create: `app/api/call-summary/generate/route.ts`

On-demand summary for one customer phone. Called when agent clicks "สรุปการโทรล่าสุด".

- [ ] **Step 1: Create the route**

```ts
// app/api/call-summary/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";
import { generateSummaryForPhone } from "@/lib/call-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Whisper + GPT-4o can take ~15-25s

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { phone } = body as { phone?: string };
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaExtGosell, orekaExtHopeful } = currentUser;
  if (!orekaExtGosell && !orekaExtHopeful) {
    return NextResponse.json({ error: "no_oreka_ext" }, { status: 400 });
  }

  try {
    const result = await generateSummaryForPhone(user.id, orekaExtGosell, orekaExtHopeful, phone);
    if (!result) return NextResponse.json({ error: "no_recording" }, { status: 404 });

    return NextResponse.json({
      summary: result.summary,
      coachingTips: result.coachingTips,
      duration: result.duration,
      calledAt: result.calledAt,
    });
  } catch (e) {
    console.error("[call-summary/generate]", e);
    return NextResponse.json({ error: "pipeline_failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/call-summary/generate/route.ts
git commit -m "feat(call-summary): add POST /api/call-summary/generate on-demand endpoint"
```

---

## Task 4: API Route — `GET /api/call-summary`

**Files:**
- Create: `app/api/call-summary/route.ts`

Returns saved summaries for a phone. Called when customer profile modal opens.

- [ ] **Step 1: Create the route**

```ts
// app/api/call-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSummariesForPhone } from "@/lib/call-summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone param required" }, { status: 400 });

  const summaries = await getSummariesForPhone(user.id, phone);
  return NextResponse.json({ summaries });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/call-summary/route.ts
git commit -m "feat(call-summary): add GET /api/call-summary?phone=xxx endpoint"
```

---

## Task 5: API Route — `GET /api/oreka/contacts`

**Files:**
- Create: `app/api/oreka/contacts/route.ts`

Returns agent's Oreka call history grouped by `remoteParty` for last 30 days. Powers "ติดต่อใหม่" tab.

- [ ] **Step 1: Create the route**

```ts
// app/api/oreka/contacts/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";
import { getOrekaToken, refreshOrekaToken } from "@/lib/oreka";
import type { AccountId } from "@/lib/oreka";
import { toOrekaStamp } from "@/lib/oreka-format";

export const dynamic = "force-dynamic";

export interface OrekaContact {
  phone: string;
  callCount: number;
  totalDuration: number;
  lastCalledAt: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaExtGosell, orekaExtHopeful } = currentUser;
  if (!orekaExtGosell && !orekaExtHopeful) {
    return NextResponse.json({ contacts: [] });
  }

  const BASE = process.env.OREKA_BASE_URL ?? "";
  if (!BASE) return NextResponse.json({ contacts: [] });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600_000);
  const startUtc = toOrekaStamp(thirtyDaysAgo);
  const endUtc = toOrekaStamp(now);

  const contactMap = new Map<string, OrekaContact>();

  const pairs: Array<{ ext: string; accountId: AccountId }> = [];
  if (orekaExtGosell)  pairs.push({ ext: orekaExtGosell,  accountId: "gosell" });
  if (orekaExtHopeful) pairs.push({ ext: orekaExtHopeful, accountId: "hopeful" });

  for (const { ext, accountId } of pairs) {
    try {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url =
          `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}` +
          `&page=${page}&pagesize=1000&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;

        let token = await getOrekaToken(accountId);
        let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        if (res.status === 401 || res.status === 403) {
          token = await refreshOrekaToken(accountId);
          res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        }
        if (!res.ok) break;

        const data = await res.json();
        const recs = (data?.objects ?? []) as Array<{
          localParty: string; remoteParty: string;
          duration: number; timestamp: string;
        }>;

        for (const r of recs) {
          if (r.localParty !== ext || !r.remoteParty) continue;
          const phone = r.remoteParty;
          const existing = contactMap.get(phone);
          if (!existing) {
            contactMap.set(phone, {
              phone,
              callCount: 1,
              totalDuration: Number(r.duration) || 0,
              lastCalledAt: r.timestamp,
            });
          } else {
            existing.callCount += 1;
            existing.totalDuration += Number(r.duration) || 0;
            if (r.timestamp > existing.lastCalledAt) existing.lastCalledAt = r.timestamp;
          }
        }

        hasMore = recs.length >= 1000 && !!data?.nextPageUri;
        page++;
      }
    } catch (e) {
      console.error(`[oreka/contacts] account ${accountId} failed:`, e);
    }
  }

  const contacts = [...contactMap.values()]
    .sort((a, b) => b.lastCalledAt.localeCompare(a.lastCalledAt));

  return NextResponse.json({ contacts });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/oreka/contacts/route.ts
git commit -m "feat(call-summary): add GET /api/oreka/contacts endpoint"
```

---

## Task 6: Update `customers-list/page.tsx`

**Files:**
- Modify: `app/my-desk/customers-list/page.tsx`

Pass `hasOrekaExt` so the client knows whether to show tabs and the summarize button.

- [ ] **Step 1: Replace file content**

```tsx
// app/my-desk/customers-list/page.tsx
import { getMyData, filterClosed, getCurrentUser } from "@/lib/db";
import CustomersListClient from "./CustomersListClient";

export default async function CustomersListPage() {
  const user = await getCurrentUser();
  const data = user ? await getMyData(user.id) : null;
  const allRows = data?.rows ?? [];
  const closedRows = filterClosed(allRows);
  const hasOrekaExt = !!(user?.orekaExtGosell || user?.orekaExtHopeful);

  return (
    <CustomersListClient
      rows={closedRows}
      allRows={allRows}
      hasOrekaExt={hasOrekaExt}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: Error about unknown `hasOrekaExt` prop on `CustomersListClient` — this resolves in Task 7.

- [ ] **Step 3: Commit after Task 7 (batched)**

---

## Task 7: Update `CustomersListClient.tsx`

**Files:**
- Modify: `app/my-desk/customers-list/CustomersListClient.tsx`

Full replacement. Adds:
1. Tab bar: "ลูกค้า" vs "ติดต่อใหม่" (only when `hasOrekaExt`)
2. "ติดต่อใหม่" tab: fetches `/api/oreka/contacts`, subtracts known phones
3. `CallSummarySection` component: shows existing summaries + "สรุปการโทรล่าสุด" button
4. Customer profile modal gains the `CallSummarySection` below purchase history

**Important:** `formatTalkTime` is importable from `@/lib/oreka-format` (pure client-safe helper, no server imports).

- [ ] **Step 1: Replace full file content**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SaleRow } from "@/lib/db";
import EditSaleModal from "@/app/my-desk/components/EditSaleModal";
import { formatTalkTime } from "@/lib/oreka-format";

type View = "overall" | "gosell" | "hopeful";
type MainTab = "registered" | "new_contacts";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  closed:           { label: "โอนแล้ว",        color: "#3D9B3A" },
  pending_transfer: { label: "รอโอน",          color: "#C48A00" },
  follow_up:        { label: "ติดตาม",         color: "#0E8FA8" },
  in_progress:      { label: "กำลังดำเนินการ", color: "#7B5EA7" },
  lost:             { label: "หลุด",           color: "#CC3333" },
};

function rowTotal(r: SaleRow) {
  return r.phoneClose + r.upsell + r.crm + r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
}

function rowViewTotal(r: SaleRow, view: View) {
  if (view === "gosell")  return r.phoneClose + r.upsell + r.crm;
  if (view === "hopeful") return r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell;
  return rowTotal(r);
}

function parseStatus(note: string): string {
  const n = note.toLowerCase();
  if (n.includes("โอนแล้ว")) return "closed";
  if (n.includes("รอโอน") || n.includes("รอสลิป")) return "pending_transfer";
  if (n.includes("ติดตาม") || n.includes("นัด")) return "follow_up";
  if (n.includes("หลุด")) return "lost";
  return "in_progress";
}

interface CustomerGroup {
  key: string;
  name: string;
  phone: string;
  address: string;
  purchases: SaleRow[];
  totalValue: number;
  isReturning: boolean;
}

interface OrekaContact {
  phone: string;
  callCount: number;
  totalDuration: number;
  lastCalledAt: string;
}

interface SavedSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

// ── Call Summary Section ───────────────────────────────────────────────────────
function CallSummarySection({ phone, hasOrekaExt }: { phone: string; hasOrekaExt: boolean }) {
  const [summaries, setSummaries] = useState<SavedSummary[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ summary: string; coachingTips: string[]; duration: number; calledAt: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/call-summary?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => setSummaries(d.summaries ?? []))
      .catch(() => setSummaries([]));
  }, [phone]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/call-summary/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "no_recording") setGenError("ไม่พบการโทรล่าสุดในระบบ Oreka (7 วันที่ผ่านมา)");
        else setGenError("เกิดข้อผิดพลาด กรุณาลองใหม่");
        return;
      }
      setGenResult(data);
      // Refresh the saved list
      const refreshed = await fetch(`/api/call-summary?phone=${encodeURIComponent(phone)}`).then((r) => r.json());
      setSummaries(refreshed.summaries ?? []);
    } catch {
      setGenError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setGenerating(false);
    }
  }

  const displaySummary = genResult ?? (summaries && summaries.length > 0 ? summaries[0] : null);

  return (
    <div className="px-5 py-4 border-t border-[#E8E8E8] space-y-3">
      {/* Summarize button */}
      {hasOrekaExt && !genResult && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/40 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 rounded-xl py-2.5 transition-colors disabled:opacity-60"
        >
          {generating ? (
            <>
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              กำลังสรุป...
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              สรุปการโทรล่าสุด
            </>
          )}
        </button>
      )}

      {genError && (
        <p className="text-[11px] text-[#CC3333] text-center">{genError}</p>
      )}

      {displaySummary && (() => {
        const s = displaySummary;
        const durationStr = s.duration ? formatTalkTime(s.duration) : null;
        const rawCalledAt = "calledAt" in s ? s.calledAt : (s as SavedSummary).calledAt;
        const dateStr = rawCalledAt
          ? new Date(rawCalledAt + (rawCalledAt.includes("T") ? "" : " UTC")).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
          : null;
        const tips: string[] = "coachingTips" in s ? s.coachingTips : [];

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">สรุปการโทรล่าสุด</span>
              {dateStr && <span className="text-[10px] text-[#C0C0C0]">{dateStr}</span>}
              {durationStr && <span className="text-[10px] text-[#C0C0C0]">({durationStr})</span>}
            </div>
            <p className="text-[12px] text-[#3D3D3D] leading-relaxed">{s.summary}</p>
            {tips.length > 0 && (
              <div className="bg-[#87DE81]/8 border border-[#87DE81]/20 rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] font-semibold text-[#3D9B3A] flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  คำแนะนำ
                </div>
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-[#3D3D3D]">
                    <span className="text-[#87DE81] font-bold shrink-0 mt-px">•</span>
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {summaries !== null && summaries.length === 0 && !genResult && !hasOrekaExt && (
        <p className="text-[11px] text-[#C0C0C0] text-center">ยังไม่มีสรุปการโทร</p>
      )}
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function CustomerProfile({ group, hasOrekaExt, onClose, onAddNew, onEdit }: {
  group: CustomerGroup;
  hasOrekaExt: boolean;
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (r: SaleRow) => void;
}) {
  const history = [...group.purchases].sort((a, b) => b.date.localeCompare(a.date));
  const products = [...new Set(history.map((r) => r.product).filter(Boolean))];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E8E8E8]">
          <div className="w-10 h-10 rounded-full bg-[#022EE8]/15 flex items-center justify-center text-[#0E8FA8] text-[14px] font-bold shrink-0">
            {group.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#3D3D3D] truncate">{group.name}</span>
              {group.isReturning && (
                <span className="text-[10px] bg-[#022EE8]/15 text-[#0E8FA8] px-2 py-0.5 rounded-full font-semibold shrink-0">ลูกค้าเก่า</span>
              )}
            </div>
            {group.phone && <div className="text-[12px] text-[#8B8E8F]">📞 {group.phone}</div>}
          </div>
          <button onClick={onAddNew} className="flex items-center gap-1.5 text-[11px] font-semibold bg-[#87DE81] text-white px-3 py-1.5 rounded-lg hover:bg-[#6BC965] transition-colors shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            เพิ่มรายการใหม่
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F7F7F7] text-[#8B8E8F] shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-[#E8E8E8] border-b border-[#E8E8E8]">
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">ซื้อทั้งหมด</div>
            <div className="text-[16px] font-bold text-[#3D3D3D]">{history.length} ครั้ง</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">ยอดรวม</div>
            <div className="text-[16px] font-bold text-[#3D9B3A]">฿{group.totalValue.toLocaleString()}</div>
          </div>
          <div className="px-4 py-3 text-center">
            <div className="text-[10px] text-[#8B8E8F] mb-0.5">สินค้า</div>
            <div className="text-[16px] font-bold text-[#3D3D3D]">{products.length} ชนิด</div>
          </div>
        </div>

        {products.length > 0 && (
          <div className="px-5 py-3 border-b border-[#E8E8E8]">
            <div className="text-[10px] text-[#8B8E8F] mb-2 uppercase tracking-wide">สินค้าที่เคยซื้อ</div>
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => (
                <span key={p} className="text-[11px] bg-[#87DE81]/10 text-[#3D9B3A] border border-[#87DE81]/20 px-2.5 py-1 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-[#F7F7F7]">
            {history.map((r, i) => {
              const st = parseStatus(r.note);
              const stInfo = STATUS_LABEL[st] ?? { label: st, color: "#8B8E8F" };
              const total = rowTotal(r);
              return (
                <div key={r.id ?? i} className="flex items-center gap-3 px-5 py-3">
                  <div className="text-[11px] text-[#C0C0C0] w-20 shrink-0">{r.date}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#3D3D3D] truncate">{r.product || "—"}</div>
                    {r.note && <div className="text-[10px] text-[#8B8E8F] truncate">{r.note}</div>}
                  </div>
                  <span className="text-[10px] font-medium shrink-0" style={{ color: stInfo.color }}>{stInfo.label}</span>
                  {total > 0 && <span className="text-[12px] font-semibold text-[#3D3D3D] shrink-0">฿{total.toLocaleString()}</span>}
                  {r.id && (
                    <button
                      onClick={() => onEdit(r)}
                      className="p-1 rounded-lg text-[#C0C0C0] hover:text-[#8B8E8F] hover:bg-[#F7F7F7] transition-colors shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {group.phone && (
            <CallSummarySection phone={group.phone} hasOrekaExt={hasOrekaExt} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── New Contact Card ───────────────────────────────────────────────────────────
function NewContactCard({ contact, onRegister }: {
  contact: OrekaContact;
  onRegister: (phone: string) => void;
}) {
  const lastCalled = contact.lastCalledAt
    ? new Date(contact.lastCalledAt + " UTC").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
    : null;

  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[#F7F7F7] border border-[#E8E8E8] flex items-center justify-center text-[#C0C0C0] shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#3D3D3D]">{contact.phone}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[11px] text-[#8B8E8F]">โทร {contact.callCount} ครั้ง</span>
          <span className="text-[11px] text-[#8B8E8F]">รวม {formatTalkTime(contact.totalDuration)}</span>
          {lastCalled && <span className="text-[10px] text-[#C0C0C0]">ล่าสุด {lastCalled}</span>}
        </div>
      </div>
      <button
        onClick={() => onRegister(contact.phone)}
        className="text-[11px] font-semibold text-[#0E8FA8] border border-[#58CEE8]/30 bg-[#58CEE8]/5 hover:bg-[#58CEE8]/10 px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        กรอกข้อมูล →
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CustomersListClient({
  rows,
  allRows,
  hasOrekaExt,
}: {
  rows: SaleRow[];
  allRows: SaleRow[];
  hasOrekaExt: boolean;
}) {
  const router = useRouter();
  const [mainTab, setMainTab] = useState<MainTab>("registered");
  const [view, setView] = useState<View>("overall");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CustomerGroup | null>(null);
  const [editRow, setEditRow] = useState<SaleRow | null>(null);
  const [newContacts, setNewContacts] = useState<OrekaContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  const knownPhones = new Set(allRows.map((r) => r.phone?.trim()).filter(Boolean));

  useEffect(() => {
    if (mainTab !== "new_contacts" || !hasOrekaExt) return;
    if (newContacts !== null) return;
    setContactsLoading(true);
    fetch("/api/oreka/contacts")
      .then((r) => r.json())
      .then((d) => {
        const all: OrekaContact[] = d.contacts ?? [];
        setNewContacts(all.filter((c) => !knownPhones.has(c.phone)));
      })
      .catch(() => setNewContacts([]))
      .finally(() => setContactsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, hasOrekaExt]);

  const q = search.trim().toLowerCase();

  const grouped = (() => {
    const map = new Map<string, CustomerGroup>();
    for (const r of rows) {
      if (view === "gosell"  && r.phoneClose + r.upsell + r.crm <= 0) continue;
      if (view === "hopeful" && r.hopefulPhoneClose + r.hopefulCrm + r.hopefulUpsell <= 0) continue;
      const key = r.phone?.trim() || r.name;
      if (!map.has(key)) {
        map.set(key, {
          key, name: r.name, phone: r.phone ?? "",
          address: r.address ?? "", purchases: [], totalValue: 0, isReturning: false,
        });
      }
      const g = map.get(key)!;
      g.purchases.push(r);
      g.totalValue += rowViewTotal(r, view);
      if (r.address && !g.address) g.address = r.address;
    }
    for (const g of map.values()) g.isReturning = g.purchases.length > 1;
    return [...map.values()];
  })();

  const filtered = q
    ? grouped.filter((g) =>
        g.name.toLowerCase().includes(q) ||
        g.phone.toLowerCase().includes(q) ||
        g.purchases.some((r) => r.product.toLowerCase().includes(q) || r.note.toLowerCase().includes(q))
      )
    : grouped;

  const totalSales = filtered.reduce((s, g) => s + g.totalValue, 0);
  const isHopeful = view === "hopeful";

  const VIEWS: { key: View; label: string; activeClass: string }[] = [
    { key: "overall", label: "ทั้งหมด", activeClass: "bg-[#3D3D3D] text-white" },
    { key: "gosell",  label: "GoSell",  activeClass: "bg-[#87DE81] text-[#3D9B3A]" },
    { key: "hopeful", label: "Hopeful", activeClass: "bg-[#022EE8] text-[#0E8FA8]" },
  ];

  const newContactsFiltered = q && newContacts
    ? newContacts.filter((c) => c.phone.includes(q))
    : (newContacts ?? []);

  return (
    <>
      {editRow && <EditSaleModal row={editRow} onClose={() => setEditRow(null)} />}
      {activeGroup && (
        <CustomerProfile
          group={activeGroup}
          hasOrekaExt={hasOrekaExt}
          onClose={() => setActiveGroup(null)}
          onEdit={(r) => setEditRow(r)}
          onAddNew={() => {
            const params = new URLSearchParams({
              phone: activeGroup.phone,
              name: activeGroup.name,
              ...(activeGroup.address ? { address: activeGroup.address } : {}),
            });
            router.push(`/my-desk/add-customer?${params.toString()}`);
          }}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-semibold text-[#3D3D3D]">รายชื่อลูกค้า</h1>
            <p className="text-[12px] text-[#8B8E8F] mt-0.5">
              {mainTab === "registered" ? "ลูกค้าที่ชำระเงินแล้ว / ปิดการขายแล้ว" : "เบอร์จาก Oreka ที่ยังไม่ได้บันทึก"}
            </p>
          </div>
          {mainTab === "registered" && (
            <div className="flex items-center gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1">
              {VIEWS.map((v) => (
                <button key={v.key} onClick={() => setView(v.key)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${view === v.key ? v.activeClass : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main tabs */}
        {hasOrekaExt && (
          <div className="flex gap-1 bg-[#F7F7F7] border border-[#E8E8E8] rounded-xl p-1">
            <button
              onClick={() => setMainTab("registered")}
              className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition-all ${mainTab === "registered" ? "bg-white text-[#3D3D3D] shadow-sm" : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}
            >
              ลูกค้า
            </button>
            <button
              onClick={() => setMainTab("new_contacts")}
              className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${mainTab === "new_contacts" ? "bg-white text-[#3D3D3D] shadow-sm" : "text-[#8B8E8F] hover:text-[#3D3D3D]"}`}
            >
              ติดต่อใหม่
              {newContacts && newContacts.length > 0 && (
                <span className="text-[10px] bg-[#58CEE8] text-white px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center">
                  {newContacts.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C0C0C0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={mainTab === "registered" ? "ค้นหาชื่อ เบอร์โทร หรือสินค้า..." : "ค้นหาเบอร์โทร..."}
            className="w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg pl-8 pr-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0C0] hover:text-[#8B8E8F]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* ── REGISTERED TAB ── */}
        {mainTab === "registered" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
                <div className="text-[11px] text-[#8B8E8F] mb-1">ยอดปิดการขาย{view === "gosell" ? " (GoSell)" : view === "hopeful" ? " (Hopeful)" : "รวม"}</div>
                <div className={`text-[22px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D9B3A]"}`}>฿{totalSales.toLocaleString()}</div>
              </div>
              <div className="bg-white border border-[#E8E8E8] rounded-xl px-5 py-4">
                <div className="text-[11px] text-[#8B8E8F] mb-1">จำนวนลูกค้า</div>
                <div className="text-[22px] font-bold text-[#3D3D3D]">{filtered.length} ราย</div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">🏆</div>
                <p className="text-[14px] font-medium text-[#3D3D3D]">ยังไม่มีลูกค้าที่ปิดการขาย</p>
                <p className="text-[12px] text-[#8B8E8F] mt-1">เมื่ออัปเดตสถานะเป็น &ldquo;โอนแล้ว&rdquo; รายการจะย้ายมาที่นี่</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((group) => (
                  <div
                    key={group.key}
                    onClick={() => setActiveGroup(group)}
                    className={`bg-white border rounded-xl p-4 cursor-pointer hover:bg-[#F7F7F7] transition-colors ${
                      isHopeful ? "border-[#022EE8]/30" : "border-[#87DE81]/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                        isHopeful ? "bg-[#022EE8]/20 text-[#0E8FA8]" : "bg-[#87DE81]/20 text-[#3D9B3A]"
                      }`}>
                        {group.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-semibold text-[#3D3D3D]">{group.name}</span>
                          {group.isReturning && (
                            <span className="text-[9px] bg-[#022EE8]/15 text-[#0E8FA8] px-1.5 py-0.5 rounded-full font-semibold border border-[#022EE8]/20">
                              ลูกค้าเก่า {group.purchases.length} ครั้ง
                            </span>
                          )}
                          {group.phone && <span className="text-[11px] text-[#8B8E8F]">📞 {group.phone}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.purchases
                            .slice()
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((r, idx) => {
                              const amt = rowViewTotal(r, view);
                              return (
                                <div key={r.id ?? idx} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] ${
                                  isHopeful
                                    ? "bg-[#022EE8]/5 border-[#022EE8]/20 text-[#0E8FA8]"
                                    : "bg-[#87DE81]/5 border-[#87DE81]/20 text-[#3D9B3A]"
                                }`}>
                                  <span className="text-[9px] font-bold opacity-50">#{idx + 1}</span>
                                  {r.product && <span className="font-medium">{r.product}</span>}
                                  {amt > 0 && <span className="font-semibold">฿{amt.toLocaleString()}</span>}
                                  <span className="text-[9px] opacity-50">{r.date}</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-[16px] font-bold ${isHopeful ? "text-[#0E8FA8]" : "text-[#3D3D3D]"}`}>
                          ฿{group.totalValue.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#C0C0C0] mt-0.5">ดูประวัติ →</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── NEW CONTACTS TAB ── */}
        {mainTab === "new_contacts" && (
          <>
            {contactsLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl p-4 animate-pulse h-16" />
                ))}
              </div>
            )}
            {!contactsLoading && newContactsFiltered.length === 0 && (
              <div className="bg-white border border-[#E8E8E8] rounded-xl p-12 text-center">
                <div className="text-4xl mb-3">📞</div>
                <p className="text-[14px] font-medium text-[#3D3D3D]">ไม่มีเบอร์ใหม่จาก Oreka</p>
                <p className="text-[12px] text-[#8B8E8F] mt-1">เบอร์ที่โทรออกทั้งหมดถูกบันทึกแล้ว</p>
              </div>
            )}
            {!contactsLoading && newContactsFiltered.length > 0 && (
              <div className="space-y-3">
                {newContactsFiltered.map((contact) => (
                  <NewContactCard
                    key={contact.phone}
                    contact={contact}
                    onRegister={(phone) => {
                      router.push(`/my-desk/add-customer?phone=${encodeURIComponent(phone)}`);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Start dev server and spot-check visually**

```bash
npm run dev
```
Open `http://localhost:3000/my-desk/customers-list`. Verify:
- Page loads without errors
- If agent has no `oreka_ext`: no tabs, page looks identical to before
- If agent has `oreka_ext`: "ลูกค้า" / "ติดต่อใหม่" tabs appear
- Click a customer → profile modal opens → "สรุปการโทรล่าสุด" button appears at the bottom
- "ติดต่อใหม่" tab shows loading skeletons then contact cards

- [ ] **Step 4: Commit both page.tsx and client**

```bash
git add app/my-desk/customers-list/page.tsx app/my-desk/customers-list/CustomersListClient.tsx
git commit -m "feat(call-summary): add tabs, manual summarize button, unknown contacts tab"
```

---

## Task 8: End-to-End Verification

Manual verification steps after all tasks complete.

- [ ] **Step 1: Verify "สรุปการโทรล่าสุด" button works**

As an agent with `oreka_ext` configured:
1. Go to `/my-desk/customers-list`
2. Open a customer who has a phone number matching an Oreka recording in the last 7 days
3. Click "สรุปการโทรล่าสุด"
4. Verify spinner appears, then summary + coaching tips render
5. Close and reopen the same customer — verify the summary loads immediately (cached, no spinner)

- [ ] **Step 2: Verify "no recording" case**

Open a customer whose phone has NO Oreka recordings in the last 7 days. Click button. Verify "ไม่พบการโทรล่าสุดในระบบ Oreka (7 วันที่ผ่านมา)" message appears.

- [ ] **Step 3: Verify "ติดต่อใหม่" tab**

Click "ติดต่อใหม่" tab. Verify:
- Contacts load with phone, call count, total duration, last called date
- Phones already in `sales` table are NOT shown
- Clicking "กรอกข้อมูล →" navigates to Add Customer with phone pre-filled

- [ ] **Step 4: Verify agent without oreka_ext**

Log in as agent with no `oreka_ext`. Go to customers-list. Verify:
- No tab bar visible
- No "สรุปการโทรล่าสุด" button in profile modal
- Page looks identical to before this feature was added
