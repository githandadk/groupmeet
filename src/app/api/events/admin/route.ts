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
