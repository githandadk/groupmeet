import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { sendNewResponseEmail, sendTimeSelectedEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const supabaseAdmin = createSupabaseAdmin();

    if (body.type === 'new_response') {
      const { eventId, participantName } = body;

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (!event?.organizer_email) {
        return NextResponse.json({ ok: true });
      }

      try {
        await sendNewResponseEmail(
          event.organizer_email,
          event.name,
          participantName,
          event.slug
        );
      } catch (emailError) {
        console.error('Email send failed:', emailError);
      }

      return NextResponse.json({ ok: true });
    }

    if (body.type === 'time_selected') {
      const { eventId, slotStart, slotEnd } = body;

      const { data: event } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }

      // Get all participants with emails
      const { data: participants } = await supabaseAdmin
        .from('participants')
        .select('email')
        .eq('event_id', eventId)
        .not('email', 'is', null);

      const emails = new Set<string>();
      participants?.forEach((p) => {
        if (p.email) emails.add(p.email);
      });

      // Also notify organizer
      if (event.organizer_email) {
        emails.add(event.organizer_email);
      }

      // Send emails (don't let individual failures stop the rest)
      const results = await Promise.allSettled(
        Array.from(emails).map((email) =>
          sendTimeSelectedEmail(email, event.name, event.description, slotStart, slotEnd)
        )
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.error(`${failed} email(s) failed to send`);
      }

      return NextResponse.json({ ok: true, sent: emails.size - failed });
    }

    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
