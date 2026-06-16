# UI Polish — 3-Phase Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all UI/UX issues found in the 3-page telesales dashboard review, grouped into 3 phases ordered by risk and effort.

**Architecture:** Pure file edits — no new routes, no schema changes, no new components unless noted. Each phase is independently shippable and visually verifiable with a Playwright screenshot.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, inline SVG icons (no icon library added)

---

## Phase 1 — Visual Consistency (Low risk, cosmetic only)

> Files touched: 4 — all cosmetic, zero logic changes.

---

### Task 1.1: Replace emoji icons in empty states with SVG

**Files:**
- Modify: `app/my-desk/priority-queue/page.tsx:138`
- Modify: `app/my-desk/follow-up/page.tsx:28`
- Modify: `app/my-desk/pending-payment/page.tsx:38`

**Problem:** `<div className="text-4xl mb-3">📋</div>`, `🎯`, and `✅` look inconsistent against the SVG icons used everywhere else.

- [ ] **Step 1: Fix Priority Queue empty state icon**

In `app/my-desk/priority-queue/page.tsx`, replace:
```tsx
<div className="text-4xl mb-3">📋</div>
```
With:
```tsx
<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F7F7F7] flex items-center justify-center">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <line x1="9" y1="12" x2="15" y2="12"/>
    <line x1="9" y1="16" x2="13" y2="16"/>
  </svg>
</div>
```

- [ ] **Step 2: Fix Follow-up empty state icon**

In `app/my-desk/follow-up/page.tsx`, replace:
```tsx
<div className="text-4xl mb-3">🎯</div>
```
With:
```tsx
<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#58CEE8]/10 flex items-center justify-center">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58CEE8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
</div>
```

- [ ] **Step 3: Fix Pending Payment empty state icon**

In `app/my-desk/pending-payment/page.tsx`, replace:
```tsx
<div className="text-4xl mb-3">✅</div>
```
With:
```tsx
<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#87DE81]/15 flex items-center justify-center">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#87DE81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
</div>
```

- [ ] **Step 4: Verify visually**

Run the Playwright screenshot script:
```bash
node scripts/screenshot_mydesk.js
```
Open `D:\tmp_review\priority-queue.png`, `follow-up.png`, `pending-payment.png` and confirm SVG icons appear.

- [ ] **Step 5: Commit**
```bash
git add app/my-desk/priority-queue/page.tsx app/my-desk/follow-up/page.tsx app/my-desk/pending-payment/page.tsx
git commit -m "fix: replace emoji icons in empty states with SVG icons"
```

---

### Task 1.2: Fix War Room ticker over-repetition

**Files:**
- Modify: `app/war-room/TickerBar.tsx:26`

**Problem:** `copies = Math.ceil(12 / items.length)` — with 1–2 alerts, this creates 12–24 copies of the same item scrolling back-to-back. It should repeat enough to fill the bar without spamming.

- [ ] **Step 1: Reduce copies cap**

In `app/war-room/TickerBar.tsx`, replace:
```tsx
const copies = Math.ceil(12 / Math.max(items.length, 1));
```
With:
```tsx
const copies = Math.max(Math.ceil(4 / Math.max(items.length, 1)), 1);
```

This caps repetition at ~4 total items before the loop restarts, giving natural spacing between repeats.

- [ ] **Step 2: Verify**

Take screenshot of war-room:
```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('http://localhost:3000/war-room', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: 'D:/tmp_review/war-room-p1.png', fullPage: true });
  await b.close();
})();" 
```
Confirm the ticker shows distinct alerts with visible spacing.

- [ ] **Step 3: Commit**
```bash
git add app/war-room/TickerBar.tsx
git commit -m "fix: reduce ticker repetition when alert count is low"
```

---

### Task 1.3: Cap supervisor % overflow display

**Files:**
- Modify: `app/supervisor/team-performance/page.tsx:100-103`

**Problem:** An agent at 101004% shows as "101004%" — technically correct but visually absurd. Cap the displayed number at 999% and switch to a "✓ Hit" indicator when over 100%.

- [ ] **Step 1: Update the percentage cell rendering**

In `app/supervisor/team-performance/page.tsx`, the `<td>` for "เทียบเป้า" currently renders:
```tsx
<span className={`font-semibold text-[12px] ${targetPct >= 80 ? "text-[#3D9B3A]" : targetPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
  {targetPct}%
</span>
```

Replace that `<span>` with:
```tsx
{targetPct > 100 ? (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3D9B3A] bg-green-50 px-2 py-0.5 rounded-full">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    ถึงเป้าแล้ว
  </span>
) : (
  <span className={`font-semibold text-[12px] ${targetPct >= 80 ? "text-[#3D9B3A]" : targetPct >= 50 ? "text-amber-600" : "text-red-500"}`}>
    {targetPct}%
  </span>
)}
```

- [ ] **Step 2: Verify**

Take supervisor screenshot and confirm Phoom shows "✓ ถึงเป้าแล้ว" badge instead of "101004%".

- [ ] **Step 3: Commit**
```bash
git add app/supervisor/team-performance/page.tsx
git commit -m "fix: cap target% display — show badge when agent exceeds 100%"
```

---

### Task 1.4: Fix War Room AI Command text truncation

**Files:**
- Modify: `app/war-room/page.tsx:444`

**Problem:** The AI Command `<p>` is inside a flex container with no `overflow` setting, causing the text to be cut off at the panel bottom.

- [ ] **Step 1: Add overflow scroll to the AI Command panel content**

In `app/war-room/page.tsx`, the AI Command `<p>` is:
```tsx
<p className="text-[12px] text-[#D0D4DC] leading-relaxed">{aiSummary}</p>
```

Replace with:
```tsx
<p className="text-[12px] text-[#D0D4DC] leading-relaxed overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{aiSummary}</p>
```

This clamps to 3 lines so it always fits, rather than silently truncating at the container edge.

- [ ] **Step 2: Verify**

Take war-room screenshot and confirm AI Command text is fully visible (3 lines max, no cut-off).

- [ ] **Step 3: Commit**
```bash
git add app/war-room/page.tsx
git commit -m "fix: clamp AI Command text to 3 lines to prevent overflow cut-off"
```

---

## Phase 2 — Layout & Spacing

> Files touched: 3 — layout restructuring and chart improvements.

---

### Task 2.1: Fix Supervisor empty white space below table

**Files:**
- Modify: `app/supervisor/team-performance/page.tsx:23`

**Problem:** The page wrapper uses `h-full flex flex-col` which stretches the table card to fill the entire viewport height. With only 3 agents the table rows end at ~30% and the rest is blank white.

- [ ] **Step 1: Remove h-full stretch from the page wrapper**

In `app/supervisor/team-performance/page.tsx`, replace the outer wrapper:
```tsx
<div className="h-full flex flex-col">
```
With:
```tsx
<div className="flex flex-col">
```

And replace the table card that has `flex-1`:
```tsx
<div className="flex-1 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
```
With:
```tsx
<div className="bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden flex flex-col">
```

And the inner `overflow-auto flex-1` wrapper:
```tsx
<div className="overflow-auto flex-1">
```
With:
```tsx
<div className="overflow-auto">
```

- [ ] **Step 2: Verify**

Take supervisor screenshot. The table should now be naturally sized — padding below the last row, then `#F7F7F7` background below. No giant white void.

- [ ] **Step 3: Commit**
```bash
git add app/supervisor/team-performance/page.tsx
git commit -m "fix: remove h-full stretch from team performance page to eliminate empty white space"
```

---

### Task 2.2: Fix Supervisor "SV" avatar to show role icon

**Files:**
- Modify: `app/supervisor/components/SupervisorNav.tsx:156-163`

**Problem:** The "SV" text badge in the sidebar reads as a placeholder. Replace with a proper role indicator using a supervisor icon.

- [ ] **Step 1: Update the role badge section**

In `app/supervisor/components/SupervisorNav.tsx`, replace:
```tsx
<div className="w-8 h-8 rounded-full bg-[#58CEE8]/20 flex items-center justify-center text-[#58CEE8] text-xs font-bold shrink-0">
  SV
</div>
<div className="min-w-0">
  <div className="text-[12px] font-medium text-[#3D3D3D] truncate">หัวหน้าทีม</div>
  <div className="text-[10px] text-[#8B8E8F] truncate">Supervisor View</div>
</div>
```
With:
```tsx
<div className="w-8 h-8 rounded-full bg-[#58CEE8]/20 flex items-center justify-center shrink-0">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#58CEE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
</div>
<div className="min-w-0">
  <div className="text-[12px] font-medium text-[#3D3D3D] truncate">หัวหน้าทีม</div>
  <div className="text-[10px] text-[#8B8E8F] truncate">Supervisor View</div>
</div>
```

- [ ] **Step 2: Verify**

Take supervisor screenshot. The "SV" circle should now show a people/team SVG icon.

- [ ] **Step 3: Commit**
```bash
git add app/supervisor/components/SupervisorNav.tsx
git commit -m "fix: replace SV placeholder text in sidebar avatar with proper SVG icon"
```

---

### Task 2.3: Add date labels to My Performance trend chart

**Files:**
- Modify: `app/my-desk/my-performance/PerformanceClient.tsx:68-74`

**Problem:** The 28-day SVG trend chart has no intermediate x-axis date markers — only "28 วันที่แล้ว" and "วันนี้" at the extremes. Agents can't tell which spike happened on which date.

- [ ] **Step 1: Add 4 evenly-spaced date tick marks below the chart SVG**

In `app/my-desk/my-performance/PerformanceClient.tsx`, the chart SVG and labels section currently renders the trend polyline. After the closing `</svg>` of the trend chart (after the `<polygon>` for area fill), add a label row beneath it.

Find the existing SVG structure and its wrapping div. The chart is rendered as:
```tsx
const w = 600; const h = 80; const pad = 4;
```

After the `</svg>` tag of the trend chart, add tick labels by inserting this block right after:
```tsx
{/* X-axis date labels */}
<div className="flex justify-between px-1 mt-1">
  {[27, 20, 13, 6, 0].map((daysBack) => {
    const d = daysAgo(daysBack);
    const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return (
      <span key={daysBack} className="text-[10px] text-[#C0C0C0]">{label}</span>
    );
  })}
</div>
```

- [ ] **Step 2: Verify**

Take my-performance screenshot. The trend chart should show 5 date labels evenly spaced below it (DD/MM format).

- [ ] **Step 3: Commit**
```bash
git add app/my-desk/my-performance/PerformanceClient.tsx
git commit -m "feat: add date tick labels to 28-day performance trend chart"
```

---

## Phase 3 — Design System Alignment

> Files touched: 2 — aligning colors and constants with the established design system.

---

### Task 3.1: Align GoSell/Hopeful card colors with design system

**Files:**
- Modify: `app/my-desk/add-customer/AddCustomerForm.tsx`

**Problem:** GoSell card uses amber/orange (`border-amber-300`, `bg-amber-50`) and Hopeful uses purple — both are rogue palettes. The design system is `#87DE81` (green) for primary actions and `#58CEE8` (cyan) for secondary.

GoSell is the primary CRM system → green (`#87DE81`). Hopeful is the upsell channel → cyan (`#58CEE8`).

- [ ] **Step 1: Read the GoSell/Hopeful card JSX in AddCustomerForm.tsx**

Read lines 130–230 of `app/my-desk/add-customer/AddCustomerForm.tsx` to locate the exact card markup.

- [ ] **Step 2: Update GoSell card to green design system colors**

Find the GoSell card container (currently with amber/orange border and background). Replace its color classes:
- Border: `border-[#87DE81]/40`
- Background: `bg-[#87DE81]/5`
- Icon container: `bg-[#87DE81]/15`
- Icon stroke/fill: `#3D9B3A`
- Label color: `text-[#3D9B3A]`
- Subtitle: `text-[#87DE81]`

- [ ] **Step 3: Update Hopeful card to cyan design system colors**

Find the Hopeful card container (currently with purple border and background). Replace its color classes:
- Border: `border-[#58CEE8]/40`
- Background: `bg-[#58CEE8]/5`
- Icon container: `bg-[#58CEE8]/15`
- Icon stroke/fill: `#0E8FA8`
- Label color: `text-[#0E8FA8]`
- Subtitle: `text-[#58CEE8]`

- [ ] **Step 4: Verify**

Take add-customer screenshot. Both cards should use the green/cyan design system palette.

- [ ] **Step 5: Commit**
```bash
git add app/my-desk/add-customer/AddCustomerForm.tsx
git commit -m "fix: align GoSell/Hopeful card colors with design system (#87DE81 green / #58CEE8 cyan)"
```

---

### Task 3.2: Fix hardcoded DAILY_TARGET in My Performance

**Files:**
- Modify: `app/my-desk/my-performance/PerformanceClient.tsx:7`
- Modify: `app/my-desk/my-performance/page.tsx`

**Problem:** `const DAILY_TARGET = 80000` is hardcoded in the client component. The actual team target lives in `team_config` via `getDailyTarget()`. An agent whose team target is ฿1,000,000 will always see 0% progress against the wrong ฿80,000 target.

- [ ] **Step 1: Pass the target from the server page**

In `app/my-desk/my-performance/page.tsx`, import and call `getAgentTarget` and `getCurrentUser`:

```tsx
import { getMyData, getCurrentUser, getAgentTarget } from "@/lib/db";
import PerformanceClient from "./PerformanceClient";

export default async function MyPerformancePage() {
  const user = await getCurrentUser();
  const [data, dailyTarget] = await Promise.all([
    user ? getMyData(user.id) : Promise.resolve(null),
    user ? getAgentTarget(user.id) : Promise.resolve(80000),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold text-[#3D3D3D]">My Performance</h1>
        <p className="text-[12px] text-[#8B8E8F] mt-0.5">ผลงานของคุณจาก Supabase</p>
      </div>
      <PerformanceClient data={data} dailyTarget={dailyTarget} />
    </div>
  );
}
```

- [ ] **Step 2: Accept dailyTarget prop in PerformanceClient**

In `app/my-desk/my-performance/PerformanceClient.tsx`, update the component signature and remove the hardcoded constant:

Remove line:
```tsx
const DAILY_TARGET = 80000;
```

Update function signature from:
```tsx
export default function PerformanceClient({ data }: { data: AgentData | null }) {
```
To:
```tsx
export default function PerformanceClient({ data, dailyTarget }: { data: AgentData | null; dailyTarget: number }) {
```

Update the target computation line from:
```tsx
const target = period === "Today" ? DAILY_TARGET : period === "7 Days" ? DAILY_TARGET * 7 : period === "28 Days" ? DAILY_TARGET * 28 : DAILY_TARGET * 30;
```
To:
```tsx
const target = period === "Today" ? dailyTarget : period === "7 Days" ? dailyTarget * 7 : period === "28 Days" ? dailyTarget * 28 : dailyTarget * 30;
```

- [ ] **Step 3: Verify**

Take my-performance screenshot. The "% ถึงเป้า" should now calculate against the real team target (฿1,000,000 for masa).

- [ ] **Step 4: Commit**
```bash
git add app/my-desk/my-performance/page.tsx app/my-desk/my-performance/PerformanceClient.tsx
git commit -m "fix: replace hardcoded DAILY_TARGET with dynamic agent target from DB"
```

---

## Verification Checklist (run after all phases)

```bash
node scripts/screenshot_mydesk.js
```

Then also screenshot war-room and supervisor:
```bash
node -e "
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: true });
  async function shot(url, f) {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto(url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2000);
    await p.screenshot({ path: path.join('D:/tmp_review', f), fullPage: true });
    await p.close();
  }
  await shot('http://localhost:3000/war-room', 'war-room-final.png');
  await shot('http://localhost:3000/supervisor', 'supervisor-final.png');
  await b.close();
})();"
```

| Check | Expected |
|-------|----------|
| Empty states | SVG icons, no emoji |
| Ticker | Alerts spaced out, no back-to-back repeats |
| Supervisor % | Phoom shows "✓ ถึงเป้าแล้ว" badge |
| AI Command | Full text visible, no cut-off |
| Supervisor table | No empty white void below rows |
| Supervisor sidebar | SVG icon in avatar slot, no "SV" text |
| Performance chart | 5 date labels below trend line |
| Add Customer cards | Green + Cyan, no orange/purple |
| Performance % | Calculates against real target |
