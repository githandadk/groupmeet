import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

function checkAuth(request: NextRequest): boolean {
  const password = request.headers.get('x-admin-password');
  const expected = process.env.SUPERADMIN_PASSWORD;
  if (!expected) return false;
  return password === expected;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const body = await request.json();

  if (body.action === 'list') {
    const { data, error } = await supabase
      .from('events')
      .select('id, slug, admin_token, name, date_range_start, date_range_end, granularity, organizer_email, selected_slot, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get participant counts per event
    const eventIds = (data || []).map((e) => e.id);
    const { data: participants } = await supabase
      .from('participants')
      .select('event_id')
      .in('event_id', eventIds);

    const counts: Record<string, number> = {};
    participants?.forEach((p) => {
      if (p.event_id) {
        counts[p.event_id] = (counts[p.event_id] || 0) + 1;
      }
    });

    const events = (data || []).map((e) => ({
      ...e,
      participant_count: counts[e.id] || 0,
    }));

    return NextResponse.json({ events });
  }

  if (body.action === 'delete') {
    const { eventId } = body;
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    // Cascade deletes participants and availability via FK
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
