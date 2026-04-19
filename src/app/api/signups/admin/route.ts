import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { requireSignupAdmin, AdminAuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slug, adminToken } = body;

    let signup;
    try {
      signup = await requireSignupAdmin(slug, adminToken);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    const supabase = createSupabaseAdmin();

    if (action === 'load') {
      const [{ data: items }, { data: claims }] = await Promise.all([
        supabase
          .from('signup_items')
          .select('id, signup_id, label, description, capacity, sort_order, date')
          .eq('signup_id', signup.id)
          .order('sort_order'),
        supabase
          .from('signup_claims')
          .select('id, item_id, signup_id, participant_name, participant_email, created_at')
          .eq('signup_id', signup.id),
      ]);

      // Strip admin_token from the signup row so it never reaches the client.
      const { admin_token: _at, ...signupSafe } = signup;
      void _at;

      return NextResponse.json({
        signup: signupSafe,
        items: items || [],
        claims: claims || [],
      });
    }

    if (action === 'remove_claim') {
      const { claimId } = body;
      if (!claimId) return NextResponse.json({ error: 'Missing claimId' }, { status: 400 });

      const { error } = await supabase
        .from('signup_claims')
        .delete()
        .eq('id', claimId)
        .eq('signup_id', signup.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
