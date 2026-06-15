# Call Summary After Called + Customers List Enhancement

**Date:** 2026-06-15  
**Status:** Approved — ready for implementation

## Overview

Two connected features:
1. **Summary After Called** — agent manually triggers a summary of the latest call with a customer; system fetches the Oreka recording, transcribes with Whisper, summarizes with GPT-4o, stores result per customer phone
2. **Customers List Enhancement** — add "ติดต่อใหม่" tab showing Oreka phone numbers not yet registered in the system

## Architecture

### Trigger (Manual)
Agent opens a customer profile modal in customers-list and clicks **"สรุปการโทรล่าสุด"** button. This calls `POST /api/call-summary/generate` with the customer's phone number. The server finds the most recent Oreka recording for that phone (matching agent's `localParty`), runs the pipeline, and returns the result. Agent controls cost — no auto-polling.

### Summary Pipeline
1. Receive `phone` from client
2. Fetch agent's Oreka recordings from the last 7 days, filter by `localParty === agent.oreka_ext` and `remoteParty === phone`
3. Pick the most recent recording
4. Check `call_summaries` table — if this `recording_id` already exists, return cached result
5. If new:
   - Download audio buffer from Oreka (`/orktrack/rest/mediastream/{id}`)
   - POST to OpenAI Whisper → `transcript`
   - POST transcript to GPT-4o → `summary` + `coaching_tips[]`
   - Insert into `call_summaries`
6. Return `{ summary, coachingTips, duration, calledAt }`

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

### `POST /api/call-summary/generate`
- Auth: Supabase session (agent only)
- Body: `{ phone: string }`
- Finds the most recent Oreka recording for this agent ↔ customer phone pair (last 7 days)
- Returns cached result if already summarized; otherwise runs Whisper → GPT-4o → saves
- Returns `{ summary: string, coachingTips: string[], duration: number, calledAt: string }`
- Returns `{ error: "no_recording" }` if no Oreka recording found for this phone

### `GET /api/oreka/contacts`
- Auth: Supabase session (agent only)
- Returns agent's Oreka call history grouped by `remoteParty` (last 30 days)
- Response: `{ phone: string, callCount: number, totalDuration: number, lastCalledAt: string }[]`

### `GET /api/call-summary?phone=xxx`
- Auth: Supabase session (agent only)
- Returns all saved `call_summaries` rows for a given phone for this agent (newest first)
- Shown inside customer profile modal on open

## New Environment Variable
```
OPENAI_API_KEY=sk-...
```

## UI Changes

### Customers-list — tab bar
Two tabs (shown only when agent has `oreka_ext` configured):
- **"ลูกค้า"** — existing registered customers (unchanged)
- **"ติดต่อใหม่"** (badge with count) — unknown Oreka contacts

"ติดต่อใหม่" card layout:
```
[ ? ]  +66 81-234-5678              โทร 7 ครั้ง  •  รวม 23 นาที
       โทรล่าสุด: 14/06/2026        [กรอกข้อมูล →]
```
Tapping "กรอกข้อมูล" pre-fills Add Customer form with the phone number.

### Customer profile modal — summary section
Below purchase history, a section that:
1. On open: fetches `GET /api/call-summary?phone=xxx` to show any existing summaries
2. Shows a **"สรุปการโทรล่าสุด"** button (only if agent has `oreka_ext`)
3. On click: calls `POST /api/call-summary/generate`, shows spinner, then renders result

```
[  สรุปการโทรล่าสุด  ]   ← button (teal border)

After click → loading spinner → then:

📋 สรุปการโทรล่าสุด  •  14 มิ.ย. 69  (4:23 นาที)
──────────────────────────────────────────────────
ลูกค้าสนใจ iPhone Air 256GB สีดำ แต่ติดเรื่องราคา...

💡 คำแนะนำ
• พูดถึงโปรผ่อน 0% ก่อนที่ลูกค้าจะถามเรื่องราคา
• ลองเสนอ upsell AirPods ช่วงปิดการขาย
```

If no Oreka recording found: show "ไม่พบการโทรล่าสุด" message.

## Cost Estimate (OpenAI)

- Whisper: $0.006/min × avg 4 min = ~$0.024/call
- GPT-4o summary: ~$0.004/call
- **~$0.028/call (~฿1) — only when agent clicks the button**
- Agent-controlled: if team summarizes 20 calls/day total = ~$0.56/day (~฿20/day)

## Out of Scope (this phase)
- Auto-polling / automatic summary trigger
- Toast notifications
- Supervisor view of summaries
- Summary search/filter
- Multi-language summary (Thai output assumed)
- The 2 other connected features (to be designed separately)
