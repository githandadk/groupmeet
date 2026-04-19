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
