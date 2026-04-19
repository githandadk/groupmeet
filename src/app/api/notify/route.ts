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
