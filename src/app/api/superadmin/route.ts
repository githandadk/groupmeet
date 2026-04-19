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
