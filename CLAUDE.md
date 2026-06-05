# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # Start dev server (usually port 3000, falls back to 3001)
npm run build   # Production build
npm run lint    # ESLint
npx tsc --noEmit  # Type check without building
```

## Stack

- **Next.js 16.2.6** App Router — middleware is renamed to `proxy.ts`, exported function is `proxy` (not `middleware`)
- **TypeScript** + **Tailwind CSS v4**
- **Supabase** — PostgreSQL database + Auth (replaces Google Sheets + iron-session)
- **@supabase/ssr** for server-side auth with cookies
- **Framer Motion** — animations in client components (War Room dashboard)

## Architecture

### Auth
- `lib/supabase/server.ts` — server-side Supabase client (uses `await cookies()`)
- `lib/supabase/admin.ts` — service role client for cross-user queries
- `lib/supabase/client.ts` — browser client for client components
- `proxy.ts` — route protection: `/my-desk/*` requires auth, checks `sb-*-auth-token` cookie
- Auth uses fake email pattern: `username@telesales.internal` — users never see email, only username
- Registration uses `adminClient.auth.admin.createUser` with `email_confirm: true` (bypasses email confirmation)

### Data Layer (`lib/db.ts`)
Replaces `lib/google-sheets.ts`. Key functions:
- `getCurrentUser()` — reads Supabase session, returns `{ id, nickname, fullName, agentCode, team }`
- `getMyData(userId)` — fetches agent's sales from `sales` table via admin client
- `getAllAgentsData()` — all agents (supervisor/war room use)
- `getAllAgentsAnalysis()` — per-agent breakdown: todaySales, todayOrders, pendingTransferRows, followUpRows, objections, statusCounts, todayRows, allRows
- `getAgentsWithTargets()` — agents with individual or team daily targets
- `getDailyTarget()` / `setDailyTarget()` — team-wide daily target from `team_config`
- `getAgentTarget(agentId)` / `setAgentTarget()` — per-agent target, falls back to team target
- `getTodayHourlySales()` — hourly sales array for today (Thailand UTC+7), used for pace chart
- `addSale(userId, row)` — inserts into `sales` table
- `parseNoteStatus(note)` → `"closed" | "pending_transfer" | "follow_up" | "lost" | "in_progress"`
- `parseNoteObjection(note)` → objection label string or null
- `filterToday/filterFollowUp/filterPending/buildTrend` — pure utilities, unchanged
- `getAgentsWithOrekaExt()` / `setAgentOrekaExt(agentId, ext)` — read/write `profiles.oreka_ext` (dtac OneCall Local Party number for talk-time matching)

### Database Schema (Supabase)
```sql
profiles (id UUID → auth.users, full_name, nickname UNIQUE, agent_code, team, role, oreka_ext TEXT, created_at)
sales (id UUID, agent_id UUID → auth.users, date TEXT, customer_name TEXT, phone, address, product, upsell NUMERIC, crm NUMERIC, note TEXT, created_at)
```
`oreka_ext` = agent's dtac OneCall "Local Party" number in `+66...` form (talk-time matching). Add via `scripts/add-oreka-ext-column.sql`.
RLS enabled on both tables — agents see only their own data. Admin client bypasses RLS.

### My Desk pages (`app/my-desk/`)
All server components. Each calls `getCurrentUser()` then `getMyData(user.id)`.
- Layout: `StickyKpiBar` receives `userId` prop, `SideNav` receives `fullName/agentCode/team`
- Pages: today-command, priority-queue, pending-payment, follow-up, my-performance
- `add-customer/page.tsx` passes `agentName` (nickname) to `AddCustomerForm` client component

### War Room (`app/war-room/`)
Non-scrolling TV dashboard (`h-screen overflow-hidden`). Designed for 16:9 display in the telesales room.
- `page.tsx` — server component, fetches all data then renders the full layout
- `LiveClock.tsx` — client component, live HH:MM:SS clock with blinking colon (Framer Motion)
- `PodiumPanel.tsx` — client component, Olympic podium for top 3 with 5 switchable tabs (Top Sales / Orders / AOV / Product / Follow-up). Uses `AnimatePresence` for tab crossfade and spring rise animations.
- `AnimatedBar.tsx` — client component, animated progress bar fill (width 0→value on mount)
- `MotionSection.tsx` — client wrapper, staggered fade+slide entrance for server-rendered sections

**Layout rows (top to bottom):**
1. KPI Scoreboard — 8 cards: ยอดวันนี้, % เป้า, ออเดอร์, AOV, Forecast, Pending, Follow-up + clock
2. Charts row — Sales Pace vs Target (SVG line chart), Hourly Sales (bar), Action Alerts
3. Funnel row — Team Funnel + Follow-up Pool (2 panels)
4. Right column (spans rows 2–3) — PodiumPanel + AI Command Summary

**Design rules for War Room:**
- Positive leaderboard only — no bottom rankings, no "Behind" per person
- Action Alerts auto-computed from pace gap, pending count, top objection
- Pace chart SVG is rendered server-side (no client JS needed)
- Thailand timezone (UTC+7) applied in `getTodayHourlySales()` and `getThaiHour()`

### Talk Time Integration — dtac OneCall / Oreka (`lib/oreka.ts`)
Pulls per-agent **talk time** from dtac OneCall's voice-record portal, which is an **Oreka (OrecX)** deployment exposing the **OrkTrack REST API** at `/orktrack/rest/`. Server-side live fetch, surfaced on `/supervisor/talk-time` only.

- **Auth flow (server logs in itself):**
  1. `POST /orktrack/rest/user/login?version=orktrack&accesspolicy=all&licenseinfo=true` with header `Authorization: Basic base64(OREKA_USER:OREKA_PASSWORD)`, empty body → response JSON has token in field **`accesstoken`**. No JSESSIONID cookie needed.
  2. `GET /orktrack/rest/recordings?range=custom&startdate=YYYYMMDD_HHMMSS&page=N&pagesize=N&...` with header `Authorization: <accesstoken>`. Paginate via `nextPageUri` until short page.
- Token cached in-module; lazy re-login on 401/403. Talk-time result cached ~90s (TTL).
- **Recording fields:** `objects[]` array; each `{ id, timestamp, duration, localParty, remoteParty, direction, userDto }`. `duration` is **seconds**, `direction` = `"IN"`/`"OUT"`, `timestamp` + `startdate` are **UTC** (convert Thai day boundaries −7h via helpers in `lib/oreka.ts`).
- **Agent matching:** `recordingDto.localParty` (`+66...`) → `profiles.oreka_ext` → `nickname`. Set numbers via Supervisor → Settings → "Talk Time — จับคู่เบอร์ Oreka" card (`AgentOrekaExtForm` → `bulkUpdateAgentOrekaExt`, auto-normalizes `0…`/`66…` → `+66…`).
- `getTalkTimeByAgentSafe()` is the page-level entry — never throws, so `/supervisor/talk-time` still renders if Oreka is down.
- `scripts/test-oreka.mjs` — standalone probe (reads `.env.local`) for debugging the API.
- Design doc: `docs/plans/2026-06-02-oreka-talktime-supervisor-design.md`.

### Design System
- Colors: white `#FFFFFF`, green `#87DE81`, cyan `#58CEE8`, text `#8B8E8F`, dark `#3D3D3D`, border `#E8E8E8`, surface `#F7F7F7`
- Input class: `w-full bg-[#F7F7F7] border border-[#E8E8E8] rounded-lg px-3 py-2.5 text-[13px] text-[#3D3D3D] placeholder:text-[#C0C0C0] focus:outline-none focus:border-[#87DE81] focus:bg-white transition-colors`

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OREKA_BASE_URL=https://onecallvoicerecord.dtac.co.th   # dtac OneCall (Oreka) talk-time API
OREKA_USER=+66...            # Oreka login (phone), used for Basic auth
OREKA_PASSWORD=...           # Oreka login password
SESSION_SECRET=...           # iron-session (legacy, unused)
GOOGLE_SHEETS_ID=...         # legacy, unused
GOOGLE_SERVICE_ACCOUNT_EMAIL=...  # legacy, unused
GOOGLE_PRIVATE_KEY=...       # legacy, unused
```

## Key Conventions
- `SaleRow.name` = customer name (maps to `customer_name` in DB)
- Agent identified by Supabase UUID (`user.id`) in DB, by nickname in UI
- `lib/google-sheets.ts`, `lib/session.ts`, `lib/auth.ts` are legacy — not imported anywhere, do not delete
- Date format sent to DB: `DD/MM/YYYY` (converted from `YYYY-MM-DD` input via `isoToDMY()`)
