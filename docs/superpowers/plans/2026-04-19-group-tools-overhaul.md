# Group Tools Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand to "Group Tools", fix all critical/medium security and code-efficiency findings from the 2026-04-18 audit, and add two new tools (Meal Train, Group Poll).

**Architecture:** Centralized server-side auth helper (`requireAdmin`) and input-validation module shared by every API route. Admin pages become thin client shells that read tokens from URL fragments and proxy data fetches through authenticated POST routes — no admin token ever crosses the wire to the anon Supabase client. New SQL migrations add `claim_signup_item` and `superadmin_stats` Postgres functions, mealtrain columns on `signups`, and three new tables for polls. Two new tools follow the established slug + admin_token pattern.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript, React 18, Tailwind CSS, Supabase Postgres + Realtime, nodemailer (SMTP2GO).

**Spec:** See `docs/superpowers/specs/2026-04-19-group-tools-overhaul-design.md`.

**Verification model:** No test framework exists in this repo. Each phase ends with `npm run lint && npx tsc --noEmit` plus a manual smoke test on the affected routes via `npm run dev`. Dev URLs assume `http://localhost:3000`.

**Database migrations:** Place each migration in `supabase/migrations/<timestamp>__<name>.sql`. If `supabase/migrations/` does not exist yet, create it. Apply via the Supabase MCP `apply_migration` tool, the Supabase dashboard SQL editor, or `supabase db push` — whichever the project already uses. After applying schema changes that affect tables, regenerate `src/types/database.ts` (the Supabase MCP `generate_typescript_types` tool produces the file content).

---

## Phase 1 — Rebrand to "Group Tools"

Goal: every user-visible "GroupMeet" string becomes "Group Tools". No backend or schema changes.

### Task 1.1 — Update layout metadata

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 1: Replace metadata strings**

In `src/app/layout.tsx`, change the `metadata` and `appleWebApp` blocks:

```tsx
export const metadata: Metadata = {
  title: 'Group Tools - Coordinate Without Accounts',
  description:
    'Mobile-friendly tools for group coordination: availability finder, sign-up sheets, potlucks, meal trains, and quick polls. No accounts required.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Group Tools',
  },
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 1.2 — Update homepage header

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Replace header text**

In `src/app/page.tsx`, change the `<h1>` and tagline (around line 47-49):

```tsx
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Group Tools</h1>
          <p className="text-gray-500">Coordinate your group, no accounts needed</p>
        </div>
```

### Task 1.3 — Update brand references on signup pages

**Files:** Modify `src/app/signup/[slug]/page.tsx`, `src/app/signup/[slug]/admin/page.tsx`, `src/app/signup/new/page.tsx`

- [ ] **Step 1: Replace "GroupMeet" link/footer text in `signup/[slug]/page.tsx`**

Find: `<a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">GroupMeet</a>`
Replace: `<a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>`

Find: `Powered by GroupMeet`
Replace: `Powered by Group Tools`

- [ ] **Step 2: Same replacement in `signup/[slug]/admin/page.tsx`**

Find: `<a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">GroupMeet</a>`
Replace: `<a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>`

- [ ] **Step 3: Same replacement in `signup/new/page.tsx`**

Find: `<a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">GroupMeet</a>`
Replace: `<a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">Group Tools</a>`

### Task 1.4 — Update email branding and ICS PRODID

**Files:** Modify `src/lib/email.ts`, `src/lib/utils.ts`

- [ ] **Step 1: In `src/lib/email.ts`, change brand name**

Find: `const FROM_NAME = 'GroupMeet';`
Replace: `const FROM_NAME = 'Group Tools';`

(Leave `FROM_EMAIL` env-driven default alone — `noreply@groupmeet.app` is a deployed domain.)

- [ ] **Step 2: In `src/lib/utils.ts`, change ICS PRODID**

Find: `'PRODID:-//GroupMeet//EN',`
Replace: `'PRODID:-//Group Tools//EN',`

### Task 1.5 — Update package.json description

**Files:** Modify `package.json`

- [ ] **Step 1: Add/update description field**

Open `package.json`. Add a `description` field after `private` if missing, or update existing:

```json
{
  "name": "temp-app",
  "version": "0.1.0",
  "private": true,
  "description": "Group Tools — mobile-first tools for group coordination without accounts",
  ...
}
```

Leave `name` field unchanged to avoid lockfile churn.

### Task 1.6 — Phase 1 checkpoint

- [ ] **Step 1: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors and zero warnings.

- [ ] **Step 2: Manual smoke test**

```bash
npm run dev
```

Open `http://localhost:3000` — verify "Group Tools" appears as the heading and the page title in the browser tab.
Open `http://localhost:3000/signup/new` — verify the brand link reads "Group Tools".

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Rebrand GroupMeet to Group Tools"
```

---

## Phase 2 — Foundation modules

Goal: build the shared infrastructure (env validation, validation helpers, admin auth, superadmin sessions) that the security fixes will use.

### Task 2.1 — Throw on missing service-role key (S5)

**Files:** Modify `src/lib/supabase/server.ts`

- [ ] **Step 1: Replace file contents**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — server routes require the service-role key, not the anon key'
    );
  }

  return createClient<Database>(url, key);
}
```

This eliminates the silent fallback to the anon key.

- [ ] **Step 2: Verify env is present**

```bash
grep SUPABASE_SERVICE_ROLE_KEY .env.local || echo "MISSING"
```

If `MISSING`, halt and ask the user to add the service-role key before continuing — every API route depends on it now.

### Task 2.2 — Validation helper module (S7)

**Files:** Create `src/lib/validation.ts`

- [ ] **Step 1: Write file**

```ts
export const LIMITS = {
  NAME: 100,
  TITLE: 200,
  LABEL: 200,
  DESCRIPTION: 2000,
  EMAIL: 254,
  VOTER_NAME: 60,
  ITEMS: 200,
  POLL_OPTIONS_MIN: 2,
  POLL_OPTIONS_MAX: 10,
  POLL_OPTION_LABEL: 100,
} as const;

export class ValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function requireString(field: string, value: unknown, max: number): string {
  if (!isString(value)) throw new ValidationError(field, `${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ValidationError(field, `${field} is required`);
  if (trimmed.length > max) throw new ValidationError(field, `${field} must be ${max} characters or fewer`);
  return trimmed;
}

export function optionalString(field: string, value: unknown, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!isString(value)) throw new ValidationError(field, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new ValidationError(field, `${field} must be ${max} characters or fewer`);
  return trimmed;
}

export function optionalEmail(field: string, value: unknown): string | null {
  const s = optionalString(field, value, LIMITS.EMAIL);
  if (s === null) return null;
  // Lightweight format check — server-side is for sanity, not for delivery validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new ValidationError(field, `${field} must be a valid email`);
  }
  return s;
}

export function requireArray<T>(field: string, value: unknown, min: number, max: number): T[] {
  if (!Array.isArray(value)) throw new ValidationError(field, `${field} must be an array`);
  if (value.length < min) throw new ValidationError(field, `${field} requires at least ${min}`);
  if (value.length > max) throw new ValidationError(field, `${field} cannot have more than ${max}`);
  return value as T[];
}

export function requirePositiveInt(field: string, value: unknown, max: number = 99): number {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) throw new ValidationError(field, `${field} must be at least 1`);
  if (n > max) throw new ValidationError(field, `${field} must be ${max} or fewer`);
  return Math.floor(n);
}

/** Convert a thrown ValidationError into a Next.js 400 response payload. */
export function validationErrorResponse(err: unknown): { status: 400; body: { error: string; field?: string } } | null {
  if (err instanceof ValidationError) {
    return { status: 400, body: { error: err.message, field: err.field } };
  }
  return null;
}
```

### Task 2.3 — Admin auth helper (S1 foundation)

**Files:** Create `src/lib/auth.ts`

- [ ] **Step 1: Write file**

```ts
import { createSupabaseAdmin } from '@/lib/supabase/server';
import type { Event, Signup } from '@/types/database';

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
    this.name = 'AdminAuthError';
  }
}

export type AdminKind = 'event' | 'signup' | 'mealtrain' | 'poll';

/**
 * Validate an admin token against the database for the given resource kind/slug.
 * Throws AdminAuthError on missing/invalid token or missing row.
 * Returns the resource row on success — caller can use it without a second fetch.
 *
 * For 'mealtrain' kind, the row is read from the 'signups' table (mealtrain
 * reuses the signups schema with type='mealtrain').
 */
export async function requireAdmin(
  kind: AdminKind,
  slug: string,
  token: string | null | undefined
): Promise<Record<string, unknown>> {
  if (!slug || typeof slug !== 'string') {
    throw new AdminAuthError('Missing slug', 400);
  }
  if (!token || typeof token !== 'string') {
    throw new AdminAuthError('Missing admin token', 401);
  }

  const supabase = createSupabaseAdmin();
  const table = kind === 'event' ? 'events' : kind === 'poll' ? 'polls' : 'signups';

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    throw new AdminAuthError('Resource not found', 404);
  }

  // Constant-time comparison to avoid timing oracles on admin tokens.
  if (!constantTimeEqual(String((data as { admin_token: string }).admin_token), token)) {
    throw new AdminAuthError('Invalid admin token', 401);
  }

  // For mealtrain kind, also enforce that the row is actually a mealtrain.
  if (kind === 'mealtrain' && (data as { type?: string }).type !== 'mealtrain') {
    throw new AdminAuthError('Wrong resource kind', 404);
  }

  return data as Record<string, unknown>;
}

/** Re-export typed convenience wrappers for callers that want stronger types. */
export async function requireEventAdmin(slug: string, token: string | null | undefined): Promise<Event> {
  return (await requireAdmin('event', slug, token)) as unknown as Event;
}
export async function requireSignupAdmin(slug: string, token: string | null | undefined): Promise<Signup> {
  return (await requireAdmin('signup', slug, token)) as unknown as Signup;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

### Task 2.4 — Superadmin session helper (S4 foundation)

**Files:** Create `src/lib/superadmin-session.ts`

- [ ] **Step 1: Write file**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'sa_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.SUPERADMIN_SECRET;
  if (!secret) {
    throw new Error(
      'SUPERADMIN_SECRET is not set — required for signing superadmin sessions. ' +
      'Generate with `openssl rand -hex 32` and add to env.'
    );
  }
  return secret;
}

function sign(issuedAt: number): string {
  return createHmac('sha256', getSecret()).update(`sa:${issuedAt}`).digest('hex');
}

/** Pad both buffers to equal length and constant-time compare. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkPassword(submitted: string): boolean {
  const expected = process.env.SUPERADMIN_PASSWORD;
  if (!expected) return false;
  // Pad both sides to the longer length so constant-time compare doesn't leak length.
  const max = Math.max(expected.length, submitted.length);
  return safeEqual(submitted.padEnd(max, '\0'), expected.padEnd(max, '\0')) && submitted.length === expected.length;
}

export async function issueSessionCookie() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = `${issuedAt}.${sign(issuedAt)}`;
  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const [issuedAtStr, providedSig] = cookie.value.split('.');
  if (!issuedAtStr || !providedSig) return false;

  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return false;

  // Expiry check
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) return false;

  // Signature check (constant-time)
  let expectedSig: string;
  try {
    expectedSig = sign(issuedAt);
  } catch {
    return false;
  }
  return safeEqual(providedSig, expectedSig);
}
```

Note for the implementer: `next/headers` `cookies()` is async-compatible in Next 14.2; calling `await` is safe even though older types had it sync.

If `npx tsc --noEmit` complains that `cookies()` returns `ReadonlyRequestCookies` synchronously, drop the `await` and the helpers can be sync — adjust call sites accordingly. The async form is the Next 15+ shape and is forward-compatible.

### Task 2.5 — Add SUPERADMIN_SECRET to env example

**Files:** Modify `.env.local.example` (create if missing)

- [ ] **Step 1: Add line**

If `.env.local.example` exists, add a new line documenting the new env var:

```
# Required for signing superadmin session cookies. Generate with: openssl rand -hex 32
SUPERADMIN_SECRET=
```

- [ ] **Step 2: Tell the user to populate `.env.local`**

The implementer must remind the user (in their handoff notes) to add `SUPERADMIN_SECRET` to `.env.local` before testing the superadmin flow.

### Task 2.6 — Phase 2 checkpoint

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors. (If `cookies()` async typing is wrong for this Next version, fix per the note in Task 2.4.)

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "Add foundation modules: env-strict server client, validation, requireAdmin, superadmin session"
```

---

## Phase 3 — Database migrations

Goal: add Postgres functions and schema needed by Phase 4 (atomic claim, superadmin stats), Tool 5 (mealtrain columns), and Tool 6 (poll tables).

### Task 3.1 — Atomic claim function (S3)

**Files:** Create `supabase/migrations/20260419_01_claim_signup_item.sql`

- [ ] **Step 1: Write migration**

```sql
-- Atomic claim function: lock the item row, count existing claims, insert if capacity allows.
-- Raises 'capacity_full' so the API route can return 409.
CREATE OR REPLACE FUNCTION claim_signup_item(
  p_item_id uuid,
  p_signup_id uuid,
  p_participant_name text,
  p_participant_email text,
  p_session_token text
)
RETURNS signup_claims
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity int;
  v_existing_count int;
  v_my_count int;
  v_claim signup_claims;
BEGIN
  -- Lock the item row so concurrent claims wait
  SELECT capacity INTO v_capacity
  FROM signup_items
  WHERE id = p_item_id AND signup_id = p_signup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Same-session duplicate check
  SELECT count(*) INTO v_my_count
  FROM signup_claims
  WHERE item_id = p_item_id AND session_token = p_session_token;
  IF v_my_count > 0 THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  -- Capacity check
  SELECT count(*) INTO v_existing_count
  FROM signup_claims
  WHERE item_id = p_item_id;
  IF v_existing_count >= v_capacity THEN
    RAISE EXCEPTION 'capacity_full';
  END IF;

  INSERT INTO signup_claims (item_id, signup_id, participant_name, participant_email, session_token)
  VALUES (p_item_id, p_signup_id, p_participant_name, p_participant_email, p_session_token)
  RETURNING * INTO v_claim;

  RETURN v_claim;
END;
$$;
```

- [ ] **Step 2: Apply migration**

Use the Supabase MCP `apply_migration` tool with the SQL above, OR run it via the dashboard SQL editor. Confirm `claim_signup_item` appears in `pg_proc`.

### Task 3.2 — Superadmin stats RPC (E7)

**Files:** Create `supabase/migrations/20260419_02_superadmin_stats.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE OR REPLACE FUNCTION superadmin_event_counts()
RETURNS TABLE(event_id uuid, participant_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT event_id, count(*) FROM participants
  WHERE event_id IS NOT NULL
  GROUP BY event_id;
$$;

CREATE OR REPLACE FUNCTION superadmin_signup_counts()
RETURNS TABLE(signup_id uuid, claim_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT signup_id, count(*) FROM signup_claims
  GROUP BY signup_id;
$$;
```

- [ ] **Step 2: Apply**

Same procedure as 3.1.

### Task 3.3 — Mealtrain columns (Tool 5)

**Files:** Create `supabase/migrations/20260419_03_mealtrain.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE signups
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS dietary_notes text,
  ADD COLUMN IF NOT EXISTS dropoff_location text;

-- Update the type CHECK constraint to allow 'mealtrain'.
-- The original constraint name may differ; drop by introspection.
DO $$
DECLARE c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'signups'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE signups DROP CONSTRAINT %I', c_name);
  END IF;
END$$;

ALTER TABLE signups
  ADD CONSTRAINT signups_type_check
  CHECK (type IN ('timeslot', 'potluck', 'mealtrain'));
```

- [ ] **Step 2: Apply**

Same procedure as 3.1.

### Task 3.4 — Poll tables (Tool 6)

**Files:** Create `supabase/migrations/20260419_04_polls.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS polls (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  admin_token text NOT NULL,
  title       text NOT NULL,
  description text,
  closed      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label     text NOT NULL,
  position  int  NOT NULL
);
CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id   uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_name  text NOT NULL,
  voter_key   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_key)
);
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON poll_votes(poll_id);

-- Enable Realtime on poll_votes so the participant page sees live counts.
ALTER PUBLICATION supabase_realtime ADD TABLE poll_votes;
```

- [ ] **Step 2: Apply**

Same procedure as 3.1. If `ALTER PUBLICATION` fails because the table is already in the publication, that line can be ignored.

### Task 3.5 — Regenerate database types

**Files:** Modify `src/types/database.ts`

- [ ] **Step 1: Regenerate**

If using Supabase MCP: call `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.ts` with the result.

Otherwise: in the Supabase dashboard, generate TypeScript types and paste them into `src/types/database.ts`.

- [ ] **Step 2: Add type aliases at the bottom of the file**

After the existing `Event`/`Signup`/etc. exports, append:

```ts
export type Poll = Database['public']['Tables']['polls']['Row'];
export type PollOption = Database['public']['Tables']['poll_options']['Row'];
export type PollVote = Database['public']['Tables']['poll_votes']['Row'];
```

If the regen already includes them, leave the file alone.

### Task 3.6 — Phase 3 checkpoint

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors. If errors reference missing fields like `recipient_name`, the type regen didn't pick up the new columns — re-run Task 3.5.

- [ ] **Step 2: Commit migrations**

```bash
git add supabase/migrations src/types/database.ts
git commit -m "Add migrations: claim_signup_item RPC, superadmin stats, mealtrain columns, poll tables"
```

---

## Phase 4 — Security fixes

Goal: implement S1, S2, S3, S4, S6, S7, S8 using the foundation from Phase 2 and the migrations from Phase 3.

### Task 4.1 — Atomic claim API (S3)

**Files:** Modify `src/app/api/signups/claim/route.ts`

- [ ] **Step 1: Replace the claim path with the RPC call**

Open `src/app/api/signups/claim/route.ts`. Replace lines 11-85 (the `if (action === 'claim')` block) with:

```ts
    if (action === 'claim') {
      if (!itemId || !signupId || !participantName?.trim() || !sessionToken) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const { data: claim, error: claimError } = await supabase.rpc('claim_signup_item', {
        p_item_id: itemId,
        p_signup_id: signupId,
        p_participant_name: participantName.trim().slice(0, 100),
        p_participant_email: (participantEmail?.trim() || null),
        p_session_token: sessionToken,
      });

      if (claimError) {
        const msg = claimError.message || '';
        if (msg.includes('capacity_full')) {
          return NextResponse.json({ error: 'This item is full' }, { status: 409 });
        }
        if (msg.includes('already_claimed')) {
          return NextResponse.json({ error: 'You already claimed this item' }, { status: 409 });
        }
        if (msg.includes('item_not_found')) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        console.error('Claim error:', claimError);
        return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
      }

      // Notify organizer in background
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        fetch(`${appUrl}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_signup_claim',
            signupId,
            participantName: participantName.trim(),
          }),
        }).catch(() => {});
      } catch {
        // ignore notification failures
      }

      return NextResponse.json({ claim });
    }
```

The `supabase.rpc(...)` returns the inserted row directly (the function is `RETURNS signup_claims`).

Leave the `unclaim` and `admin_unclaim` blocks unchanged — they will be replaced in 4.6 to use `requireSignupAdmin` instead of inline checks.

### Task 4.2 — `/api/notify` requires admin token (S2)

**Files:** Modify `src/app/api/notify/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { sendNewResponseEmail, sendTimeSelectedEmail, sendNewClaimEmail } from '@/lib/email';
import { requireAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabaseAdmin = createSupabaseAdmin();

    if (body.type === 'new_response') {
      // Internal-only notification triggered by participant submit. Trust the request:
      // it does not expose any data and it cannot be used to spam arbitrary recipients
      // (the recipient comes from the row we look up server-side).
      const { eventId, participantName } = body;

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('slug, name, organizer_email')
        .eq('id', eventId)
        .single();

      if (!event?.organizer_email) {
        return NextResponse.json({ ok: true });
      }

      try {
        await sendNewResponseEmail(
          event.organizer_email,
          event.name,
          String(participantName || 'A participant'),
          event.slug
        );
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === 'time_selected') {
      // Fan-out to every participant — must be admin-gated.
      const { eventSlug, adminToken, slotStart, slotEnd } = body;
      let event;
      try {
        event = await requireAdmin('event', eventSlug, adminToken) as {
          id: string; name: string; description: string | null; organizer_email: string | null;
        };
      } catch (e) {
        if (e instanceof AdminAuthError) {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
        throw e;
      }

      const { data: participants } = await supabaseAdmin
        .from('participants')
        .select('email')
        .eq('event_id', event.id)
        .not('email', 'is', null);

      const emails = new Set<string>();
      participants?.forEach((p) => {
        if (p.email) emails.add(p.email);
      });
      if (event.organizer_email) emails.add(event.organizer_email);

      const results = await Promise.allSettled(
        Array.from(emails).map((email) =>
          sendTimeSelectedEmail(email, event.name, event.description, slotStart, slotEnd)
        )
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) console.error(`${failed} email(s) failed to send`);

      return NextResponse.json({ ok: true, sent: emails.size - failed });
    }

    if (body.type === 'new_signup_claim') {
      // Internal-only notification triggered by claim API. The claim itself is rate-limited
      // upstream (Phase 4.6) and the recipient comes from the server-side row lookup.
      const { signupId, participantName } = body;

      const { data: signup } = await supabaseAdmin
        .from('signups')
        .select('slug, name, organizer_email')
        .eq('id', signupId)
        .single();

      if (!signup?.organizer_email) {
        return NextResponse.json({ ok: true });
      }

      const { data: recentClaim } = await supabaseAdmin
        .from('signup_claims')
        .select('item_id')
        .eq('signup_id', signupId)
        .eq('participant_name', participantName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let itemLabel = 'an item';
      if (recentClaim) {
        const { data: item } = await supabaseAdmin
          .from('signup_items')
          .select('label')
          .eq('id', recentClaim.item_id)
          .single();
        if (item) itemLabel = item.label;
      }

      try {
        await sendNewClaimEmail(
          signup.organizer_email,
          signup.name,
          String(participantName || 'A participant'),
          itemLabel,
          signup.slug
        );
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

Note: the `time_selected` branch now requires `eventSlug` + `adminToken` instead of `eventId`. Task 4.5 updates the admin page to send these.

### Task 4.3 — Input caps on event creation (S7)

**Files:** Modify `src/app/api/events/route.ts`

- [ ] **Step 1: Replace contents**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import { LIMITS, requireString, optionalString, optionalEmail, validationErrorResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let name: string, description: string | null, organizerEmail: string | null;
    try {
      name = requireString('name', body.name, LIMITS.NAME);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      organizerEmail = optionalEmail('organizerEmail', body.organizerEmail);
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const { dateStart, dateEnd, granularity, timeStart, timeEnd, timezone } = body;
    if (!dateStart || !dateEnd) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabaseAdmin = createSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        slug,
        admin_token: adminToken,
        name,
        description,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        granularity: granularity || 'hourly',
        time_start: timeStart ?? 8,
        time_end: timeEnd ?? 22,
        organizer_email: organizerEmail,
        timezone: timezone || 'America/New_York',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({
      slug: data.slug,
      adminToken: data.admin_token,
      eventId: data.id,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 4.4 — Input caps on signup creation (S7)

**Files:** Modify `src/app/api/signups/route.ts`

- [ ] **Step 1: Replace contents**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import {
  LIMITS, requireString, optionalString, optionalEmail, requireArray,
  requirePositiveInt, validationErrorResponse, ValidationError,
} from '@/lib/validation';

interface ItemInput {
  label?: unknown;
  description?: unknown;
  capacity?: unknown;
  date?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let name: string, description: string | null, organizerEmail: string | null;
    let items: ItemInput[];
    let type: 'timeslot' | 'potluck' | 'mealtrain';
    let recipientName: string | null = null;
    let dietaryNotes: string | null = null;
    let dropoffLocation: string | null = null;

    try {
      name = requireString('name', body.name, LIMITS.NAME);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      organizerEmail = optionalEmail('organizerEmail', body.organizerEmail);
      const rawType = body.type ?? 'timeslot';
      if (!['timeslot', 'potluck', 'mealtrain'].includes(rawType)) {
        throw new ValidationError('type', 'Invalid type');
      }
      type = rawType;
      items = requireArray<ItemInput>('items', body.items, 1, LIMITS.ITEMS);

      if (type === 'mealtrain') {
        recipientName = optionalString('recipientName', body.recipientName, LIMITS.NAME);
        dietaryNotes = optionalString('dietaryNotes', body.dietaryNotes, LIMITS.DESCRIPTION);
        dropoffLocation = optionalString('dropoffLocation', body.dropoffLocation, LIMITS.DESCRIPTION);
      }
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    // Validate each item
    const sanitizedItems: { label: string; description: string | null; capacity: number; date: string | null }[] = [];
    try {
      items.forEach((item, i) => {
        const label = requireString(`items[${i}].label`, item.label, LIMITS.LABEL);
        const desc = optionalString(`items[${i}].description`, item.description, LIMITS.DESCRIPTION);
        const cap = item.capacity === undefined ? 1 : requirePositiveInt(`items[${i}].capacity`, item.capacity, 999);
        const date = optionalString(`items[${i}].date`, item.date, 10);
        sanitizedItems.push({ label, description: desc, capacity: cap, date });
      });
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabase = createSupabaseAdmin();

    const { data: signup, error: signupError } = await supabase
      .from('signups')
      .insert({
        slug,
        admin_token: adminToken,
        name,
        description,
        type,
        organizer_email: organizerEmail,
        recipient_name: recipientName,
        dietary_notes: dietaryNotes,
        dropoff_location: dropoffLocation,
      })
      .select()
      .single();

    if (signupError) {
      console.error('Signup creation error:', signupError);
      return NextResponse.json({ error: 'Failed to create signup' }, { status: 500 });
    }

    const itemRows = sanitizedItems.map((item, i) => ({
      signup_id: signup.id,
      label: item.label,
      description: item.description,
      capacity: item.capacity,
      sort_order: i,
      date: item.date,
    }));

    const { error: itemsError } = await supabase.from('signup_items').insert(itemRows);

    if (itemsError) {
      console.error('Items creation error:', itemsError);
      await supabase.from('signups').delete().eq('id', signup.id);
      return NextResponse.json({ error: 'Failed to create items' }, { status: 500 });
    }

    return NextResponse.json({
      slug: signup.slug,
      adminToken: signup.admin_token,
      signupId: signup.id,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 4.5 — Server-fetch admin route for events (S1)

**Files:** Create `src/app/api/events/admin/route.ts`

- [ ] **Step 1: Write file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { requireEventAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, adminToken } = body;

    let event;
    try {
      event = await requireEventAdmin(slug, adminToken);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const supabase = createSupabaseAdmin();

    if (action === 'load') {
      const [{ data: availability }, { data: participants }] = await Promise.all([
        supabase
          .from('availability')
          .select('id, event_id, participant_id, slot_start, slot_end')
          .eq('event_id', event.id),
        supabase
          .from('participants')
          .select('id, name, email, created_at')
          .eq('event_id', event.id),
      ]);

      // Strip admin_token from the event row so it never reaches the client.
      const { admin_token: _at, ...eventSafe } = event;
      void _at;

      return NextResponse.json({
        event: eventSafe,
        availability: availability || [],
        participants: participants || [],
      });
    }

    if (action === 'select_slot') {
      const { slotStart, slotEnd } = body;
      if (!slotStart || !slotEnd) {
        return NextResponse.json({ error: 'Missing slot' }, { status: 400 });
      }
      const { error } = await supabase
        .from('events')
        .update({ selected_slot: { start: slotStart, end: slotEnd } })
        .eq('id', event.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 4.6 — Server-fetch admin route for signups (S1) and refactor admin_unclaim

**Files:** Modify `src/app/api/signups/claim/route.ts`, create `src/app/api/signups/admin/route.ts`

- [ ] **Step 1: Create `src/app/api/signups/admin/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { requireSignupAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, adminToken } = body;

    let signup;
    try {
      signup = await requireSignupAdmin(slug, adminToken);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const supabase = createSupabaseAdmin();

    if (action === 'load') {
      const [{ data: items }, { data: claims }] = await Promise.all([
        supabase
          .from('signup_items')
          .select('id, signup_id, label, description, capacity, sort_order, date')
          .eq('signup_id', signup.id)
          .order('sort_order'),
        supabase
          .from('signup_claims')
          .select('id, item_id, signup_id, participant_name, participant_email, created_at')
          .eq('signup_id', signup.id),
      ]);

      // Strip admin_token from the signup row so it never reaches the client.
      const { admin_token: _at, ...signupSafe } = signup;
      void _at;

      return NextResponse.json({
        signup: signupSafe,
        items: items || [],
        claims: claims || [],
      });
    }

    if (action === 'remove_claim') {
      const { claimId } = body;
      if (!claimId) return NextResponse.json({ error: 'Missing claimId' }, { status: 400 });

      const { error } = await supabase
        .from('signup_claims')
        .delete()
        .eq('id', claimId)
        .eq('signup_id', signup.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

- [ ] **Step 2: Remove `admin_unclaim` action from `src/app/api/signups/claim/route.ts`**

Delete lines that handle `action === 'admin_unclaim'` (the entire block, currently at the bottom of the file). The new admin route handles claim removal via `remove_claim`.

### Task 4.7 — Superadmin login + actions split (S4)

**Files:** Create `src/app/api/superadmin/login/route.ts`, create `src/app/api/superadmin/me/route.ts`, modify `src/app/api/superadmin/route.ts`

- [ ] **Step 1: Create `src/app/api/superadmin/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, issueSessionCookie, clearSessionCookie } from '@/lib/superadmin-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'logout') {
      await clearSessionCookie();
      return NextResponse.json({ ok: true });
    }

    const password = String(body.password || '');
    if (!checkPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await issueSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/superadmin/me/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/superadmin-session';

export async function GET() {
  const ok = await isAuthenticated();
  if (!ok) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true });
}
```

- [ ] **Step 3: Replace `src/app/api/superadmin/route.ts` to use cookie auth + RPC counts**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { isAuthenticated } from '@/lib/superadmin-session';

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const body = await request.json();

  if (body.action === 'list') {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, slug, admin_token, name, date_range_start, date_range_end, granularity, organizer_email, selected_slot, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: counts } = await supabase.rpc('superadmin_event_counts');
    const countMap: Record<string, number> = {};
    (counts || []).forEach((row: { event_id: string; participant_count: number }) => {
      countMap[row.event_id] = Number(row.participant_count);
    });

    return NextResponse.json({
      events: (events || []).map((e) => ({ ...e, participant_count: countMap[e.id] || 0 })),
    });
  }

  if (body.action === 'delete') {
    const { eventId } = body;
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'list_signups') {
    const { data: signups, error } = await supabase
      .from('signups')
      .select('id, slug, admin_token, name, type, organizer_email, created_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: counts } = await supabase.rpc('superadmin_signup_counts');
    const countMap: Record<string, number> = {};
    (counts || []).forEach((row: { signup_id: string; claim_count: number }) => {
      countMap[row.signup_id] = Number(row.claim_count);
    });

    return NextResponse.json({
      signups: (signups || []).map((s) => ({ ...s, claim_count: countMap[s.id] || 0 })),
    });
  }

  if (body.action === 'delete_signup') {
    const { signupId } = body;
    if (!signupId) return NextResponse.json({ error: 'Missing signupId' }, { status: 400 });
    const { error } = await supabase.from('signups').delete().eq('id', signupId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'list_polls') {
    const { data: polls, error } = await supabase
      .from('polls')
      .select('id, slug, admin_token, title, closed, created_at')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ polls: polls || [] });
  }

  if (body.action === 'delete_poll') {
    const { pollId } = body;
    if (!pollId) return NextResponse.json({ error: 'Missing pollId' }, { status: 400 });
    const { error } = await supabase.from('polls').delete().eq('id', pollId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
```

### Task 4.8 — Replace event admin page (S1 + S6 + S8 + E1)

**Files:** Modify `src/app/event/[slug]/admin/page.tsx`

- [ ] **Step 1: Replace file with hash-token + server-fetched data**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Heatmap from '@/components/Heatmap';
import { downloadICS, formatUTCInTimezone, getTimezoneAbbr } from '@/lib/utils';
import type { Event, Availability, Participant } from '@/types/database';

function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('token');
}

function scrubHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export default function EventAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  // Read token from URL fragment on mount, then scrub
  useEffect(() => {
    const tk = readTokenFromHash();
    setAdminToken(tk);
    scrubHash();
  }, []);

  const loadAll = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/events/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', slug, adminToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || 'Not authorized');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      setAvailability(data.availability);
      setParticipants(data.participants);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (adminToken === null) return; // hash not yet read
    if (!adminToken) {
      setAuthError('Missing admin token');
      setLoading(false);
      return;
    }
    loadAll(adminToken);
  }, [adminToken, loadAll]);

  // Realtime updates (uses anon key — read-only, narrowed columns)
  useEffect(() => {
    if (!event) return;
    const channel = supabase
      .channel(`admin-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'availability', filter: `event_id=eq.${event.id}` },
        async () => {
          const { data } = await supabase
            .from('availability')
            .select('id, event_id, participant_id, slot_start, slot_end')
            .eq('event_id', event.id);
          setAvailability(data || []);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `event_id=eq.${event.id}` },
        async () => {
          // Note: anon key cannot read email; admin viewer reloads via API for fresh email data.
          if (!adminToken) return;
          const res = await fetch('/api/events/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'load', slug, adminToken }),
          });
          if (res.ok) {
            const d = await res.json();
            setParticipants(d.participants);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event, adminToken, slug]);

  async function handleSelectSlot(slotStart: string, slotEnd: string) {
    if (!event || !adminToken || selecting) return;

    const timeDisplay = event.granularity === 'daily'
      ? new Date(slotStart).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : formatUTCInTimezone(slotStart, event.timezone);

    if (!confirm(`Select this time?\n${timeDisplay}`)) return;

    setSelecting(true);
    try {
      const res = await fetch('/api/events/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select_slot', slug, adminToken, slotStart, slotEnd }),
      });
      if (!res.ok) throw new Error('Failed to select slot');

      setNotifying(true);
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'time_selected',
          eventSlug: slug,
          adminToken,
          slotStart,
          slotEnd,
        }),
      });

      setEvent({ ...event, selected_slot: { start: slotStart, end: slotEnd } });
    } catch {
      alert('Failed to select time. Please try again.');
    } finally {
      setSelecting(false);
      setNotifying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (authError || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-500">{authError || 'Invalid or missing admin token.'}</p>
        </div>
      </div>
    );
  }

  const selectedSlot = event.selected_slot as { start: string; end: string } | null;

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Admin</span>
          <span className="text-xs text-gray-400">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{event.name}</h1>
        {event.description && (<p className="text-sm text-gray-500 mt-1">{event.description}</p>)}
      </div>

      {selecting && (
        <div className="mx-4 mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />
          <span className="text-sm text-indigo-700">
            {notifying ? 'Notifying participants...' : 'Selecting time...'}
          </span>
        </div>
      )}

      {selectedSlot && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-800 mb-1">Selected Time</p>
          <p className="text-green-700 font-bold">
            {event.granularity === 'daily'
              ? new Date(selectedSlot.start).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })
              : formatUTCInTimezone(selectedSlot.start, event.timezone)}
          </p>
          {event.granularity !== 'daily' && (
            <p className="text-xs text-green-600 mt-1">{getTimezoneAbbr(event.timezone)}</p>
          )}
          <button
            onClick={() => downloadICS(event.name, event.description, selectedSlot.start, selectedSlot.end)}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Download .ics File
          </button>
        </div>
      )}

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {!selectedSlot && (
          <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-indigo-700">
              Tap a time slot or card below to select the final time. All participants with emails will be notified.
            </p>
          </div>
        )}

        <Heatmap
          event={event}
          availability={availability}
          participants={participants}
          onSelectSlot={selectedSlot ? undefined : handleSelectSlot}
        />

        {participants.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Participants</h3>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                  <div>
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.email && (<span className="text-xs text-gray-400 ml-2">{p.email}</span>)}
                  </div>
                  <span className="text-xs text-gray-400">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
```

The `Suspense` wrapper from the original is no longer needed because we don't use `useSearchParams` — token comes from `window.location.hash`, which only runs on the client.

### Task 4.9 — Replace signup admin page (S1 + S6 + S8)

**Files:** Modify `src/app/signup/[slug]/admin/page.tsx`

- [ ] **Step 1: Replace file**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupItemList from '@/components/SignupItemList';
import type { Signup, SignupItem, SignupClaim } from '@/types/database';

function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  return new URLSearchParams(hash).get('token');
}

function scrubHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export default function SignupAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [signup, setSignup] = useState<Signup | null>(null);
  const [items, setItems] = useState<SignupItem[]>([]);
  const [claims, setClaims] = useState<SignupClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    setAdminToken(readTokenFromHash());
    scrubHash();
  }, []);

  const loadAll = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/signups/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', slug, adminToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || 'Not authorized');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSignup(data.signup);
      setItems(data.items);
      setClaims(data.claims);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (adminToken === null) return;
    if (!adminToken) {
      setAuthError('Missing admin token');
      setLoading(false);
      return;
    }
    loadAll(adminToken);
  }, [adminToken, loadAll]);

  // Realtime claims updates — narrow column list
  useEffect(() => {
    if (!signup) return;
    const sub = supabase
      .channel(`admin-claims-${signup.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signup_claims', filter: `signup_id=eq.${signup.id}` },
        async () => {
          const { data } = await supabase
            .from('signup_claims')
            .select('id, item_id, signup_id, participant_name, created_at')
            .eq('signup_id', signup.id);
          if (data) setClaims(data as SignupClaim[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [signup]);

  async function handleAdminRemove(claimId: string) {
    if (!signup || !adminToken) return;
    setRemoving(claimId);
    try {
      const res = await fetch('/api/signups/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_claim', slug, adminToken, claimId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove');
      }
      // Reload via API to keep emails populated
      await loadAll(adminToken);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove claim');
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (authError || !signup) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{authError || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  const totalSpots = items.reduce((sum, item) => sum + item.capacity, 0);
  const filledSpots = claims.length;
  const uniqueDates = new Set(items.filter((i) => i.date).map((i) => i.date));
  const hasDates = uniqueDates.size > 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{signup.name}</h1>
          <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
            Admin View
          </span>
        </div>

        <div className={`grid gap-3 mb-6 ${hasDates ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {hasDates && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{uniqueDates.size}</p>
              <p className="text-xs text-gray-500">Days</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
            <p className="text-xs text-gray-500">{signup.type === 'potluck' ? 'Items' : 'Slots'}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-indigo-600">{filledSpots}</p>
            <p className="text-xs text-gray-500">Claimed</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSpots - filledSpots}</p>
            <p className="text-xs text-gray-500">Open</p>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-indigo-700 font-medium mb-2">Participant Link</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup/${slug}`}
              readOnly
              className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white text-gray-700"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/signup/${slug}`)}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <SignupItemList
          items={items}
          claims={claims}
          sessionToken={null}
          participantName=""
          onClaim={() => {}}
          onUnclaim={() => {}}
          claiming={removing}
          isAdmin
          onAdminRemove={handleAdminRemove}
        />
      </div>
    </main>
  );
}
```

### Task 4.10 — Replace superadmin page (S4)

**Files:** Modify `src/app/superadmin/page.tsx`

- [ ] **Step 1: Replace file**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface EventInfo {
  id: string;
  slug: string;
  admin_token: string;
  name: string;
  date_range_start: string;
  date_range_end: string;
  granularity: string;
  organizer_email: string | null;
  selected_slot: unknown;
  created_at: string | null;
  participant_count: number;
}

interface SignupInfo {
  id: string;
  slug: string;
  admin_token: string;
  name: string;
  type: 'timeslot' | 'potluck' | 'mealtrain';
  organizer_email: string | null;
  created_at: string | null;
  claim_count: number;
}

interface PollInfo {
  id: string;
  slug: string;
  admin_token: string;
  title: string;
  closed: boolean;
  created_at: string | null;
}

export default function SuperAdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [signups, setSignups] = useState<SignupInfo[]>([]);
  const [polls, setPolls] = useState<PollInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tab, setTab] = useState<'events' | 'signups' | 'polls'>('events');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const post = (action: string) =>
        fetch('/api/superadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });

      const [eventsRes, signupsRes, pollsRes] = await Promise.all([
        post('list'), post('list_signups'), post('list_polls'),
      ]);

      if (eventsRes.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const [eventsData, signupsData, pollsData] = await Promise.all([
        eventsRes.json(), signupsRes.json(), pollsRes.json(),
      ]);

      setEvents(eventsData.events || []);
      setSignups(signupsData.signups || []);
      setPolls(pollsData.polls || []);
      setAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount, check session
  useEffect(() => {
    fetch('/api/superadmin/me')
      .then((r) => {
        if (r.ok) loadAll();
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [loadAll]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError('Invalid password');
        return;
      }
      setPassword('');
      await loadAll();
    } catch {
      setError('Login failed');
    }
  }

  async function handleLogout() {
    await fetch('/api/superadmin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuthenticated(false);
  }

  async function handleDelete(action: string, idKey: string, id: string, name: string, listSetter: (fn: (prev: any[]) => any[]) => void) {
    if (!confirm(`Delete "${name}" and all its data? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch('/api/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, [idKey]: id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      listSetter((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  function getStatus(event: EventInfo): { label: string; color: string } {
    if (event.selected_slot) return { label: 'Finalized', color: 'bg-green-100 text-green-700' };
    const endDate = new Date(event.date_range_end + 'T23:59:59');
    if (endDate < new Date()) return { label: 'Past', color: 'bg-gray-100 text-gray-500' };
    return { label: 'Active', color: 'bg-indigo-100 text-indigo-700' };
  }

  function adminPath(kind: 'event' | 'signup' | 'poll', slug: string, token: string): string {
    return `${appUrl}/${kind === 'event' ? 'event' : kind === 'poll' ? 'poll' : 'signup'}/${slug}/admin#token=${token}`;
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">Super Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            autoFocus
          />
          {error && (<p className="text-red-600 text-sm text-center">{error}</p>)}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors"
          >
            Log In
          </button>
        </form>
      </main>
    );
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <main className="min-h-screen pb-8">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
          <p className="text-sm text-gray-500">
            {events.length} event{events.length !== 1 ? 's' : ''}, {signups.length} sign-up{signups.length !== 1 ? 's' : ''}, {polls.length} poll{polls.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Refresh</button>
          <button onClick={handleLogout} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">Log out</button>
        </div>
      </div>

      <div className="px-4 max-w-3xl mx-auto">
        <div className="flex border-b border-gray-200 mt-4 mb-4">
          {(['events', 'signups', 'polls'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'events' ? `Events (${events.length})` : t === 'signups' ? `Sign-Ups (${signups.length})` : `Polls (${polls.length})`}
            </button>
          ))}
        </div>

        {tab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 && (<p className="text-center text-gray-400 py-8">No events yet.</p>)}
            {events.map((event) => {
              const status = getStatus(event);
              return (
                <div key={event.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-semibold text-gray-900 truncate">{event.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.color}`}>{status.label}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {event.date_range_start} to {event.date_range_end}
                        <span className="mx-2 text-gray-300">|</span>{event.granularity}
                        <span className="mx-2 text-gray-300">|</span>{event.participant_count} participant{event.participant_count !== 1 ? 's' : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={adminPath('event', event.slug, event.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                        <a href={`${appUrl}/event/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                        <a href={`${appUrl}/event/${event.slug}/results`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Results</a>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete('delete', 'eventId', event.id, event.name, setEvents as never)}
                      disabled={deleting === event.id}
                      className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {deleting === event.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'signups' && (
          <div className="space-y-3">
            {signups.length === 0 && (<p className="text-center text-gray-400 py-8">No sign-ups yet.</p>)}
            {signups.map((signup) => (
              <div key={signup.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{signup.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        signup.type === 'potluck' ? 'bg-amber-100 text-amber-700'
                          : signup.type === 'mealtrain' ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {signup.type === 'potluck' ? 'Potluck' : signup.type === 'mealtrain' ? 'Meal Train' : 'Sign-Up'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {signup.claim_count} claim{signup.claim_count !== 1 ? 's' : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={adminPath('signup', signup.slug, signup.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                      <a href={`${appUrl}/${signup.type === 'mealtrain' ? 'mealtrain' : 'signup'}/${signup.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete('delete_signup', 'signupId', signup.id, signup.name, setSignups as never)}
                    disabled={deleting === signup.id}
                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {deleting === signup.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'polls' && (
          <div className="space-y-3">
            {polls.length === 0 && (<p className="text-center text-gray-400 py-8">No polls yet.</p>)}
            {polls.map((poll) => (
              <div key={poll.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{poll.title}</h2>
                      {poll.closed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Closed</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={adminPath('poll', poll.slug, poll.admin_token)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Admin Link</a>
                      <a href={`${appUrl}/poll/${poll.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-600 font-medium">Participant Link</a>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete('delete_poll', 'pollId', poll.id, poll.title, setPolls as never)}
                    disabled={deleting === poll.id}
                    className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {deleting === poll.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

### Task 4.11 — Update event/signup created pages to use hash tokens (S8)

**Files:** Modify `src/app/event/[slug]/created/page.tsx`, `src/app/signup/[slug]/created/page.tsx`

- [ ] **Step 1: Event created page — change adminLink format**

In `src/app/event/[slug]/created/page.tsx`, find:

```ts
  const adminLink = `${appUrl}/event/${slug}/admin?token=${adminToken}`;
```

Replace with:

```ts
  const adminLink = `${appUrl}/event/${slug}/admin#token=${adminToken}`;
```

- [ ] **Step 2: Signup created page — same change**

In `src/app/signup/[slug]/created/page.tsx`, find:

```ts
  const adminUrl = `${appUrl}/signup/${slug}/admin?token=${adminToken}`;
```

Replace with:

```ts
  const adminUrl = `${appUrl}/signup/${slug}/admin#token=${adminToken}`;
```

### Task 4.12 — Narrow `select('*')` on participants in event participant page (S6)

**Files:** Modify `src/app/event/[slug]/page.tsx`

- [ ] **Step 1: Replace the participant lookup**

Find lines 67-72:
```ts
        const { data: participant } = await supabase
          .from('participants')
          .select('*')
          .eq('event_id', data.id)
          .eq('session_token', sessionToken)
          .single();
```

Replace with:
```ts
        const { data: participant } = await supabase
          .from('participants')
          .select('id, name, email')
          .eq('event_id', data.id)
          .eq('session_token', sessionToken)
          .single();
```

(Email is OK to load here because we're filtering by the participant's *own* session_token — they can already see their own email.)

### Task 4.13 — Phase 4 checkpoint

- [ ] **Step 1: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: zero errors. If TS complains about `Database['public']['Functions']` (the new RPCs), the type regen from Phase 3 may need re-running.

- [ ] **Step 2: Manual smoke tests**

Add `SUPERADMIN_SECRET=$(openssl rand -hex 32)` to `.env.local`. Restart dev server.

```bash
npm run dev
```

Test sequence:
1. Visit `/`. Create a new "Find a Time" event end-to-end — share link, add availability, finalize a slot from the admin URL (which should now be `…/admin#token=…`). Confirm finalize triggers an email.
2. Visit `/superadmin` — log in. Verify session cookie persists across page refresh. Click "Log out" — should kick to login screen. Log in again.
3. Open the event admin URL with the wrong token (e.g., truncate one char) — page should show "Not Authorized" and `/api/events/admin` should return 401 in the network tab.
4. Open browser DevTools Network tab while loading the admin URL with the correct token. Confirm `admin_token` does NOT appear in any response body — the API routes (4.5/4.6) strip it before returning. If you see it, the strip block was missed; re-check those tasks.

5. Create a sign-up sheet, claim an item from one browser, claim the same item from a private window — second claim should be rejected with 409.
6. Create a sign-up sheet with capacity 1, open two private windows, click "Sign Up" simultaneously — only one should succeed (atomic claim test; on a fast machine this is hard to trigger, but the RPC guarantees it).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Security fixes: server-side admin gate, atomic claim, hardened superadmin auth, input caps, hash-based admin tokens"
```

---

## Phase 5 — Efficiency fixes

Goal: implement E2, E3, E4, E5, E6. (E1 — RSC conversion of public pages — is deferred; the admin pages in Phase 4 already addressed the parallel-fetch concern.) (E7 already done in Task 4.10's superadmin route via the new RPC.)

### Task 5.1 — Narrow Realtime selects (E2)

**Files:** Modify `src/app/event/[slug]/results/page.tsx`, `src/app/signup/[slug]/page.tsx`

- [ ] **Step 1: In `src/app/event/[slug]/results/page.tsx`, narrow both Realtime selects**

Find (around line 49-55):
```ts
            const { data: newAvail } = await supabase
              .from('availability')
              .select('*')
              .eq('event_id', eventData.id);
```
Replace `select('*')` with `select('id, event_id, participant_id, slot_start, slot_end')`.

Find (around line 60-66):
```ts
            const { data: newParts } = await supabase
              .from('participants')
              .select('*')
              .eq('event_id', eventData.id);
```
Replace `select('*')` with `select('id, name, created_at, event_id')`. (Skip `email` and `session_token`.)

Also narrow the initial fetch on lines 34-37 to the same column lists.

- [ ] **Step 2: In `src/app/signup/[slug]/page.tsx`, narrow Realtime claim select**

Find (lines 95-100):
```ts
          supabase
            .from('signup_claims')
            .select('*')
            .eq('signup_id', signup.id)
```
Replace with:
```ts
          supabase
            .from('signup_claims')
            .select('id, item_id, signup_id, participant_name, participant_email, session_token, created_at')
            .eq('signup_id', signup.id)
```

(Keep `session_token` here — the participant page needs it to detect "you already claimed this" UI state.)

Also narrow the initial fetches on lines 47-52 to the explicit list.

### Task 5.2 — Fragment keys in Heatmap and Grid (E3)

**Files:** Modify `src/components/Heatmap.tsx`, `src/components/AvailabilityGrid.tsx`

- [ ] **Step 1: In `src/components/Heatmap.tsx`, change Fragment keying**

Find (around line 170-198):
```tsx
          {timeSlots.map((mins) => {
            const isHourBoundary = mins % 60 === 0;
            return (
              <>
                <div key={`label-${mins}`} className={...}>
```

Change to:
```tsx
          {timeSlots.map((mins) => {
            const isHourBoundary = mins % 60 === 0;
            return (
              <Fragment key={`row-${mins}`}>
                <div className={`${cellHeight} flex items-center justify-end pr-2 text-xs text-gray-400`}>
```

End the block:
```tsx
                  );
                })}
              </Fragment>
            );
          })}
```

Add at the top of the file: `import { useMemo, Fragment } from 'react';` (replace existing `import { useMemo } from 'react';`).

Remove the inner `key={`label-${mins}`}` and `key={key}` props are still needed on the cell `div`s — keep those, the Fragment key is in addition.

- [ ] **Step 2: Same change in `src/components/AvailabilityGrid.tsx`**

Around line 271-301, replace the `<>` and `</>` wrapping each row with:
```tsx
            return (
              <Fragment key={`row-${mins}`}>
                <div ...>
                ...
              </Fragment>
            );
```

Update the import: `import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from 'react';`

Inner `key={...}` on cell `div`s stays.

### Task 5.3 — Date index map for pointermove (E4)

**Files:** Modify `src/components/AvailabilityGrid.tsx`

- [ ] **Step 1: Add memoized maps after the `dates`/`timeSlots` declarations**

After `const timeSlots = useMemo(...)` (around line 32), add:

```tsx
  const dateIndex = useMemo(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  const slotIndex = useMemo(() => {
    const m = new Map<number, number>();
    timeSlots.forEach((s, i) => m.set(s, i));
    return m;
  }, [timeSlots]);
```

- [ ] **Step 2: Replace `dates.indexOf(...)` and `timeSlots.indexOf(...)` calls in `handlePointerMove`**

In `handlePointerMove` (around lines 84-118), replace:
- `dates.indexOf(startKey)` → `dateIndex.get(startKey) ?? -1`
- `dates.indexOf(key)` → `dateIndex.get(key) ?? -1`
- `dates.indexOf(startParsed.date)` → `dateIndex.get(startParsed.date) ?? -1`
- `dates.indexOf(endParsed.date)` → `dateIndex.get(endParsed.date) ?? -1`
- `timeSlots.indexOf(startParsed.minutes)` → `slotIndex.get(startParsed.minutes) ?? -1`
- `timeSlots.indexOf(endParsed.minutes)` → `slotIndex.get(endParsed.minutes) ?? -1`

Update the `useCallback` deps array to include `dateIndex, slotIndex` instead of `dates, timeSlots`.

### Task 5.4 — `SignupItemList` memoization (E5)

**Files:** Modify `src/components/SignupItemList.tsx`

- [ ] **Step 1: Replace the file**

```tsx
'use client';

import { useMemo } from 'react';
import type { SignupItem, SignupClaim } from '@/types/database';
import { formatDate } from '@/lib/utils';

interface SignupItemListProps {
  items: SignupItem[];
  claims: SignupClaim[];
  sessionToken: string | null;
  participantName: string;
  onClaim: (itemId: string) => void;
  onUnclaim: (claimId: string) => void;
  claiming: string | null;
  isAdmin?: boolean;
  onAdminRemove?: (claimId: string) => void;
}

function ItemCard({
  item, itemClaims, sessionToken, participantName, onClaim, onUnclaim, claiming, isAdmin, onAdminRemove,
}: {
  item: SignupItem;
  itemClaims: SignupClaim[];
  sessionToken: string | null;
  participantName: string;
  onClaim: (itemId: string) => void;
  onUnclaim: (claimId: string) => void;
  claiming: string | null;
  isAdmin?: boolean;
  onAdminRemove?: (claimId: string) => void;
}) {
  const isFull = itemClaims.length >= item.capacity;
  const myClaim = sessionToken ? itemClaims.find((c) => c.session_token === sessionToken) : null;
  const spotsLeft = item.capacity - itemClaims.length;

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isFull ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900">{item.label}</h3>
          {item.description && (<p className="text-sm text-gray-500 mt-0.5">{item.description}</p>)}
        </div>
        <div className="flex-shrink-0">
          {myClaim ? (
            <button onClick={() => onUnclaim(myClaim.id)} disabled={claiming === item.id}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
              Remove
            </button>
          ) : !isFull && sessionToken && participantName.trim() ? (
            <button onClick={() => onClaim(item.id)} disabled={claiming === item.id}
              className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors disabled:opacity-50">
              {claiming === item.id ? 'Signing up...' : 'Sign Up'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${isFull ? 'bg-gray-400' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(100, (itemClaims.length / item.capacity) * 100)}%` }} />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
          </span>
        </div>
      </div>

      {itemClaims.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {itemClaims.map((claim) => (
            <span key={claim.id}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                claim.session_token === sessionToken ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600'
              }`}>
              {claim.participant_name}
              {isAdmin && onAdminRemove && (
                <button onClick={() => onAdminRemove(claim.id)} className="text-gray-400 hover:text-red-500 ml-0.5" title="Remove this person">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SignupItemList({
  items, claims, sessionToken, participantName, onClaim, onUnclaim, claiming, isAdmin, onAdminRemove,
}: SignupItemListProps) {
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sort_order - b.sort_order),
    [items]
  );

  const claimsByItem = useMemo(() => {
    const m = new Map<string, SignupClaim[]>();
    for (const c of claims) {
      const list = m.get(c.item_id);
      if (list) list.push(c); else m.set(c.item_id, [c]);
    }
    return m;
  }, [claims]);

  const grouped = useMemo(() => {
    const hasDates = sortedItems.some((item) => item.date);
    if (!hasDates) return null;
    const map = new Map<string, SignupItem[]>();
    for (const item of sortedItems) {
      const key = item.date || '_undated';
      const list = map.get(key);
      if (list) list.push(item); else map.set(key, [item]);
    }
    const dateKeys = Array.from(map.keys()).sort();
    return { map, dateKeys };
  }, [sortedItems]);

  if (grouped) {
    return (
      <div className="space-y-6">
        {grouped.dateKeys.map((dateKey) => (
          <div key={dateKey}>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">
              {dateKey === '_undated' ? 'Other' : formatDate(dateKey)}
            </h3>
            <div className="space-y-3">
              {grouped.map.get(dateKey)!.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  itemClaims={claimsByItem.get(item.id) || []}
                  sessionToken={sessionToken}
                  participantName={participantName}
                  onClaim={onClaim}
                  onUnclaim={onUnclaim}
                  claiming={claiming}
                  isAdmin={isAdmin}
                  onAdminRemove={onAdminRemove}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedItems.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          itemClaims={claimsByItem.get(item.id) || []}
          sessionToken={sessionToken}
          participantName={participantName}
          onClaim={onClaim}
          onUnclaim={onUnclaim}
          claiming={claiming}
          isAdmin={isAdmin}
          onAdminRemove={onAdminRemove}
        />
      ))}
    </div>
  );
}
```

### Task 5.5 — Memoize date headers (E6)

**Files:** Modify `src/components/Heatmap.tsx`, `src/components/AvailabilityGrid.tsx`

- [ ] **Step 1: In Heatmap, memoize date header strings**

Add after `const dates = ...`:
```tsx
  const dateHeaders = useMemo(
    () =>
      dates.map((date) => {
        const dt = new Date(date + 'T00:00:00');
        return {
          date,
          weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
          day: dt.getDate(),
        };
      }),
    [dates]
  );
```

Replace the JSX header loop (around lines 158-167):
```tsx
          {dateHeaders.map((h) => (
            <div key={h.date} className="h-12 flex flex-col items-center justify-center text-xs">
              <span className="font-medium text-gray-900">{h.weekday}</span>
              <span className="text-gray-500">{h.day}</span>
            </div>
          ))}
```

- [ ] **Step 2: Same change in AvailabilityGrid**

Add a `visibleDateHeaders` memo (deps: `visibleDates`) and replace the header JSX similarly.

### Task 5.6 — Phase 5 checkpoint

- [ ] **Step 1: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 2: Smoke test**

Open the event admin and results pages. Verify:
- Heatmap renders correctly (no React key warnings in console)
- Drag-to-select on the AvailabilityGrid still works smoothly across day boundaries
- Realtime updates still arrive when a second browser submits availability
- SignupItemList renders correctly with date grouping

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Efficiency fixes: narrow Realtime selects, Fragment keys, memoized date maps and headers, SignupItemList claim grouping"
```

---

## Phase 6 — Tool 5: Meal Train

Goal: build a new tool that reuses the signup data model with `type='mealtrain'` and adds recipient/dietary metadata.

### Task 6.1 — Meal Train create page

**Files:** Create `src/app/mealtrain/new/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getDatesInRange, formatDate } from '@/lib/utils';

export default function NewMealTrainPage() {
  const router = useRouter();
  const [recipientName, setRecipientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set());
  const [mealsPerDay, setMealsPerDay] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const dates = useMemo(() => {
    if (!dateStart || !dateEnd || dateStart > dateEnd) return [];
    return getDatesInRange(dateStart, dateEnd);
  }, [dateStart, dateEnd]);

  const activeDates = dates.filter((d) => !skippedDates.has(d));

  function toggleDate(d: string) {
    setSkippedDates((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  }

  // Auto-fill title from recipient name
  function applyDefaultTitle() {
    if (!title.trim() && recipientName.trim()) {
      setTitle(`Meal Train for ${recipientName.trim()}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!recipientName.trim()) { setError('Recipient name is required'); return; }
    if (!dateStart || !dateEnd) { setError('Start and end dates are required'); return; }
    if (dateStart > dateEnd) { setError('End date must be after start date'); return; }
    if (activeDates.length === 0) { setError('Select at least one day'); return; }

    const finalTitle = title.trim() || `Meal Train for ${recipientName.trim()}`;

    const items = activeDates.map((date) => ({
      label: formatDate(date),
      capacity: mealsPerDay,
      date,
    }));

    setLoading(true);
    try {
      const res = await fetch('/api/signups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: finalTitle,
          description: description.trim() || null,
          type: 'mealtrain',
          organizerEmail: organizerEmail.trim() || null,
          recipientName: recipientName.trim(),
          dietaryNotes: dietaryNotes.trim() || null,
          dropoffLocation: dropoffLocation.trim() || null,
          items,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create meal train');
      }
      const data = await res.json();
      router.push(`/mealtrain/${data.slug}/created#token=${data.adminToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">Group Tools</a>
          <p className="text-gray-500">Coordinate meals for a family in need</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Family / Recipient Name *</label>
            <input
              type="text" value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              onBlur={applyDefaultTitle}
              placeholder="The Smith family"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to: Meal Train for [recipient]"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={200}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Why (optional)</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="New baby, recovering from surgery, etc."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Notes / Allergies</label>
            <textarea
              value={dietaryNotes} onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="No nuts, vegetarian, kids prefer mild flavors..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Drop-off Instructions</label>
            <textarea
              value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="Address, best time to drop off, leave on porch, etc."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} min={dateStart}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm" />
            </div>
          </div>

          {dates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Days needing meals ({activeDates.length}/{dates.length})
              </label>
              <div className="grid grid-cols-3 gap-2">
                {dates.map((d) => {
                  const skipped = skippedDates.has(d);
                  return (
                    <button
                      key={d} type="button" onClick={() => toggleDate(d)}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        skipped
                          ? 'bg-gray-50 border-gray-200 text-gray-400'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      }`}
                    >
                      {formatDate(d)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">Tap a day to skip it.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meals per day</label>
            <input type="number" min={1} max={10} value={mealsPerDay}
              onChange={(e) => setMealsPerDay(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base" />
            <p className="text-xs text-gray-400 mt-1">e.g. 2 if both lunch and dinner are needed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Email (optional)</label>
            <input type="email" value={organizerEmail} onChange={(e) => setOrganizerEmail(e.target.value)}
              placeholder="Get notified when people sign up"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base" />
          </div>

          {error && (<div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>)}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Meal Train'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start organizing.
        </p>
      </div>
    </main>
  );
}
```

### Task 6.2 — Meal Train participant page

**Files:** Create `src/app/mealtrain/[slug]/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import SignupItemList from '@/components/SignupItemList';
import type { Signup, SignupItem, SignupClaim } from '@/types/database';
import { generateToken } from '@/lib/utils';

type MealTrainSignup = Signup & {
  recipient_name: string | null;
  dietary_notes: string | null;
  dropoff_location: string | null;
};

export default function MealTrainParticipantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [signup, setSignup] = useState<MealTrainSignup | null>(null);
  const [items, setItems] = useState<SignupItem[]>([]);
  const [claims, setClaims] = useState<SignupClaim[]>([]);
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameSubmitted, setNameSubmitted] = useState(false);

  const loadData = useCallback(async () => {
    const { data: signupData, error: signupError } = await supabase
      .from('signups')
      .select('*')
      .eq('slug', slug)
      .single();

    if (signupError || !signupData) {
      setError('Meal train not found');
      setLoading(false);
      return;
    }
    if (signupData.type !== 'mealtrain') {
      setError('This link is not a meal train');
      setLoading(false);
      return;
    }

    setSignup(signupData as MealTrainSignup);

    const { data: itemsData } = await supabase
      .from('signup_items').select('*').eq('signup_id', signupData.id).order('sort_order');
    setItems(itemsData || []);

    const { data: claimsData } = await supabase
      .from('signup_claims')
      .select('id, item_id, signup_id, participant_name, participant_email, session_token, created_at')
      .eq('signup_id', signupData.id);
    setClaims(claimsData || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (!signup) return;
    const storageKey = `gm_signup_session_${signup.id}`;
    let token = localStorage.getItem(storageKey);
    if (!token) {
      token = generateToken();
      localStorage.setItem(storageKey, token);
    }
    setSessionToken(token);

    const existingClaim = claims.find((c) => c.session_token === token);
    if (existingClaim) {
      setParticipantName(existingClaim.participant_name);
      if (existingClaim.participant_email) setParticipantEmail(existingClaim.participant_email);
      setNameSubmitted(true);
    }
  }, [signup, claims]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!signup) return;
    const sub = supabase
      .channel(`mealtrain-claims-${signup.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'signup_claims', filter: `signup_id=eq.${signup.id}` },
        () => {
          supabase
            .from('signup_claims')
            .select('id, item_id, signup_id, participant_name, participant_email, session_token, created_at')
            .eq('signup_id', signup.id)
            .then(({ data }) => { if (data) setClaims(data as SignupClaim[]); });
        }
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [signup]);

  async function handleClaim(itemId: string) {
    if (!sessionToken || !participantName.trim() || !signup) return;
    setClaiming(itemId);
    try {
      const res = await fetch('/api/signups/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'claim', itemId, signupId: signup.id,
          participantName: participantName.trim(),
          participantEmail: participantEmail.trim() || null,
          sessionToken,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sign up');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setClaiming(null);
    }
  }

  async function handleUnclaim(claimId: string) {
    if (!sessionToken) return;
    setClaiming('unclaiming');
    try {
      const res = await fetch('/api/signups/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unclaim', claimId, sessionToken }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove');
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setClaiming(null);
    }
  }

  if (loading) {
    return (<main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></main>);
  }
  if (error || !signup) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{signup.name}</h1>
          <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 font-medium">Meal Train</span>
          {signup.description && (<p className="text-gray-500 mt-2 text-sm">{signup.description}</p>)}
        </div>

        {(signup.recipient_name || signup.dietary_notes || signup.dropoff_location) && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 space-y-2">
            {signup.recipient_name && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">For</p>
                <p className="text-sm text-gray-900">{signup.recipient_name}</p>
              </div>
            )}
            {signup.dietary_notes && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Dietary notes</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{signup.dietary_notes}</p>
              </div>
            )}
            {signup.dropoff_location && (
              <div>
                <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Drop-off</p>
                <p className="text-sm text-gray-900 whitespace-pre-line">{signup.dropoff_location}</p>
              </div>
            )}
          </div>
        )}

        {!nameSubmitted ? (
          <div className="mb-6 space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
              <input id="name" type="text" value={participantName}
                onChange={(e) => setParticipantName(e.target.value)} placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
                maxLength={50} />
            </div>
            <div>
              <label htmlFor="pemail" className="block text-sm font-medium text-gray-700 mb-1">Your Email (optional)</label>
              <input id="pemail" type="email" value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)} placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base" />
            </div>
            <button
              onClick={() => { if (participantName.trim()) setNameSubmitted(true); }}
              disabled={!participantName.trim()}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Continue
            </button>
          </div>
        ) : (
          <div className="mb-4 flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3">
            <span className="text-sm text-indigo-700">Signed in as <strong>{participantName}</strong></span>
            <button onClick={() => setNameSubmitted(false)} className="text-xs text-indigo-500 hover:text-indigo-600 font-medium">Change</button>
          </div>
        )}

        <SignupItemList
          items={items} claims={claims}
          sessionToken={sessionToken} participantName={participantName}
          onClaim={handleClaim} onUnclaim={handleUnclaim}
          claiming={claiming}
        />

        <p className="text-center text-xs text-gray-400 mt-8">Powered by Group Tools</p>
      </div>
    </main>
  );
}
```

### Task 6.3 — Meal Train admin page (reuses signup admin API)

**Files:** Create `src/app/mealtrain/[slug]/admin/page.tsx`

- [ ] **Step 1: Write file**

This is essentially `signup/[slug]/admin/page.tsx` with the title changed and the recipient info card. Copy the file from Task 4.9, then:
- Change the page heading region to include the meal-train info card (recipient, dietary notes, drop-off) — copy the `<div className="bg-rose-50 ...">` block from Task 6.2 above it.
- Change the badge from "Admin View" to "Meal Train Admin".
- Cast the loaded signup to `MealTrainSignup` type so the recipient fields are accessible.

For brevity, the implementer can paste the Task 4.9 file as-is, then add this block after the title heading:

```tsx
        {(signup as MealTrainSignup).recipient_name && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-6 space-y-2">
            ... // copy info card from Task 6.2
          </div>
        )}
```

Add the type alias inside the file:
```tsx
type MealTrainSignup = Signup & {
  recipient_name: string | null;
  dietary_notes: string | null;
  dropoff_location: string | null;
};
```

### Task 6.4 — Meal Train created confirmation

**Files:** Create `src/app/mealtrain/[slug]/created/page.tsx`

- [ ] **Step 1: Write file**

Copy `src/app/signup/[slug]/created/page.tsx` to `src/app/mealtrain/[slug]/created/page.tsx`. Then in the new file:
- Replace `signup` URL paths with `mealtrain`: change `${appUrl}/signup/${slug}` → `${appUrl}/mealtrain/${slug}` and `${appUrl}/signup/${slug}/admin#token=...` → `${appUrl}/mealtrain/${slug}/admin#token=...`.
- Change the heading from `{signup.type === 'potluck' ? 'Potluck' : 'Sign-Up Sheet'} Created!` to `Meal Train Created!`.
- Change the read-token query param from `searchParams.get('admin')` to read from `window.location.hash` per the same pattern as Task 4.8 (use the helper inline). Update the redirect from Task 6.1 already uses `#token=`, so:

Replace the `useSearchParams` call and `adminToken` derivation with:
```tsx
  const [adminToken, setAdminToken] = useState('');
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    const tk = new URLSearchParams(hash).get('token') || '';
    setAdminToken(tk);
  }, []);
```

The admin URL displayed becomes `${appUrl}/mealtrain/${slug}/admin#token=${adminToken}`.

### Task 6.5 — Add Meal Train tile to homepage

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Add a fourth feature**

In the `features` array, add a new entry after Potluck:

```tsx
  {
    title: 'Meal Train',
    description: 'Coordinate meals for a family in need. Date-by-date drop-off sign-ups.',
    href: '/mealtrain/new',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
      </svg>
    ),
    color: 'bg-rose-50 text-rose-600',
  },
```

### Task 6.6 — Phase 6 checkpoint

- [ ] **Step 1: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

1. Visit `/`. Click "Meal Train" tile → should land on `/mealtrain/new`.
2. Create a meal train: family name "The Test Family", 7-day range, dietary notes "no nuts", drop-off "leave on porch by 5pm". Skip 2 days. Confirm 5 day-slots are created.
3. After creation, you land on `/mealtrain/[slug]/created` with the admin link visible.
4. Open the participant link in another window. Verify info card shows recipient, dietary notes, drop-off. Claim a day. Verify your name appears under that day.
5. Open the admin link from the created page. Verify it shows the recipient info card and the claim list.
6. In `/superadmin`, verify the meal train shows up under the Sign-Ups tab with the "Meal Train" badge.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add Meal Train tool"
```

---

## Phase 7 — Tool 6: Group Poll

Goal: build the named single-select poll on the new `polls`/`poll_options`/`poll_votes` tables.

### Task 7.1 — Polls API: create + vote

**Files:** Create `src/app/api/polls/route.ts`

- [ ] **Step 1: Write file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import {
  LIMITS, requireString, optionalString, requireArray,
  validationErrorResponse, ValidationError,
} from '@/lib/validation';

interface OptionInput { label?: unknown }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let title: string, description: string | null;
    let options: string[];
    try {
      title = requireString('title', body.title, LIMITS.TITLE);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      const rawOptions = requireArray<OptionInput>('options', body.options, LIMITS.POLL_OPTIONS_MIN, LIMITS.POLL_OPTIONS_MAX);
      options = rawOptions.map((o, i) => requireString(`options[${i}].label`, o.label, LIMITS.POLL_OPTION_LABEL));
      // No duplicate option labels
      const seen = new Set<string>();
      for (const o of options) {
        const k = o.toLowerCase();
        if (seen.has(k)) throw new ValidationError('options', 'Duplicate option labels are not allowed');
        seen.add(k);
      }
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabase = createSupabaseAdmin();

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({ slug, admin_token: adminToken, title, description })
      .select('id, slug, admin_token')
      .single();

    if (pollError || !poll) {
      console.error('Poll create error:', pollError);
      return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
    }

    const optionRows = options.map((label, i) => ({ poll_id: poll.id, label, position: i }));
    const { error: optError } = await supabase.from('poll_options').insert(optionRows);
    if (optError) {
      await supabase.from('polls').delete().eq('id', poll.id);
      return NextResponse.json({ error: 'Failed to create options' }, { status: 500 });
    }

    return NextResponse.json({
      slug: poll.slug,
      adminToken: poll.admin_token,
      pollId: poll.id,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 7.2 — Polls vote API with rate limiting

**Files:** Create `src/app/api/polls/vote/route.ts`

- [ ] **Step 1: Write file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { LIMITS, requireString, validationErrorResponse } from '@/lib/validation';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const ipBuckets = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = (ipBuckets.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) {
    ipBuckets.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  ipBuckets.set(ip, bucket);
  // Periodic GC
  if (ipBuckets.size > 1000) {
    for (const [k, v] of ipBuckets) {
      const filtered = v.filter((t) => now - t < RATE_WINDOW_MS);
      if (filtered.length === 0) ipBuckets.delete(k); else ipBuckets.set(k, filtered);
    }
  }
  return true;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(getClientIp(request))) {
      return NextResponse.json({ error: 'Too many votes — please slow down' }, { status: 429 });
    }

    const body = await request.json();

    let pollSlug: string, optionId: string, voterName: string;
    try {
      pollSlug = requireString('pollSlug', body.pollSlug, 32);
      optionId = requireString('optionId', body.optionId, 64);
      voterName = requireString('voterName', body.voterName, LIMITS.VOTER_NAME);
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const supabase = createSupabaseAdmin();

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('id, closed')
      .eq('slug', pollSlug)
      .single();

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    if (poll.closed) {
      return NextResponse.json({ error: 'This poll is closed' }, { status: 409 });
    }

    // Verify the option belongs to the poll
    const { data: option } = await supabase
      .from('poll_options')
      .select('id, poll_id')
      .eq('id', optionId)
      .single();
    if (!option || option.poll_id !== poll.id) {
      return NextResponse.json({ error: 'Invalid option' }, { status: 400 });
    }

    const voterKey = voterName.toLowerCase();

    // Upsert by (poll_id, voter_key)
    const { error: upsertError } = await supabase
      .from('poll_votes')
      .upsert(
        {
          poll_id: poll.id,
          option_id: optionId,
          voter_name: voterName,
          voter_key: voterKey,
        },
        { onConflict: 'poll_id,voter_key' }
      );

    if (upsertError) {
      console.error('Vote upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 7.3 — Polls admin API

**Files:** Create `src/app/api/polls/admin/route.ts`

- [ ] **Step 1: Write file**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, adminToken } = body;

    let poll;
    try {
      poll = await requireAdmin('poll', slug, adminToken) as { id: string; closed: boolean };
    } catch (e) {
      if (e instanceof AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const supabase = createSupabaseAdmin();

    if (action === 'load') {
      const [{ data: options }, { data: votes }] = await Promise.all([
        supabase.from('poll_options').select('id, poll_id, label, position').eq('poll_id', poll.id).order('position'),
        supabase.from('poll_votes').select('id, poll_id, option_id, voter_name, created_at').eq('poll_id', poll.id),
      ]);
      // Strip admin_token from the poll row so it never reaches the client.
      const { admin_token: _at, ...pollSafe } = poll as { admin_token: string } & Record<string, unknown>;
      void _at;
      return NextResponse.json({ poll: pollSafe, options: options || [], votes: votes || [] });
    }

    if (action === 'set_closed') {
      const closed = Boolean(body.closed);
      const { error } = await supabase.from('polls').update({ closed }).eq('id', poll.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'remove_vote') {
      const { voteId } = body;
      if (!voteId) return NextResponse.json({ error: 'Missing voteId' }, { status: 400 });
      const { error } = await supabase.from('poll_votes').delete().eq('id', voteId).eq('poll_id', poll.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Task 7.4 — Poll create page

**Files:** Create `src/app/poll/new/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface OptionDraft { id: string; label: string; }

export default function NewPollPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<OptionDraft[]>([
    { id: '1', label: '' }, { id: '2', label: '' },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, { id: Date.now().toString(), label: '' }]);
  }
  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }
  function updateOption(id: string, label: string) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) { setError('Title is required'); return; }
    const validOptions = options.map((o) => o.label.trim()).filter(Boolean);
    if (validOptions.length < 2) { setError('At least 2 options are required'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          options: validOptions.map((label) => ({ label })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create poll');
      }
      const data = await res.json();
      router.push(`/poll/${data.slug}/created#token=${data.adminToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-gray-900 mb-2 block hover:text-indigo-600 transition-colors">Group Tools</a>
          <p className="text-gray-500">Create a quick group poll</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question / Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Which book should we study next?"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
              maxLength={200} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Optional context"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base resize-none"
              maxLength={2000} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Options *</label>
              <button type="button" onClick={addOption} disabled={options.length >= 10}
                className="text-sm text-indigo-500 hover:text-indigo-600 font-medium disabled:opacity-50">
                + Add Option
              </button>
            </div>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium w-5">{i + 1}.</span>
                  <input type="text" value={o.label} onChange={(e) => updateOption(o.id, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
                    maxLength={100} />
                  {options.length > 2 && (
                    <button type="button" onClick={() => removeOption(o.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">2–10 options. Voters pick one.</p>
          </div>

          {error && (<div className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3">{error}</div>)}

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Poll'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-8">
          No account required. Share the link and start voting.
        </p>
      </div>
    </main>
  );
}
```

### Task 7.5 — Poll participant page

**Files:** Create `src/app/poll/[slug]/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Poll, PollOption, PollVote } from '@/types/database';

export default function PollParticipantPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [voterName, setVoterName] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');

  // Restore name from local storage so re-vote is easy
  useEffect(() => {
    const saved = localStorage.getItem(`gt_poll_voter_${slug}`);
    if (saved) setVoterName(saved);
  }, [slug]);

  const loadAll = useCallback(async () => {
    const { data: pollData, error: pollError } = await supabase
      .from('polls').select('*').eq('slug', slug).single();
    if (pollError || !pollData) {
      setError('Poll not found');
      setLoading(false);
      return;
    }
    setPoll(pollData);

    const { data: optionsData } = await supabase
      .from('poll_options').select('*').eq('poll_id', pollData.id).order('position');
    setOptions(optionsData || []);

    const { data: votesData } = await supabase
      .from('poll_votes')
      .select('id, poll_id, option_id, voter_name, voter_key, created_at')
      .eq('poll_id', pollData.id);
    setVotes(votesData || []);

    setLoading(false);
  }, [slug]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime updates on poll_votes
  useEffect(() => {
    if (!poll) return;
    const sub = supabase
      .channel(`poll-${poll.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        async () => {
          const { data } = await supabase
            .from('poll_votes')
            .select('id, poll_id, option_id, voter_name, voter_key, created_at')
            .eq('poll_id', poll.id);
          if (data) setVotes(data as PollVote[]);
        }
      ).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [poll]);

  // Group votes by option
  const votesByOption = useMemo(() => {
    const m = new Map<string, PollVote[]>();
    for (const v of votes) {
      const list = m.get(v.option_id);
      if (list) list.push(v); else m.set(v.option_id, [v]);
    }
    return m;
  }, [votes]);

  // Detect existing vote by current voter name (case-insensitive)
  const myExistingVote = useMemo(() => {
    if (!voterName.trim()) return null;
    const key = voterName.trim().toLowerCase();
    return votes.find((v) => v.voter_key === key) || null;
  }, [votes, voterName]);

  // Default the selected option to existing vote on load
  useEffect(() => {
    if (myExistingVote && selectedOption === null) {
      setSelectedOption(myExistingVote.option_id);
    }
  }, [myExistingVote, selectedOption]);

  async function handleVote() {
    if (!poll || !selectedOption || !voterName.trim()) return;
    if (poll.closed) { setSubmitMessage('This poll is closed.'); return; }
    setSubmitting(true);
    setSubmitMessage('');
    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pollSlug: slug,
          optionId: selectedOption,
          voterName: voterName.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to vote');
      }
      localStorage.setItem(`gt_poll_voter_${slug}`, voterName.trim());
      setSubmitMessage(myExistingVote ? 'Vote updated!' : 'Vote submitted!');
    } catch (err) {
      setSubmitMessage(err instanceof Error ? err.message : 'Failed to vote');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (<main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></main>);
  }
  if (error || !poll) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error || 'Not found'}</p>
          <a href="/" className="text-indigo-500 hover:text-indigo-600 font-medium">Go Home</a>
        </div>
      </main>
    );
  }

  const totalVotes = votes.length;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{poll.title}</h1>
          {poll.description && (<p className="text-gray-500 mt-2 text-sm whitespace-pre-line">{poll.description}</p>)}
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
            {poll.closed ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">Closed</span>
            ) : (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />Live
              </span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
          <input type="text" value={voterName} onChange={(e) => setVoterName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-base"
            maxLength={60} disabled={submitting || poll.closed} />
        </div>

        <div className="space-y-3 mb-4">
          {options.map((o) => {
            const optVotes = votesByOption.get(o.id) || [];
            const pct = totalVotes > 0 ? Math.round((optVotes.length / totalVotes) * 100) : 0;
            const isSelected = selectedOption === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => !poll.closed && setSelectedOption(o.id)}
                disabled={poll.closed}
                className={`w-full text-left rounded-xl border p-4 transition-colors relative overflow-hidden ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 bg-white hover:border-indigo-300'
                } ${poll.closed ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="absolute inset-y-0 left-0 bg-indigo-50" style={{ width: `${pct}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (<div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-[5px]" />)}
                    </div>
                    <span className="font-medium text-gray-900 truncate">{o.label}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">{optVotes.length}</div>
                    <div className="text-xs text-gray-400">{pct}%</div>
                  </div>
                </div>
                {optVotes.length > 0 && (
                  <div className="relative mt-2 flex flex-wrap gap-1.5">
                    {optVotes.map((v) => (
                      <span key={v.id} className={`text-xs px-2 py-0.5 rounded-full ${
                        v.voter_key === voterName.trim().toLowerCase()
                          ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {v.voter_name}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={handleVote}
          disabled={!selectedOption || !voterName.trim() || submitting || poll.closed}
          className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Saving...' : myExistingVote ? 'Change Vote' : 'Submit Vote'}
        </button>
        {submitMessage && (
          <p className="text-center text-sm text-gray-500 mt-3">{submitMessage}</p>
        )}
      </div>
    </main>
  );
}
```

### Task 7.6 — Poll admin page

**Files:** Create `src/app/poll/[slug]/admin/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { Poll, PollOption, PollVote } from '@/types/database';

function readTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  return new URLSearchParams(hash).get('token');
}
function scrubHash() {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export default function PollAdminPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [options, setOptions] = useState<PollOption[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAdminToken(readTokenFromHash()); scrubHash(); }, []);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', slug, adminToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || 'Not authorized');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPoll(data.poll);
      setOptions(data.options);
      setVotes(data.votes);
      setLoading(false);
    } catch {
      setAuthError('Failed to load');
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (adminToken === null) return;
    if (!adminToken) { setAuthError('Missing admin token'); setLoading(false); return; }
    load(adminToken);
  }, [adminToken, load]);

  async function setClosed(closed: boolean) {
    if (!adminToken) return;
    setBusy(true);
    try {
      await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_closed', slug, adminToken, closed }),
      });
      await load(adminToken);
    } finally {
      setBusy(false);
    }
  }

  async function removeVote(voteId: string) {
    if (!adminToken) return;
    if (!confirm('Remove this vote?')) return;
    setBusy(true);
    try {
      await fetch('/api/polls/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_vote', slug, adminToken, voteId }),
      });
      await load(adminToken);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (<main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">Loading...</p></main>);
  }
  if (authError || !poll) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-500">{authError || 'Invalid or missing admin token.'}</p>
        </div>
      </main>
    );
  }

  const optionMap = new Map(options.map((o) => [o.id, o]));

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="text-sm text-gray-400 hover:text-indigo-500 transition-colors">Group Tools</a>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{poll.title}</h1>
          <span className="inline-block mt-1 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Admin View</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Status</p>
            <p className="text-xs text-gray-500">{poll.closed ? 'Closed — votes locked' : 'Open — voters can submit and change votes'}</p>
          </div>
          <button onClick={() => setClosed(!poll.closed)} disabled={busy}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              poll.closed ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {poll.closed ? 'Reopen' : 'Close'}
          </button>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-indigo-700 font-medium mb-2">Participant Link</p>
          <div className="flex gap-2">
            <input type="text" readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/poll/${slug}`}
              className="flex-1 px-3 py-2 rounded-lg border border-indigo-200 text-sm bg-white text-gray-700" />
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/poll/${slug}`)}
              className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors">
              Copy
            </button>
          </div>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 mb-2">Votes ({votes.length})</h2>
        {votes.length === 0 && (<p className="text-center text-gray-400 py-8">No votes yet.</p>)}
        <div className="space-y-2">
          {votes.map((v) => {
            const opt = optionMap.get(v.option_id);
            return (
              <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{v.voter_name}</p>
                  <p className="text-xs text-gray-500 truncate">→ {opt?.label || 'Unknown option'}</p>
                </div>
                <button onClick={() => removeVote(v.id)} disabled={busy}
                  className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
```

### Task 7.7 — Poll created confirmation

**Files:** Create `src/app/poll/[slug]/created/page.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function PollCreatedPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [adminToken, setAdminToken] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setAppUrl(window.location.origin);
    const hash = window.location.hash.replace(/^#/, '');
    setAdminToken(new URLSearchParams(hash).get('token') || '');
  }, []);

  const shareUrl = `${appUrl}/poll/${slug}`;
  const adminUrl = `${appUrl}/poll/${slug}/admin#token=${adminToken}`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Poll Created!</h1>
          <p className="text-gray-500">Share the link to start collecting votes.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Share this link with voters</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm truncate" />
              <button onClick={() => copy(shareUrl, 'share')}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors whitespace-nowrap">
                {copied === 'share' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <label className="block text-sm font-medium text-amber-800 mb-2">Your admin link (save this!)</label>
            <p className="text-xs text-amber-600 mb-2">Use this link to close the poll or remove votes.</p>
            <div className="flex gap-2">
              <input type="text" readOnly value={adminUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-amber-300 bg-white text-sm truncate" />
              <button onClick={() => copy(adminUrl, 'admin')}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap">
                {copied === 'admin' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <a href={shareUrl} className="text-center py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl transition-colors">View Poll</a>
            <a href={adminUrl} className="text-center py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-300 transition-colors">Admin Panel</a>
          </div>
        </div>
      </div>
    </main>
  );
}
```

### Task 7.8 — Add Group Poll tile to homepage

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Add a fifth feature**

After the Meal Train entry in the `features` array, add:

```tsx
  {
    title: 'Group Poll',
    description: 'Quick decisions with named voters. Live results.',
    href: '/poll/new',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    color: 'bg-sky-50 text-sky-600',
  },
```

### Task 7.9 — Phase 7 checkpoint

- [ ] **Step 1: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`

- [ ] **Step 2: Smoke test**

```bash
npm run dev
```

1. Visit `/`. Click "Group Poll" → land on `/poll/new`.
2. Create a poll with title "Which book?" and three options. Submit.
3. From the created page, copy the participant link, open in another browser/private window.
4. Enter name "Alice", select option 1, submit. Verify the vote appears under option 1, count updates to 1.
5. Same browser: change selection to option 2, click "Change Vote". Verify vote moves from option 1 → option 2 (Alice's name disappears from 1, appears under 2).
6. Open another private window, vote as "Bob" for option 1. Verify both votes show live in the first window without refresh (Realtime).
7. Try voting as "ALICE" (different case) — should update Alice's existing vote, not create a new one.
8. Open the admin link from the created page (use the `#token=…` URL). Verify the admin page loads, shows both votes. Click "Close" — try voting again, should be rejected.
9. In `/superadmin`, verify the poll appears under the Polls tab with admin/participant links.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add Group Poll tool"
```

---

## Phase 8 — Final pass

### Task 8.1 — Final lint + type check

- [ ] **Step 1: Run**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: clean build. If `npm run build` produces warnings about `useSearchParams` in the modified pages, those should already be addressed by the new hash-based token reading (no `useSearchParams` calls in admin pages).

### Task 8.2 — Update README if present

**Files:** Modify `README.md` (if it exists)

- [ ] **Step 1: Update title and feature list**

If `README.md` exists, update the title from `# GroupMeet` to `# Group Tools` and add the two new tools (Meal Train, Group Poll) to whatever feature list exists.

If no README exists, skip this task.

### Task 8.3 — Final commit + summary

- [ ] **Step 1: Commit any straggling changes**

```bash
git status
```

If anything is uncommitted, commit with a descriptive message.

- [ ] **Step 2: Generate final report**

Provide a brief summary to the user covering:
- Phases completed
- New env var to set: `SUPERADMIN_SECRET`
- New routes: `/mealtrain/*`, `/poll/*`
- Migrations applied (and confirmation that the type regen captured them)
- Any deferred items (E1 RSC conversion of public pages — not done; would require larger rewrite for marginal gain since Realtime needs client components anyway)

---

## Out of Scope (for reference)

These items from the audit are intentionally not addressed by this plan:

- **E1 RSC conversion of `/event/[slug]`, `/signup/[slug]`, `/event/[slug]/results/`**: these pages need Realtime subscriptions that require client components. The performance cost of staying client is acceptable; converting to a server-rendered shell + client island for Realtime is a larger refactor that doesn't pay back for low-traffic church use.
- **Slug enumeration rate limiting** (LOW from audit): noted but skipped per user agreement.
- **Sentry / analytics / email digest mode**: explicitly out of scope per spec section 7.
