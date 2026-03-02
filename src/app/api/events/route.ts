import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, dateStart, dateEnd, granularity, timeStart, timeEnd, organizerEmail, timezone } = body;

    if (!name || !dateStart || !dateEnd) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        description: description || null,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        granularity: granularity || 'hourly',
        time_start: timeStart ?? 8,
        time_end: timeEnd ?? 22,
        organizer_email: organizerEmail || null,
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
