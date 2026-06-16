# Design.md — Telesales Dashboard Design System

## Colour Palette

| Role | Hex | Usage |
|---|---|---|
| Background (primary) | `#FFFFFF` | Page background, card background |
| Accent green | `#87DE81` | Success states, positive KPIs, active badges, CTA buttons |
| Accent cyan | `#58CEE8` | Info highlights, charts, secondary buttons, links |
| Text / font colour | `#8B8E8F` | All body text, labels, table content |
| Text dark (emphasis) | `#3D3D3D` | Headings, important values |
| Border / divider | `#E8E8E8` | Card borders, table row separators |

## Typography

- Font family: `Inter`, `Segoe UI`, or system sans-serif stack.
- Base font size: `14px`
- Heading scale: `24px` (page title) → `18px` (section) → `16px` (card title) → `14px` (label)
- All text defaults to `#8B8E8F`; headings and KPI values use `#3D3D3D`

## Layout

- Max content width: `1440px`, centred.
- Grid: 12-column grid with `24px` gutter.
- Card padding: `24px`
- Border radius: `12px` for cards, `6px` for buttons/badges.

## Components

### KPI Card
- White background, subtle border `#E8E8E8`, `12px` radius.
- Large number in `#3D3D3D`, label in `#8B8E8F`.
- Positive delta: `#87DE81`. Negative delta: `#FF6B6B`.

### Data Table
- Header row: light grey background (`#F7F7F7`), text `#8B8E8F`, uppercase, `12px`.
- Row border: `1px solid #E8E8E8`.
- Alternating row background optional (`#FAFAFA`).

### Status Badge
- Active / on-call: background `#87DE81`, text white.
- Idle: background `#58CEE8`, text white.
- Break / offline: background `#E8E8E8`, text `#8B8E8F`.

### Progress Bar
- Track: `#E8E8E8`
- Fill: `#87DE81` (on target) or `#58CEE8` (in progress)

### Charts
- Primary series colour: `#87DE81`
- Secondary series colour: `#58CEE8`
- Grid lines: `#E8E8E8`
- Axis labels: `#8B8E8F`

### Sidebar / Navigation
- Background: `#FFFFFF`
- Active item: left border `3px solid #87DE81`, text `#3D3D3D`
- Inactive item: text `#8B8E8F`

## Spacing Scale

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px
