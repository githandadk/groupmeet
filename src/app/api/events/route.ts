import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import { LIMITS, requireString, optionalString, optionalEmail, validationErrorResponse } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let name: string, description: string | null, organizerEmail: string | null;
    try {
      name = requireString('name', body.name, LIMITS.NAME);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      organizerEmail = optionalEmail('organizerEmail', body.organizerEmail);
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const { dateStart, dateEnd, granularity, timeStart, timeEnd, timezone } = body;
    if (!dateStart || !dateEnd) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
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
        description,
        date_range_start: dateStart,
        date_range_end: dateEnd,
        granularity: granularity || 'hourly',
        time_start: timeStart ?? 8,
        time_end: timeEnd ?? 22,
        organizer_email: organizerEmail,
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
