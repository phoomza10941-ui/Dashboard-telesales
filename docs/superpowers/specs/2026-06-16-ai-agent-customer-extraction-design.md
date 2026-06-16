# AI Agent — Customer Extraction from Voice + Notion Product Knowledge

**Date:** 2026-06-16  
**Status:** Approved for implementation

---

## Overview

Two connected features:

1. **Notion → AI context**: Pull product knowledge from Notion and inject it into every OpenAI call (coaching, summaries, extraction).
2. **Voice → Customer profile**: When an agent runs Whisper on an Oreka recording, GPT extracts structured customer health/profile fields and saves them to a new `customers` table.

---

## Part 1 — Notion Product Knowledge Sync

### Approach
Live fetch + 30-minute in-memory cache (Approach A). No DB migration. Notion is always source of truth.

### Source
- **Page ID:** `32fb29d9-a9fe-8157-94ce-f7a6ae6dad39`
- **Structure:** Single page, 3 H1 product sections (HOPEFUL, BioActive+, Yanhee), each with overview callout + sales script template callout + toggle blocks
- **Token:** `NOTION_TOKEN` in `.env.local`

### `lib/notion.ts` (new file)
```ts
// Fetches Notion page blocks, extracts plain text, caches 30 min
getProductKnowledge(): Promise<string>
```
- Calls `GET /v1/blocks/{pageId}/children?page_size=100`
- Recursively fetches toggle/callout children that `has_children: true`
- Extracts `plain_text` from all rich_text arrays, concatenates by section
- Returns formatted string: `=== HOPEFUL ===\n...\n=== BioActive+ ===\n...`
- Cache: module-level `{ text, expiresAt }` object, TTL = 30 min
- On fetch error: returns cached value if available, else empty string (never throws)

### Injection point
`lib/call-summary.ts` — prepend product knowledge to the system prompt of both the coaching GPT call and the new extraction GPT call.

---

## Part 2 — Customer Profile Table

### New Supabase table: `customers`
```sql
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES auth.users NOT NULL,
  phone         TEXT,
  first_name    TEXT,
  last_name     TEXT,
  nickname      TEXT,
  diseases      TEXT,        -- โรคเป็นอยู่
  symptoms      TEXT,        -- อาการตอนนี้
  medications   TEXT,        -- ยาที่กำลังทานอยู่
  consulted_doc TEXT,        -- ปรึกษาหมอมั้ย (free text, e.g. "ใช่ — ทุก 3 เดือน")
  patient_type  TEXT,        -- คนที่ทาน (ตัวเอง / คนในครอบครัว)
  oreka_rec_id  TEXT,        -- Oreka recording ID used for last extraction
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
-- RLS: agents see only their own customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own customers" ON customers
  USING (agent_id = auth.uid());
```

### Field config stored in `team_config`
A new key `ai_extraction_fields` stores which fields are enabled:
```json
{
  "first_name": true,
  "last_name": true,
  "nickname": true,
  "diseases": true,
  "symptoms": true,
  "medications": true,
  "consulted_doc": true,
  "patient_type": true
}
```
Default: all enabled. Supervisor can toggle per field.

---

## Part 3 — AI Extraction Flow

### API route: `POST /api/customer/analyze`
Request: `{ orekaRecordingId, customerId? }`  
Steps:
1. Fetch recording audio URL from Oreka API
2. Run Whisper (`lib/call-summary.ts` existing transcribe function)
3. Fetch enabled fields from `team_config.ai_extraction_fields`
4. Fetch product knowledge from `lib/notion.ts`
5. Call GPT with structured extraction prompt (see below)
6. Return `{ fields: { first_name?, last_name?, ... }, transcript }`

### GPT extraction prompt
```
System: You are extracting customer health profile information from a Thai telesales call transcript.
Product context: {productKnowledge}

Extract ONLY the following fields if mentioned. Return JSON. 
If a field was not discussed, omit it from the response entirely.
Fields: {enabledFields as Thai labels}

Rules:
- ชื่อ/นามสกุล/ชื่อเล่น: exact as spoken
- โรคเป็นอยู่: comma-separated conditions
- ยาที่กำลังทานอยู่: comma-separated drug names
- ปรึกษาหมอมั้ย: short answer, include frequency if mentioned
- คนที่ทาน: "ตัวเอง" or "คนในครอบครัว — [relation]"
- อาการตอนนี้: brief description

User: {transcript}
```

### `lib/db.ts` additions
```ts
getCustomers(agentId): Promise<Customer[]>
getCustomer(id): Promise<Customer>
upsertCustomer(agentId, data): Promise<Customer>
getAiExtractionFields(): Promise<Record<string, boolean>>
setAiExtractionFields(fields): Promise<void>
```

---

## Part 4 — UI

### `app/my-desk/customer-list/page.tsx` (new page)
- Server component, calls `getCurrentUser()` + `getAgentOrekaExt(userId)` + `getCustomers(userId)`
- Passes `orekaExt` as prop to `AnalyzeCallPanel` (client needs it to filter recordings)
- Lists customers with: avatar (first letter), name + nickname, disease tags, phone
- Each row: "วิเคราะห์สาย" button + "แก้ไข" button
- Empty state: "ยังไม่มีลูกค้า — กด 'เพิ่มลูกค้า' เพื่อเริ่มต้น"

> Note: `getCurrentUser()` does not return `oreka_ext`. Use existing `getAgentsWithOrekaExt()` filtered by userId, or add `getAgentOrekaExt(userId): Promise<string | null>` to `lib/db.ts`.

### `app/my-desk/customer-list/AnalyzeCallPanel.tsx` (client component)
- Slide-in panel triggered by "วิเคราะห์สาย"
- Receives `orekaExt` prop from server page
- Step 1: Calls `/api/oreka/recordings?ext={orekaExt}&date=today` to list today's recordings (reuse Oreka auth flow from `lib/oreka.ts`)
- Step 2: Progress bar while Whisper + GPT runs (calls `/api/customer/analyze`)
- Step 3: Extracted fields grid — found fields in white cards, missing fields in yellow with "ไม่ได้พูดถึงในสาย"
- Agent can edit any field before saving
- "บันทึก" → POST to upsertCustomer

### Supervisor config card in `/supervisor/settings`
Add new card **"AI Agent — การดึงข้อมูล"** below existing Oreka card:

**Section A — Notion Product Knowledge**
- Status pill: 🟢 Connected / 🔴 ไม่ได้เชื่อมต่อ
- "Force Sync" button → clears cache, fetches fresh
- Preview: last 3 lines of extracted text (collapsed)

**Section B — ฟิลด์ที่ให้ AI ดึง**
- Toggle list of all 8 fields with Thai labels
- Changes saved to `team_config.ai_extraction_fields`

---

## File Changes Summary

| File | Action |
|------|--------|
| `lib/notion.ts` | Create — Notion fetch + cache |
| `lib/call-summary.ts` | Edit — inject product knowledge into system prompts |
| `lib/db.ts` | Edit — add customer + config functions + `getAgentOrekaExt()` |
| `app/api/customer/analyze/route.ts` | Create — Whisper + GPT extraction API |
| `app/my-desk/customer-list/page.tsx` | Create — customer list page |
| `app/my-desk/customer-list/AnalyzeCallPanel.tsx` | Create — extraction panel client component |
| `app/supervisor/settings/page.tsx` | Edit — add AI Agent config card |
| `scripts/add-customers-table.sql` | Create — migration script |
| `.env.local` | Already has `NOTION_TOKEN` ✓ |

---

## Out of Scope (v1)
- Customer deduplication across agents
- Custom field creation by supervisor (fixed 8 fields only)
- Automatic matching of Oreka calls to customers by phone number
- Scheduling auto-sync of Notion content
