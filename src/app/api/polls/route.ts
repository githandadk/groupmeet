import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import {
  LIMITS, requireString, optionalString, requireArray,
  validationErrorResponse, ValidationError,
} from '@/lib/validation';

interface OptionInput { label?: unknown }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let title: string, description: string | null;
    let options: string[];
    try {
      title = requireString('title', body.title, LIMITS.TITLE);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      const rawOptions = requireArray<OptionInput>('options', body.options, LIMITS.POLL_OPTIONS_MIN, LIMITS.POLL_OPTIONS_MAX);
      options = rawOptions.map((o, i) => requireString(`options[${i}].label`, o.label, LIMITS.POLL_OPTION_LABEL));
      // No duplicate option labels
      const seen = new Set<string>();
      for (const o of options) {
        const k = o.toLowerCase();
        if (seen.has(k)) throw new ValidationError('options', 'Duplicate option labels are not allowed');
        seen.add(k);
      }
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabase = createSupabaseAdmin();

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert({ slug, admin_token: adminToken, title, description })
      .select('id, slug, admin_token')
      .single();

    if (pollError || !poll) {
      console.error('Poll create error:', pollError);
      return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 });
    }

    const optionRows = options.map((label, i) => ({ poll_id: poll.id, label, position: i }));
    const { error: optError } = await supabase.from('poll_options').insert(optionRows);
    if (optError) {
      await supabase.from('polls').delete().eq('id', poll.id);
      return NextResponse.json({ error: 'Failed to create options' }, { status: 500 });
    }

    return NextResponse.json({
      slug: poll.slug,
      adminToken: poll.admin_token,
      pollId: poll.id,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
