# Fix: Number Formatting & Overflow Hardening

## Goal
Money values currently break in two ways:
1. **Ad-hoc formatters** (`fmtK`, `(x/1000).toFixed(1)+"K"`) only handle up to millions. Large values render as garbage strings like `฿100000000042533.5K` and `฿100000000000000000.0K`.
2. **No input cap** on Add Customer sale fields, so absurd values get into the DB and **overflow KPI bars** (War Room top bar and My Desk sticky bar), wrapping/breaking the layout.

Fix = one shared formatter used everywhere + overflow-safe KPI rendering + input validation. **Quality only — do not change business logic, calculations, colors, or layout structure.**

## Constraints
- This is **Next.js 16** (App Router, `proxy.ts` not `middleware.ts`). Read `node_modules/next/dist/docs/` if unsure about an API. Do NOT introduce new deps.
- Match the existing design system exactly (colors, font sizes, Tailwind utility style). See `CLAUDE.md` → Design System.
- TypeScript strict. After changes run `npx tsc --noEmit` and `npm run lint` — both must pass clean.
- Keep diffs minimal and surgical. Do not reformat untouched code.

---

## Step 1 — Create the shared formatter

Create **`lib/format.ts`**:

```ts
// Shared number/money formatters. Use these everywhere instead of ad-hoc
// `(x/1000).toFixed(1)+"K"` or local `fmtK` helpers.

/** Round to 1 decimal, drop a trailing ".0" (e.g. 1.2K, 3K, 12.5M). */
function trim1(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

/**
 * Compact number for dense KPI/chart contexts.
 * 0, 950, 12.3K, 1.2M, 3.4B, 1.1T. Handles values of any magnitude.
 * No currency symbol — callers prefix ฿ themselves where needed.
 */
export function fmtCompact(val: number): string {
  if (!Number.isFinite(val)) return "0";
  const sign = val < 0 ? "-" : "";
  const n = Math.abs(val);
  if (n < 1000) return sign + Math.round(n).toLocaleString();
  if (n < 1_000_000) return `${sign}${trim1(n / 1_000)}K`;
  if (n < 1_000_000_000) return `${sign}${trim1(n / 1_000_000)}M`;
  if (n < 1_000_000_000_000) return `${sign}${trim1(n / 1_000_000_000)}B`;
  return `${sign}${trim1(n / 1_000_000_000_000)}T`;
}

/** Compact Baht with the ฿ prefix: ฿12.3K, ฿1.2M. */
export function fmtBahtCompact(val: number): string {
  return `฿${fmtCompact(val)}`;
}

/** Full Baht with thousands separators, for tooltips/forms: ฿1,234,567. */
export function fmtBaht(val: number): string {
  if (!Number.isFinite(val)) return "฿0";
  return `฿${Math.round(val).toLocaleString()}`;
}

/** Percentage display with a sane cap so 999%+ never shows a meaningless number. */
export function fmtPct(val: number, cap = 999): string {
  return val > cap ? `${cap}+%` : `${val}%`;
}
```

---

## Step 2 — Replace `fmtK` in War Room

File: **`app/war-room/page.tsx`**
- Delete the local `fmtK` function (around lines 22–27).
- Add `import { fmtCompact, fmtPct } from "@/lib/format";` near the other imports.
- Replace every call `fmtK(...)` with `fmtCompact(...)` (there are calls around lines 376 and 407 inside the pace chart, plus any others — search the whole file for `fmtK(` and replace all).
- The team `% เป้า` value is capped at `999` via `Math.min(...)` (around line 112). Where that capped value is **rendered** as `{teamPct}%`, change the displayed string to `fmtPct(teamPct)` so it shows `999+%` instead of `999%`. (Only change the display, not the calculation.)

## Step 3 — Replace ad-hoc `/1000 .toFixed(1)+"K"` in My Performance

File: **`app/my-desk/my-performance/PerformanceClient.tsx`**
- Add `import { fmtCompact, fmtPct } from "@/lib/format";` at top.
- Lines ~96–101, the MetricCard values. Replace:
  - `฿${(totalSales/1000).toFixed(1)}K` → `${fmtBahtCompact(totalSales)}` (import `fmtBahtCompact` too, or use `` `฿${fmtCompact(totalSales)}` ``)
  - same pattern for `totalPhoneClose`, `totalUpsell`, `totalCrm`.
- Line ~118 target label `฿${(target/1000).toFixed(0)}K` → `${fmtBahtCompact(target)}`.
- Line ~126 `สูงสุด ฿{maxVal.toLocaleString()}` → keep full (it's fine) OR use `fmtBaht(maxVal)`. Prefer `fmtBaht(maxVal)` for consistency.
- The `% ถึงเป้า` MetricCard is already `Math.min(...,100)` capped, leave as is (`{pct}%`).

## Step 4 — Overflow-safe KPI bars

These bars have fixed heights and many columns; long values must never wrap or push siblings.

File: **`app/my-desk/components/StickyKpiBar.tsx`**
- Add `import { fmtBahtCompact, fmtBaht, fmtPct } from "@/lib/format";`.
- For the money KPIs (`ยอดวันนี้`, `เป้าส่วนตัว/เป้าทีม`, `เหลืออีก`, `AOV`), pass the **compact** value as the display and the **full** value as a tooltip. Update `KpiItem` to accept an optional `title` prop and render it on the value `<div title={title}>`:
  - `value={fmtBahtCompact(sales)}` `title={fmtBaht(sales)}`
  - `value={fmtBahtCompact(dailyTarget)}` `title={fmtBaht(dailyTarget)}`
  - `value={fmtBahtCompact(gap)}` `title={fmtBaht(gap)}`
  - AOV: `value={aov > 0 ? fmtBahtCompact(aov) : "—"}` `title={aov > 0 ? fmtBaht(aov) : undefined}`
- In `KpiItem`, harden the value element: add classes `tabular-nums whitespace-nowrap` to the value `<div>` and keep it from stretching the bar. The monthly sub-line (`฿{monthlySales} / ฿{monthlyTarget}`) → use `fmtBahtCompact` for both, wrap in `whitespace-nowrap`.

File: **`app/war-room/page.tsx`**
- The top KPI scoreboard cards already use `tabular-nums` (line ~314). Ensure each big money value uses `fmtCompact` (Step 2 covers the helper). For any scoreboard value still rendered with `.toLocaleString()` for a money figure (daily target, AOV, forecast, pending value), switch to `fmtCompact` so they can't overflow the card. Add `truncate` to the value container if not already present. Keep the existing `title`/full-value behavior if any.

> Note: The existing polluted test rows in the DB will now render compactly (e.g. `฿110.0T`) instead of breaking the layout. That is the intended outcome — we are hardening display, not deleting data.

## Step 5 — Cap sale-amount inputs (Add Customer)

File: **`app/my-desk/add-customer/AddCustomerForm.tsx`**
- Define a constant near the top: `const MAX_SALE_AMOUNT = 1_000_000;` (one sale-line ceiling; generous for telesales, adjustable later).
- The `SaleInput` component (around line 382) renders `<input type="number" min="0" .../>`. Add `max={MAX_SALE_AMOUNT}` and clamp in its `onChange` so a value above the cap is rejected/clamped (e.g. if `Number(e.target.value) > MAX_SALE_AMOUNT`, set to `String(MAX_SALE_AMOUNT)`; allow empty string). Pass `MAX_SALE_AMOUNT` into `SaleInput` as a prop or reference the module constant — keep it simple.
- In the submit handler, before insert, clamp each of the six amount fields with `Math.min(Math.max(parseFloat(x)||0, 0), MAX_SALE_AMOUNT)` so out-of-range values can never reach the DB even via paste/devtools.
- If a value was clamped, it's fine to silently clamp (no new error UI required), but do not break the existing duplicate-confirm / reset flows.

---

## Out of scope (do NOT do)
- Do not touch calculation logic, status/objection parsing, colors, routing, or auth.
- Do not delete existing DB rows or write migrations.
- Do not refactor unrelated components or "tidy" untouched files.
- Do not add libraries.

## Verification (must all pass before finishing)
1. `npx tsc --noEmit` → no errors.
2. `npm run lint` → no new errors/warnings in touched files.
3. Grep confirms no remaining ad-hoc money formatters: search the repo for `).toFixed(1)}K`, `/1000).toFixed`, and `function fmtK` — there should be none left (except inside `lib/format.ts`).
4. Read back the edited render sites and confirm: every money KPI uses `fmtCompact`/`fmtBahtCompact`, KPI-bar values have `tabular-nums whitespace-nowrap`, and `SaleInput` has a `max`.
5. Report a concise summary of every file changed and the exact lines, plus the output of the tsc + lint runs.
