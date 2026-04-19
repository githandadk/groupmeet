import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { sendNewResponseEmail, sendTimeSelectedEmail, sendNewClaimEmail } from '@/lib/email';
import { requireAdmin, AdminAuthError } from '@/lib/auth';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
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
  if (ipBuckets.size > 1000) {
    ipBuckets.forEach((v, k) => {
      const filtered = v.filter((t: number) => now - t < RATE_WINDOW_MS);
      if (filtered.length === 0) ipBuckets.delete(k); else ipBuckets.set(k, filtered);
    });
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
  if (!rateLimit(getClientIp(request))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }
  try {
    const body = await request.json();
    const supabaseAdmin = createSupabaseAdmin();

    if (body.type === 'new_response') {
      // Rate-limited; recipient comes from server-side row lookup so this cannot be
      // used to send arbitrary content to arbitrary addresses.
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
      const { signupId, itemId, participantName } = body;

      const { data: signup } = await supabaseAdmin
        .from('signups')
        .select('slug, name, organizer_email')
        .eq('id', signupId)
        .single();

      if (!signup?.organizer_email) {
        return NextResponse.json({ ok: true });
      }

      let itemLabel = 'an item';
      if (itemId) {
        const { data: item } = await supabaseAdmin
          .from('signup_items')
          .select('label')
          .eq('id', itemId)
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
