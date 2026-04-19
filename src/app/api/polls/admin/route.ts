import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, adminToken } = body;

    let poll: { id: string; closed: boolean; admin_token: string } & Record<string, unknown>;
    try {
      poll = await requireAdmin('poll', slug, adminToken) as { id: string; closed: boolean; admin_token: string } & Record<string, unknown>;
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
      const { admin_token: _at, ...pollSafe } = poll;
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
