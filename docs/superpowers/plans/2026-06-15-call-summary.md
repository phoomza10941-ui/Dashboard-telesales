# Call Summary After Called Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect completed Oreka calls, transcribe with Whisper, summarize with GPT-4o, notify agent via toast, store summaries per customer phone, and show unknown Oreka contacts as a separate "ติดต่อใหม่" tab in customers-list.

**Architecture:** A 60-second client-side poller in `CustomersListClient` calls `POST /api/call-summary/check`. That route fetches the agent's last 2 hours of Oreka recordings, skips already-processed IDs (dedup via `call_summaries` table), downloads new audio, pipes through Whisper → GPT-4o, and saves the result. A separate `GET /api/oreka/contacts` route returns the agent's full Oreka call history grouped by customer phone for the "ติดต่อใหม่" tab.

**Tech Stack:** Next.js 16 App Router, Supabase (postgres + auth), `openai` v6 (Whisper + GPT-4o), existing `lib/oreka.ts` helpers, Tailwind CSS v4.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/add-call-summaries-table.sql` | Create | DB migration for `call_summaries` table + RLS |
| `package.json` | Modify | Move `openai` from devDependencies → dependencies |
| `lib/call-summary.ts` | Create | Core: download audio, Whisper, GPT-4o, save to DB |
| `app/api/call-summary/check/route.ts` | Create | POST — poller endpoint; runs pipeline for agent |
| `app/api/call-summary/route.ts` | Create | GET `?phone=xxx` — summaries for customer profile |
| `app/api/oreka/contacts/route.ts` | Create | GET — agent's Oreka call history grouped by remoteParty |
| `app/my-desk/customers-list/page.tsx` | Modify | Pass `hasOrekaExt` prop to client |
| `app/my-desk/customers-list/CustomersListClient.tsx` | Modify | Add tabs, poller, toast, unknown contacts tab, summary section in profile modal |

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

Go to the Supabase Dashboard → SQL Editor → paste and run the contents of `scripts/add-call-summaries-table.sql`. Verify the table appears in Table Editor.

- [ ] **Step 3: Move openai to dependencies in package.json**

In `package.json`, remove `"openai": "^6.42.0"` from `devDependencies` and add it to `dependencies`:

```json
"dependencies": {
  ...existing deps...,
  "openai": "^6.42.0"
},
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
Expected: lockfile updated, `openai` now under `dependencies`.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-call-summaries-table.sql package.json package-lock.json
git commit -m "feat(call-summary): add call_summaries table migration, move openai to deps"
```

---

## Task 2: Core Library — `lib/call-summary.ts`

**Files:**
- Create: `lib/call-summary.ts`

This file contains the full pipeline: detect new recordings → download audio → Whisper → GPT-4o → save.

- [ ] **Step 1: Create `lib/call-summary.ts`**

```ts
// lib/call-summary.ts
// Pipeline: new Oreka recordings → Whisper transcription → GPT-4o summary → call_summaries table
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

// Summarize transcript with GPT-4o, returns { summary, coaching_tips }
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

// Fetch the agent's Oreka recordings for the last 2 hours (any account)
async function fetchRecentRecordings(
  orekaExtGosell: string,
  orekaExtHopeful: string,
) {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000);
  const startUtc = toOrekaStamp(twoHoursAgo);
  const endUtc = toOrekaStamp(now);

  const OREKA_BASE = process.env.OREKA_BASE_URL ?? "";
  if (!OREKA_BASE) return [];

  const results: Array<{
    id: number; phone: string; duration: number;
    calledAt: string; accountId: AccountId;
  }> = [];

  const pairs: Array<{ ext: string; accountId: AccountId }> = [];
  if (orekaExtGosell)  pairs.push({ ext: orekaExtGosell,  accountId: "gosell" });
  if (orekaExtHopeful) pairs.push({ ext: orekaExtHopeful, accountId: "hopeful" });

  for (const { ext, accountId } of pairs) {
    try {
      const token = await getOrekaToken(accountId);
      const url = `${OREKA_BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}&page=1&pagesize=200&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;
      let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
      if (res.status === 401 || res.status === 403) {
        const newToken = await refreshOrekaToken(accountId);
        res = await fetch(url, { headers: { Authorization: newToken, Accept: "application/json" } });
      }
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data?.objects ?? []) {
        if (r.localParty !== ext) continue;
        results.push({
          id: r.id,
          phone: r.remoteParty ?? "",
          duration: Number(r.duration) || 0,
          calledAt: r.timestamp, // "YYYY-MM-DD HH:MM:SS" UTC
          accountId,
        });
      }
    } catch (e) {
      console.error(`[call-summary] fetchRecentRecordings (${accountId}) failed:`, e);
    }
  }

  return results;
}

// Main entry: find new recordings for agent, process them, return first new summary (if any)
export async function processNewCallsForAgent(
  agentId: string,
  orekaExtGosell: string,
  orekaExtHopeful: string,
): Promise<CallSummaryResult | null> {
  if (!orekaExtGosell && !orekaExtHopeful) return null;

  const recordings = await fetchRecentRecordings(orekaExtGosell, orekaExtHopeful);
  if (recordings.length === 0) return null;

  // Check which recording IDs we've already processed
  const ids = recordings.map((r) => String(r.id));
  const { data: existing } = await adminClient
    .from("call_summaries")
    .select("recording_id")
    .in("recording_id", ids);
  const processedIds = new Set((existing ?? []).map((r) => r.recording_id));

  // Process only new recordings, most recent first
  const newRecs = recordings
    .filter((r) => !processedIds.has(String(r.id)))
    .sort((a, b) => b.calledAt.localeCompare(a.calledAt));

  if (newRecs.length === 0) return null;

  // Process the most recent new recording only (others will be caught next poll)
  const rec = newRecs[0];

  try {
    const audioBuffer = await downloadAudio(rec.id, rec.accountId);
    const transcript = await transcribe(audioBuffer, String(rec.id));
    const { summary, coaching_tips } = await summarize(transcript);

    await adminClient.from("call_summaries").insert({
      agent_id: agentId,
      recording_id: String(rec.id),
      phone: rec.phone,
      duration: rec.duration,
      called_at: rec.calledAt,
      transcript,
      summary,
      coaching_tips,
    });

    return {
      recordingId: String(rec.id),
      phone: rec.phone,
      summary,
      coachingTips: coaching_tips,
      duration: rec.duration,
      calledAt: rec.calledAt,
    };
  } catch (e) {
    console.error(`[call-summary] processing recording ${rec.id} failed:`, e);
    // Insert a placeholder row so we don't retry this recording endlessly
    await adminClient.from("call_summaries").upsert({
      agent_id: agentId,
      recording_id: String(rec.id),
      phone: rec.phone,
      duration: rec.duration,
      called_at: rec.calledAt,
      transcript: null,
      summary: "ไม่สามารถสรุปได้ (เกิดข้อผิดพลาด)",
      coaching_tips: [],
    }, { onConflict: "recording_id" });
    return null;
  }
}

// Fetch all summaries for a given phone number, for this agent — used by customer profile
export async function getSummariesForPhone(
  agentId: string,
  phone: string,
): Promise<Array<{ id: string; summary: string; coachingTips: string[]; duration: number | null; calledAt: string | null; createdAt: string }>> {
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
Expected: No errors related to `lib/call-summary.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/call-summary.ts
git commit -m "feat(call-summary): add core pipeline lib (Oreka → Whisper → GPT-4o → DB)"
```

---

## Task 3: API Route — `POST /api/call-summary/check`

**Files:**
- Create: `app/api/call-summary/check/route.ts`

Called by the 60-second poller. Returns `{ newSummary: true, phone, summary, coachingTips, duration }` or `{ newSummary: false }`.

- [ ] **Step 1: Create the route**

```ts
// app/api/call-summary/check/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db";
import { processNewCallsForAgent } from "@/lib/call-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Whisper + GPT-4o can take ~10-20s

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orekaExtGosell, orekaExtHopeful } = currentUser;
  if (!orekaExtGosell && !orekaExtHopeful) {
    return NextResponse.json({ newSummary: false });
  }

  try {
    const result = await processNewCallsForAgent(user.id, orekaExtGosell, orekaExtHopeful);
    if (!result) return NextResponse.json({ newSummary: false });

    return NextResponse.json({
      newSummary: true,
      phone: result.phone,
      summary: result.summary,
      coachingTips: result.coachingTips,
      duration: result.duration,
    });
  } catch (e) {
    console.error("[call-summary/check]", e);
    return NextResponse.json({ newSummary: false });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Test with curl (requires dev server running)**

```bash
npm run dev
# In another terminal, log in via the browser first so session cookie exists, then:
curl -X POST http://localhost:3000/api/call-summary/check \
  -H "Cookie: <your-sb-auth-cookie>" \
  -v
```
Expected: `{ "newSummary": false }` if no new recordings, or a result object if there are new calls.

- [ ] **Step 4: Commit**

```bash
git add app/api/call-summary/check/route.ts
git commit -m "feat(call-summary): add POST /api/call-summary/check poller endpoint"
```

---

## Task 4: API Route — `GET /api/call-summary`

**Files:**
- Create: `app/api/call-summary/route.ts`

Returns all summaries for a given phone number for the authenticated agent.

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

Returns the agent's Oreka call history grouped by `remoteParty` for the last 30 days. Used by the "ติดต่อใหม่" tab.

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
  totalDuration: number; // seconds
  lastCalledAt: string;  // ISO UTC string
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

  // Last 30 days
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
        const url = `${BASE}/orktrack/rest/recordings?range=custom&startdate=${startUtc}&enddate=${endUtc}&page=${page}&pagesize=1000&maxresults=0&includetags=false&includemetadata=false&includeprograms=false`;
        let token = await getOrekaToken(accountId);
        let res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        if (res.status === 401 || res.status === 403) {
          token = await refreshOrekaToken(accountId);
          res = await fetch(url, { headers: { Authorization: token, Accept: "application/json" } });
        }
        if (!res.ok) break;

        const data = await res.json();
        const recs: Array<{ localParty: string; remoteParty: string; duration: number; timestamp: string; nextPageUri?: string }> = data?.objects ?? [];

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

## Task 6: Update `customers-list/page.tsx` — Pass `hasOrekaExt`

**Files:**
- Modify: `app/my-desk/customers-list/page.tsx`

The server component needs to tell the client whether the agent has Oreka configured, to decide whether to show the "ติดต่อใหม่" tab and run the poller.

- [ ] **Step 1: Update `page.tsx`**

Replace the full file content:

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
Expected: Error about unknown prop `hasOrekaExt` — this is fine, will be resolved in Task 7 when we update the client.

- [ ] **Step 3: Commit after Task 7 completes (batched)**

---

## Task 7: Update `CustomersListClient.tsx` — Tabs, Poller, Toast, Unknown Contacts

**Files:**
- Modify: `app/my-desk/customers-list/CustomersListClient.tsx`

This is the biggest change. We add:
1. A top-level tab: "ลูกค้า" vs "ติดต่อใหม่"
2. 60s poller that calls `/api/call-summary/check`
3. Toast notification component
4. "ติดต่อใหม่" tab content (fetches `/api/oreka/contacts`, subtracts known phones)
5. Call summary section inside the `CustomerProfile` modal

- [ ] **Step 1: Replace `CustomersListClient.tsx` with the full updated file**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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

interface CallSummary {
  id: string;
  summary: string;
  coachingTips: string[];
  duration: number | null;
  calledAt: string | null;
  createdAt: string;
}

interface ToastData {
  phone: string;
  summary: string;
  coachingTips: string[];
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function SummaryToast({ data, onDismiss, onView }: {
  data: ToastData; onDismiss: () => void; onView: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[340px] bg-[#3D3D3D] text-white rounded-2xl px-5 py-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#87DE81]/20 flex items-center justify-center shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#87DE81" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#87DE81] mb-0.5">สรุปการโทรพร้อมแล้ว</div>
          <div className="text-[11px] text-white/70 truncate">{data.phone}</div>
          <div className="text-[11px] text-white/60 mt-1 line-clamp-2">{data.summary}</div>
        </div>
        <button onClick={onDismiss} className="text-white/40 hover:text-white shrink-0 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <button
        onClick={onView}
        className="mt-3 w-full text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg py-2 transition-colors"
      >
        ดูเลย →
      </button>
    </div>
  );
}

// ── Call Summary Section ───────────────────────────────────────────────────────
function CallSummarySection({ phone }: { phone: string }) {
  const [summaries, setSummaries] = useState<CallSummary[] | null>(null);

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/call-summary?phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((d) => setSummaries(d.summaries ?? []))
      .catch(() => setSummaries([]));
  }, [phone]);

  if (summaries === null) {
    return (
      <div className="px-5 py-3 border-t border-[#E8E8E8]">
        <div className="text-[10px] text-[#8B8E8F] animate-pulse">กำลังโหลดสรุปการโทร...</div>
      </div>
    );
  }
  if (summaries.length === 0) return null;

  const latest = summaries[0];
  const durationStr = latest.duration ? formatTalkTime(latest.duration) : null;
  const dateStr = latest.calledAt
    ? new Date(latest.calledAt + " UTC").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
    : null;

  return (
    <div className="px-5 py-4 border-t border-[#E8E8E8] space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#8B8E8F] uppercase tracking-wide">สรุปการโทรล่าสุด</span>
        {dateStr && <span className="text-[10px] text-[#C0C0C0]">{dateStr}</span>}
        {durationStr && <span className="text-[10px] text-[#C0C0C0]">({durationStr} นาที)</span>}
      </div>
      <p className="text-[12px] text-[#3D3D3D] leading-relaxed">{latest.summary}</p>
      {latest.coachingTips.length > 0 && (
        <div className="bg-[#87DE81]/8 border border-[#87DE81]/20 rounded-xl p-3 space-y-1.5">
          <div className="text-[10px] font-semibold text-[#3D9B3A] flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            คำแนะนำ
          </div>
          {latest.coachingTips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-[#3D3D3D]">
              <span className="text-[#87DE81] font-bold shrink-0 mt-px">•</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function CustomerProfile({ group, onClose, onAddNew, onEdit }: {
  group: CustomerGroup; onClose: () => void; onAddNew: () => void; onEdit: (r: SaleRow) => void;
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

        {/* Summary */}
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

        <div className="flex-1 overflow-y-auto divide-y divide-[#F7F7F7]">
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

          {/* Call summary section */}
          {group.phone && <CallSummarySection phone={group.phone} />}
        </div>
      </div>
    </div>
  );
}

// ── New Contact Card ───────────────────────────────────────────────────────────
function NewContactCard({ contact, onRegister }: {
  contact: OrekaContact; onRegister: (phone: string) => void;
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
  rows, allRows, hasOrekaExt,
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
  const [toast, setToast] = useState<ToastData | null>(null);
  const [newContacts, setNewContacts] = useState<OrekaContact[] | null>(null);
  const [contactsLoading, setContactsLoading] = useState(false);

  // Known phones from sales (for subtraction)
  const knownPhones = new Set(allRows.map((r) => r.phone?.trim()).filter(Boolean));

  // Fetch unknown Oreka contacts when switching to "ติดต่อใหม่" tab
  useEffect(() => {
    if (mainTab !== "new_contacts" || !hasOrekaExt) return;
    if (newContacts !== null) return; // already loaded
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

  // 60-second poller for call summaries
  const runPoller = useCallback(async () => {
    if (!hasOrekaExt) return;
    try {
      const res = await fetch("/api/call-summary/check", { method: "POST" });
      const data = await res.json();
      if (data.newSummary) {
        setToast({ phone: data.phone, summary: data.summary, coachingTips: data.coachingTips ?? [] });
        // Refresh new contacts list so the registered one might move
        setNewContacts(null);
      }
    } catch {
      // silently ignore — network errors shouldn't break the page
    }
  }, [hasOrekaExt]);

  useEffect(() => {
    if (!hasOrekaExt) return;
    runPoller();
    const id = setInterval(runPoller, 60_000);
    return () => clearInterval(id);
  }, [hasOrekaExt, runPoller]);

  const q = search.trim().toLowerCase();

  // Group closed rows by phone (or name if no phone)
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
      {toast && (
        <SummaryToast
          data={toast}
          onDismiss={() => setToast(null)}
          onView={() => {
            setToast(null);
            // Find the group with this phone and open its profile
            const group = grouped.find((g) => g.phone === toast.phone);
            if (group) setActiveGroup(group);
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

        {/* Main tabs — only shown when Oreka is configured */}
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
                <span className="text-[10px] bg-[#58CEE8] text-white px-1.5 py-0.5 rounded-full font-bold">
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

- [ ] **Step 3: Start dev server and verify the page loads**

```bash
npm run dev
```
Open `http://localhost:3000/my-desk/customers-list` while logged in as an agent. Verify:
- "ลูกค้า" tab shows existing customers (unchanged)
- If agent has `oreka_ext` configured: "ติดต่อใหม่" tab appears
- If agent has no `oreka_ext`: only the single customers list shows (no tabs)

- [ ] **Step 4: Commit everything**

```bash
git add app/my-desk/customers-list/page.tsx app/my-desk/customers-list/CustomersListClient.tsx
git commit -m "feat(call-summary): add tabs, poller, toast, unknown contacts, summary in profile"
```

---

## Task 8: Verify End-to-End

Manual verification steps after all tasks are complete.

- [ ] **Step 1: Verify poller fires**

Open browser DevTools → Network tab. Go to `/my-desk/customers-list`. Wait 60 seconds. Confirm `POST /api/call-summary/check` appears in network requests every ~60s.

- [ ] **Step 2: Verify summary after a real call**

Have an agent make a call via dtac OneCall. Wait up to 60 seconds after the call ends. Verify:
- Toast appears at bottom of screen with the phone number
- Clicking "ดูเลย" opens the customer's profile (or the new contacts tab)
- The summary section appears below purchase history

- [ ] **Step 3: Verify "ติดต่อใหม่" tab**

Click "ติดต่อใหม่" tab. Verify Oreka contacts load as cards. Confirm phones that are already in `sales` are NOT shown. Click "กรอกข้อมูล →" and verify it navigates to Add Customer with the phone pre-filled.

- [ ] **Step 4: Verify no Oreka = no tabs**

Log in as an agent with no `oreka_ext` set. Go to customers-list. Confirm tab bar is hidden and page looks identical to before.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat(call-summary): complete implementation"
```
