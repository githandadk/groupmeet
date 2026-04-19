# Group Tools Overhaul — Design Spec

**Date:** 2026-04-19
**Scope:** Rebrand "GroupMeet" to "Group Tools", fix all critical/medium security issues and code-efficiency findings from the 2026-04-18 audit, and add two new tools (Meal Train, Group Poll).

---

## 1. Rebrand: GroupMeet → Group Tools

Display-only rename. Do not touch `package.json` `name`, repo path, or `.vercel/` project link to avoid lockfile/deploy churn.

**Files to update:**
- `src/app/layout.tsx` — `<title>` and meta description.
- `src/app/page.tsx` — header and any in-page brand references.
- `package.json` — `description` field only.
- `README.md` — title and intro paragraph (if file exists).
- `src/lib/email.ts` — email subject prefix and footer signature.

---

## 2. Security Fixes

### S1 — Server-side admin gate (HIGH)

**Problem:** `src/app/event/[slug]/admin/page.tsx:37` and `src/app/signup/[slug]/admin/page.tsx:34` are `'use client'` components that fetch the row including `admin_token` via the anon Supabase client and compare in JS. The token is shipped to anyone with the slug.

**Fix:**
- New helper `src/lib/auth.ts` exporting `requireAdmin(kind: 'event'|'signup'|'mealtrain'|'poll', slug: string, token: string): Promise<Row>`. Uses the service-role client. Returns the row on success; throws `AdminAuthError` on failure.
- Convert each `[slug]/admin/page.tsx` to a Server Component that reads `token` from `searchParams`, calls `requireAdmin(...)`, and renders. On failure, render a 401 page (no row data exposed).
- Interactive admin actions (close, delete, edit) move to API routes that re-validate the token server-side via the same helper — token is never trusted from the client alone.
- All admin API routes accept `{ slug, admin_token, ...payload }` and start with `requireAdmin(...)`.

### S2 — `/api/notify` open relay (HIGH)

**Problem:** `src/app/api/notify/route.ts` accepts a caller-supplied `eventId` with no auth and emails all participants.

**Fix:** Require `admin_token` in the request body for any notify type that fans out to multiple recipients (`time_selected`). Validate it against the resource via `requireAdmin`. For organizer-only notifications (`new_response`, `new_signup_claim`) the trigger remains server-internal — refuse external calls.

### S3 — Atomic claim (HIGH)

**Problem:** `src/app/api/signups/claim/route.ts:30-48` does count → check → insert as separate round-trips. Two concurrent requests can both pass the capacity check.

**Fix:** New SQL migration adds Postgres function `claim_signup_item(p_item_id uuid, p_name text, p_email text)` that:
1. `SELECT capacity FROM signup_items WHERE id = p_item_id FOR UPDATE`.
2. `SELECT count(*) FROM signup_claims WHERE item_id = p_item_id`.
3. If `count >= capacity`, raise `EXCEPTION 'capacity_full'`.
4. Else `INSERT INTO signup_claims ...` and return the new row.

API route calls the RPC, maps `capacity_full` to HTTP 409.

### S4 — Superadmin auth hardening (HIGH)

**Problem:** `src/app/superadmin/page.tsx:80-83` writes raw password to `sessionStorage`. `src/app/api/superadmin/route.ts:8` uses `===`.

**Fix:**
- `POST /api/superadmin/login` — validates password with `crypto.timingSafeEqual` (zero-pad both sides to equal length first). On success sets HTTP-only, `Secure`, `SameSite=Lax` cookie `sa_session=<hmac>` valid 24h. HMAC = `hmac_sha256(SUPERADMIN_SECRET, "sa:" + issued_at)`. Cookie value stores `issued_at|hmac`.
- All superadmin API routes verify cookie before serving data.
- Client page no longer stores anything; on load it calls `/api/superadmin/me` to check session.

### S5 — Service-role fallback (MEDIUM)

**Problem:** `src/lib/supabase/server.ts:7` falls back to anon key if service-role env var is missing.

**Fix:** Throw at module load if `SUPABASE_SERVICE_ROLE_KEY` is absent or empty. Surface a clear error in build/dev logs.

### S6 — PII over the wire (MEDIUM)

**Problem:** `'use client'` pages use `select('*')` on `participants`, leaking `email` and `session_token`.

**Fix:** Replace with explicit column lists. Participant view: `select('id, name')`. Admin view (server-side, after `requireAdmin`): `select('id, name, email')`. Never select `session_token` for any view.

### S7 — Input caps (MEDIUM)

**Problem:** API routes accept unbounded arrays/strings.

**Fix:** Central `src/lib/validation.ts` with helpers:
- `MAX_ITEMS = 200`
- `MAX_LABEL = 200`
- `MAX_DESCRIPTION = 2000`
- `MAX_NAME = 100`
- `MAX_OPTIONS = 10` (poll)

Each create endpoint validates on entry and returns 400 with field-level errors.

### S8 — Admin token in Referer (MEDIUM)

**Problem:** Superadmin page renders `<a href="/event/{slug}/admin?token={token}">`. Token leaks in Referer headers from the destination page.

**Fix:** Move admin token to URL fragment: `/event/{slug}/admin#token={token}`. Update admin pages to read token from `window.location.hash` on mount and immediately replace the URL with `history.replaceState` to scrub it. Server-side admin gate still works because we hand the token in the body of subsequent API calls — the page itself becomes a thin shell that loads admin data via authenticated POST.

(Note: this changes admin pages back to client components for the hash-reading bit, but the data fetch goes through the server-validated API route, so the security model still holds.)

---

## 3. Efficiency Fixes

### E1 — Convert read-only pages to RSC

`src/app/event/[slug]/page.tsx`, `src/app/signup/[slug]/page.tsx`, `src/app/event/[slug]/results/page.tsx` and equivalents currently fetch in `useEffect`. Split into:
- Server Component (`page.tsx`): fetches initial data in parallel via Supabase joins.
- Client Component (`*-interactive.tsx`): receives initial data as props, sets up Realtime subscription for live updates.

Initial paint becomes one round-trip; Realtime stays for live overlap updates.

### E2 — Narrow `select()` in Realtime handlers

In `src/app/event/[slug]/results/page.tsx:49-64`, `src/app/signup/[slug]/page.tsx:93-101`, `src/app/signup/[slug]/admin/page.tsx:73-79`: replace `.select('*')` with the columns the UI consumes.

### E3 — React Fragment keys

`src/components/Heatmap.tsx:173` and `src/components/AvailabilityGrid.tsx:276`: change `<>...</>` (with key on inner div) to `<React.Fragment key={mins}>...</React.Fragment>`.

### E4 — `dates` lookup map

`src/components/AvailabilityGrid.tsx`: `const dateIndex = useMemo(() => new Map(dates.map((d, i) => [d, i])), [dates])`. Replace all `dates.indexOf(...)` calls.

### E5 — `SignupItemList` memoization

`src/components/SignupItemList.tsx`:
- `useMemo` for the sorted/grouped item list (deps: `items`).
- `useMemo` for `claimsByItem: Map<string, SignupClaim[]>` (deps: `claims`). Pass slice to each `ItemCard` instead of letting it filter.

### E6 — Memoize formatted date headers

`src/components/Heatmap.tsx` and `AvailabilityGrid.tsx`: `useMemo` an array of `{ date, label }` instead of constructing `new Date(...)` per cell render.

### E7 — Superadmin counts via RPC

New Postgres function `superadmin_stats()` returning per-event participant counts and per-signup claim counts. Replaces the JS-side counting in `src/app/api/superadmin/route.ts:30-34`.

---

## 4. Tool 5: Meal Train

### Purpose

A signup-sheet preset for organizing meal deliveries to a family in need (new baby, illness, bereavement). Day-level slots (one meal per day), with prominent recipient context.

### Routes

- `/mealtrain/new` — create form
- `/mealtrain/[slug]` — participant view (claim a day)
- `/mealtrain/[slug]/admin` — admin view (close, edit, see all claims)
- `/mealtrain/[slug]/created` — post-creation confirmation with shareable link

### Data model

Reuses existing `signups` and `signup_items` tables with `type='mealtrain'`. Schema additions:

```sql
ALTER TABLE signups
  ADD COLUMN recipient_name text,
  ADD COLUMN dietary_notes text,
  ADD COLUMN dropoff_location text;

ALTER TABLE signups
  DROP CONSTRAINT signups_type_check,
  ADD CONSTRAINT signups_type_check CHECK (type IN ('timeslot','potluck','mealtrain'));
```

`signup_items` rows store one entry per scheduled meal day:
- `label` = formatted date (e.g. "Mon, Apr 27")
- `description` = optional per-day note (e.g. "Family will be home after 5pm")
- `capacity` = 1 (single provider per day) — but configurable in case the family wants both lunch and dinner

### Create form

- Recipient family name (required, ≤100 chars)
- Title (required) — defaults to "Meal Train for {recipient}"
- Dietary notes / allergies (textarea, ≤2000 chars)
- Drop-off location & instructions (textarea, ≤2000 chars)
- Date range (start + end)
- Day selector (checkbox per day in range — let admin skip days the family doesn't need meals)
- Optional: meals-per-day (1 or 2) — capacity per day

Generates one `signup_items` row per selected day.

### Participation page

Top section shows recipient name, dietary notes, drop-off info as a static info card. Below: day-by-day list (reusing `SignupItemList`) where each card shows date + claim button. Claim form asks for name, email, and optional dish description.

### Admin

Same pattern as signup admin: list claims, close mealtrain, delete. Admin URL embeds `admin_token` in fragment per S8.

### Homepage

Add a fourth tile to `src/app/page.tsx`: "Meal Train — coordinate meals for a family in need".

---

## 5. Tool 6: Group Poll (Named, single-select)

### Purpose

Quick decision-making poll. Named voters (accountability), one vote per name, results visible to all in real time.

### Routes

- `/poll/new` — create
- `/poll/[slug]` — vote + see results
- `/poll/[slug]/admin` — admin (close, delete, see voter list)
- `/poll/[slug]/created` — confirmation

### Data model

```sql
CREATE TABLE polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  admin_token text NOT NULL,
  title       text NOT NULL,
  description text,
  closed      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE poll_options (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label     text NOT NULL,
  position  int  NOT NULL
);
CREATE INDEX poll_options_poll_id_idx ON poll_options(poll_id);

CREATE TABLE poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_name  text NOT NULL,
  voter_key   text NOT NULL,           -- lower(trim(voter_name))
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_key)
);
CREATE INDEX poll_votes_poll_id_idx ON poll_votes(poll_id);
```

### Mechanics

- **Create:** Title (required, ≤200), description (optional, ≤2000), 2–10 options (each ≤100 chars).
- **Vote:** Voter enters name (1–60 chars) and selects one option. Server upserts on `(poll_id, voter_key)` so re-submitting changes the vote.
- **Results:** Always visible (count + voter names per option). Real-time via Supabase Realtime on `poll_votes`.
- **Close:** Admin sets `closed=true`. API rejects new/changed votes with 409.
- **Delete:** Admin only, via authenticated API route.

### Rate limiting

Vote endpoint: simple sliding-window limiter, 10 votes/min per IP. Implementation: in-memory `Map<ip, timestamps[]>` in the route handler module (acceptable for single-region serverless; not a hard guarantee but enough to deter casual abuse). Note: this is per-instance, so abuse mitigation is best-effort. If abuse becomes a real problem, swap for Upstash.

### Validation

- Title required, ≤200 chars.
- 2 ≤ options ≤ 10. Each label ≤100 chars, non-empty after trim.
- Voter name ≤60 chars, non-empty after trim.
- Reject votes when `polls.closed = true`.

### Homepage

Fifth tile on `src/app/page.tsx`: "Group Poll — quick decisions for your team".

---

## 6. Build Order

Each phase ships independently and is independently testable:

1. **Rebrand** (smallest, lowest risk)
2. **Security fixes S1–S8** (do as one phase — they share the new `requireAdmin` helper and validation module)
3. **Efficiency fixes E1–E7** (independent of security work, but easier after S1 because pages are already restructured)
4. **Meal Train** (reuses existing signup infra plus new schema migration)
5. **Group Poll** (new tables, new routes, fresh code path)

Each phase ends with: type check + manual smoke test of the affected routes + commit.

---

## 7. Out of Scope

- LOW-severity audit items (slug enumeration rate-limit on reads, Vercel-wide rate limiting beyond the poll endpoint).
- Sentry/analytics integration (suggested in audit but not requested).
- Email digest mode.
- Multi-select / anonymous polls (B variant chosen for v1).
- Renaming the repo, package name, or Vercel project.
- Mobile app, push notifications, calendar integrations beyond existing ICS export.
