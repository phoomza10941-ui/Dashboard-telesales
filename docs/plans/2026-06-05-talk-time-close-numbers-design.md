# Talk Time — "ปิด" (exclude) wrong/mismatched numbers

**Date:** 2026-06-05
**Page:** `/supervisor/talk-time`

## Problem

The talk-time table lists every `localParty` that records calls in each Oreka
account (Gosell / Hopeful). Some rows are numbers that **should not be counted**
in that account — e.g. a number that physically rings in Gosell but belongs to a
Hopeful agent, or a stale/unknown number. Today these inflate the team KPIs
(Talk Time รวมทีม, จำนวนสายรวม, เฉลี่ย/สาย, Agents มีสาย) with no way to remove them.

## Goal

Let a supervisor **close (ปิด)** a specific number in a specific account so it is
excluded from all aggregates, and **reopen (เปิดกลับ)** it later.

## Decisions (confirmed)

1. **Scope** — close is per `(account, ext)`. Closing `+66661316872` in Gosell
   does NOT affect the same number in Hopeful. (matches the "teleการ์ตูน gosell" case)
2. **Persistence** — stored in DB, global for all viewers, applies to **every
   day/month** automatically (a bad number is bad regardless of date).
3. **Display** — closed rows are **hidden** from the main table; a
   "แสดงเบอร์ที่ปิด (n)" toggle reveals them for review / reopen.

## Storage

Reuse the existing `team_config` key/value table (same as oreka labels — no new
table, no migration).

- key: `oreka_closed_<account>_<ext>` (e.g. `oreka_closed_gosell_+66661316872`)
- value: `"1"`
- closing = upsert row; reopening = delete row.

Key parsing: strip the `oreka_closed_` prefix, split on the **first** `_` →
`[account, ext]` (account has no underscore; ext is `+66…`).

## Components

### Data layer — `lib/db.ts` (mirrors `getOrekaLabels`/`setOrekaLabel`)

- `getClosedOrekaExts(): Promise<Set<string>>` — reads `like 'oreka_closed_%'`,
  returns a `Set` of `"<account>:<ext>"` keys.
- `setOrekaClosed(account, ext, closed, userId): Promise<void>` — upsert when
  closing, delete when reopening.

### Server action — `app/actions/config.ts`

- `toggleOrekaClosed(account, ext, closed)` — auth check → `setOrekaClosed` →
  `revalidatePath("/supervisor/talk-time")`.

### Page — `app/supervisor/talk-time/page.tsx`

- Add `getClosedOrekaExts()` to the existing `Promise.all`; pass
  `initialClosed: string[]` to the client.

### Client — `app/supervisor/talk-time/TalkTimeClient.tsx`

- `closed` = `useState(new Set(initialClosed))`; `key(a) = ${a.account}:${a.orekaExt}`.
- Per-row `✕ ปิด` button (shown on hover at the end of the row), optimistic:
  add key → `toggleOrekaClosed(account, ext, true)`; revert on error.
- Main table / KPI cards / tab counts / PDF export operate on rows where
  `!closed.has(key)`.
- `"แสดงเบอร์ที่ปิด (n)"` toggle (hidden when n = 0) expands a greyed section of
  `tabFiltered.filter(a => closed.has(key(a)))` for the current tab, each with a
  `เปิดกลับ` button (optimistic remove → `toggleOrekaClosed(..., false)`).

## Data flow / notes

- Filtering is **client-side only** — the stream API (`/api/talk-time/stream`)
  is unchanged; it still returns all rows, the client hides closed ones.
- `closed` is independent state, so new stream chunks (`setAgents`) don't reset it.
- A closed entry with no matching row on the selected day simply doesn't render;
  the `team_config` row stays harmlessly. `(n)` counts only closed rows present
  in the current data.

## Verification

- Close การ์ตูน in Gosell → row disappears; KPI totals drop by its seconds/calls;
  tab count decrements; "แสดงเบอร์ที่ปิด (1)" appears.
- Reopen → row returns; counts restore.
- Refresh page → still closed (persisted); a `team_config` row
  `oreka_closed_gosell_+66661316872` exists.
- `npx tsc --noEmit` + `npx eslint` pass.
