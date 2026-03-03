# Future: Advanced Schedule Customization for Sign-Up Sheets

## Problem
The current "Schedule with dates" feature only supports a contiguous date range with the same time slots repeated every day. This doesn't cover common real-world cases like:
- Volunteer shifts on Mon/Wed/Fri only
- A 3-day event where Day 1 runs 8 AM - 5 PM but Day 2 is only 10 AM - 2 PM
- Weekly recurring signups on specific days

## Proposed Changes

### 1. Non-Sequential Date Selection
Replace the start/end date range picker with a multi-select calendar.

- Render a small month-view calendar in the form
- Users click individual dates to toggle them on/off
- Support shift-click to select a range within the calendar
- Show selected dates as pills below the calendar for quick removal
- Keep the existing date range picker as a "quick fill" shortcut (select range, then deselect unwanted days)
- Cap at 31 selected dates to keep item counts reasonable

**State change:**
```
// Before
dateStart: string
dateEnd: string

// After
selectedDates: string[]   // YYYY-MM-DD[], user-ordered
```

### 2. Per-Day Slot Configuration
Allow each day (or group of days) to have its own time range and granularity.

#### Option A: "Same for all" / "Customize per day" toggle (recommended)
- Default: all selected dates share one time config (current behavior)
- Toggle on: each date gets its own time start, time end, granularity, and capacity
- UI: accordion list of selected dates, each expandable to show time config
- "Apply to all" button to bulk-set from one day's config

#### Option B: Day templates
- User defines named templates (e.g. "Full day", "Half day")
- Assigns a template to each selected date
- Less flexible but simpler UI for many dates

**Recommended: Option A** — more intuitive, no extra naming step.

**State change:**
```
// New
perDayConfig: boolean
dayConfigs: Map<string, {
  timeStart: number
  timeEnd: number
  granularity: 'hourly' | 'half-hour'
  slotCapacity: number
}>
```

### 3. Item Generation Updates
The `generatedItems` memo needs to iterate per-date configs:

```ts
for (const date of selectedDates) {
  const config = perDayConfig ? dayConfigs.get(date) : defaultConfig;
  const slots = getTimeSlots(config.timeStart, config.timeEnd, stepMinutes(config.granularity));
  for (const slotMins of slots) {
    // generate item with date, label, capacity
  }
}
```

Keep the 500-item cap. Show per-day slot counts in the preview.

### 4. UI Layout

```
[ Calendar month view          ]
[ Selected: Mar 3, Mar 5, Mar 7 ]  (pills, x to remove)

[ ] Customize slots per day

  ┌ Mar 3 ──────────────────────┐
  │ 9 AM - 5 PM  | Hourly | 2  │
  └─────────────────────────────┘
  ┌ Mar 5 ──────────────────────┐
  │ 10 AM - 2 PM | 30 Min | 1  │
  └─────────────────────────────┘
  ┌ Mar 7 ──────────────────────┐
  │ 9 AM - 5 PM  | Hourly | 2  │
  └─────────────────────────────┘

Preview: 26 slots across 3 days
```

### 5. Files to Change

| File | Change |
|------|--------|
| `src/app/signup/new/page.tsx` | Replace date range inputs with calendar + per-day config UI |
| `src/lib/utils.ts` | No changes needed (existing helpers cover this) |
| `src/components/SignupItemList.tsx` | No changes needed (already groups by date) |
| API route, DB, types | No changes needed (items are already date-tagged) |

### 6. Dependencies
No new packages strictly required. For the calendar, options:
- **Build a minimal month grid** — keeps bundle small, full control
- **react-day-picker** — lightweight, well-maintained, supports multi-select out of the box

### 7. Migration Path
Fully backward compatible. The current contiguous-range UI becomes a subset of the new multi-select calendar (pre-selecting a range is still one click). No DB or API changes.
