# Call Summary After Called + Customers List Enhancement

**Date:** 2026-06-15  
**Status:** Approved — ready for implementation

## Overview

Two connected features:
1. **Summary After Called** — auto-detect completed Oreka calls, transcribe with Whisper, summarize with GPT-4o, notify agent via toast, store for future reference
2. **Customers List Enhancement** — add "ติดต่อใหม่" tab showing Oreka phone numbers not yet registered in the system

## Architecture

### Trigger
`CustomersListClient` runs `setInterval` every 60s calling `POST /api/call-summary/check`. Only runs when the agent has `oreka_ext` configured.

### Summary Pipeline
1. Fetch agent's Oreka recordings from the last 2 hours (narrow window for speed)
2. Filter by `localParty === agent.oreka_ext`
3. Dedup against `call_summaries` table using `recording_id`
4. For each new recording:
   - Download audio buffer from Oreka
   - POST to OpenAI Whisper → `transcript`
   - POST transcript to GPT-4o → `summary` + `coaching_tips[]`
   - Insert into `call_summaries`
5. Return `{ newSummary: true, phone, summary }` or `{ newSummary: false }`

### Unknown Contacts Pipeline
- `GET /api/oreka/contacts` — returns agent's Oreka call history grouped by `remoteParty`
- Client subtracts phones already in `sales` table → remainder = "ติดต่อใหม่"

## Database

```sql
CREATE TABLE call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  recording_id TEXT NOT NULL UNIQUE,   -- Oreka recording ID (dedup key)
  phone TEXT NOT NULL,                  -- remoteParty (customer phone)
  duration INTEGER,                     -- seconds
  called_at TIMESTAMPTZ,
  transcript TEXT,
  summary TEXT,
  coaching_tips JSONB,                  -- string[]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: agents see only their own summaries
ALTER TABLE call_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent own summaries" ON call_summaries
  FOR ALL USING (agent_id = auth.uid());
```

## API Routes

### `POST /api/call-summary/check`
- Auth: Supabase session (agent only)
- Fetches last 2h Oreka recordings for agent's `oreka_ext`
- Runs pipeline above
- Returns `{ newSummary: boolean, phone?: string, summary?: string }`

### `GET /api/oreka/contacts`
- Auth: Supabase session (agent only)
- Returns agent's Oreka call history grouped by `remoteParty`
- Response: `{ phone: string, callCount: number, totalDuration: number, lastCalledAt: string }[]`

### `GET /api/call-summary?phone=xxx`
- Auth: Supabase session (agent only)
- Returns all `call_summaries` rows for a given phone for this agent
- Shown inside customer profile modal

## New Environment Variable
```
OPENAI_API_KEY=sk-...
```

## UI Changes

### Customers-list — tab bar
Two tabs:
- **"ลูกค้า"** — existing registered customers (unchanged)
- **"ติดต่อใหม่"** (badge with count) — unknown Oreka contacts

"ติดต่อใหม่" card layout:
```
[ ? ]  +66 81-234-5678              โทร 7 ครั้ง  •  รวม 23 นาที
       โทรล่าสุด: 14/06/2026        [กรอกข้อมูล →]
```
Tapping "กรอกข้อมูล" pre-fills Add Customer form with the phone number.

### Customer profile modal — summary section
New section below purchase history:
```
📋 สรุปการโทรล่าสุด  •  14 มิ.ย. 69  (4:23 นาที)
──────────────────────────────────────────────────
ลูกค้าสนใจ iPhone Air 256GB สีดำ แต่ติดเรื่องราคา...

💡 คำแนะนำ
• พูดถึงโปรผ่อน 0% ก่อนที่ลูกค้าจะถามเรื่องราคา
• ลองเสนอ upsell AirPods ช่วงปิดการขาย
```

### Toast notification
Fixed bottom-center, slides up on `newSummary: true`:
```
✓ สรุปการโทรกับ สมชาย +6681... พร้อมแล้ว  [ดูเลย]
```
Auto-dismisses after 8 seconds. Clicking opens customer profile with summary visible.

## Cost Estimate (OpenAI)

- Whisper: $0.006/min × avg 4 min = ~$0.024/call
- GPT-4o summary: ~$0.004/call
- **~$0.028/call (~฿1)**
- 10 agents × 30 calls/day = ~$250/month

## Out of Scope (this phase)
- Supervisor view of summaries
- Summary search/filter
- Multi-language summary (Thai output assumed)
- The 2 other connected features (to be designed separately)
