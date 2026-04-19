import { timingSafeEqual } from 'node:crypto';
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

  // `polls` is added in Phase 3; cast to bypass type narrowing until types are regenerated.
  const { data, error } = await (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table)
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
  // Always run a fixed-size compare to avoid leaking length via short-circuit timing.
  // Pad both inputs to the longer length, run timingSafeEqual, then verify lengths match.
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  const max = Math.max(ab.length, bb.length);
  const padA = Buffer.concat([ab, Buffer.alloc(max - ab.length)]);
  const padB = Buffer.concat([bb, Buffer.alloc(max - bb.length)]);
  return timingSafeEqual(padA, padB) && ab.length === bb.length;
}
