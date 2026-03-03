import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, itemId, signupId, participantName, participantEmail, sessionToken, claimId } = body;

    const supabase = createSupabaseAdmin();

    if (action === 'claim') {
      if (!itemId || !signupId || !participantName?.trim() || !sessionToken) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Check item exists and get capacity
      const { data: item, error: itemError } = await supabase
        .from('signup_items')
        .select('id, capacity, signup_id')
        .eq('id', itemId)
        .single();

      if (itemError || !item) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }
      if (item.signup_id !== signupId) {
        return NextResponse.json({ error: 'Item does not belong to this signup' }, { status: 400 });
      }

      // Count existing claims for this item
      const { count } = await supabase
        .from('signup_claims')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', itemId);

      if ((count ?? 0) >= item.capacity) {
        return NextResponse.json({ error: 'This item is full' }, { status: 409 });
      }

      // Check if this session already claimed this item
      const { count: existingCount } = await supabase
        .from('signup_claims')
        .select('id', { count: 'exact', head: true })
        .eq('item_id', itemId)
        .eq('session_token', sessionToken);

      if ((existingCount ?? 0) > 0) {
        return NextResponse.json({ error: 'You already claimed this item' }, { status: 409 });
      }

      const { data: claim, error: claimError } = await supabase
        .from('signup_claims')
        .insert({
          item_id: itemId,
          signup_id: signupId,
          participant_name: participantName.trim(),
          participant_email: participantEmail?.trim() || null,
          session_token: sessionToken,
        })
        .select()
        .single();

      if (claimError) {
        console.error('Claim error:', claimError);
        return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
      }

      // Send notification email in background
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        fetch(`${appUrl}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_signup_claim',
            signupId,
            participantName: participantName.trim(),
          }),
        }).catch(() => {});
      } catch {
        // ignore notification failures
      }

      return NextResponse.json({ claim });
    }

    if (action === 'unclaim') {
      if (!claimId || !sessionToken) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Verify the claim belongs to this session
      const { data: claim } = await supabase
        .from('signup_claims')
        .select('id, session_token')
        .eq('id', claimId)
        .single();

      if (!claim) {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
      }
      if (claim.session_token !== sessionToken) {
        return NextResponse.json({ error: 'Not your claim' }, { status: 403 });
      }

      const { error: deleteError } = await supabase
        .from('signup_claims')
        .delete()
        .eq('id', claimId);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to unclaim' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    // Admin unclaim (uses admin token instead of session token)
    if (action === 'admin_unclaim') {
      if (!claimId || !body.adminToken || !signupId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Verify admin token
      const { data: signup } = await supabase
        .from('signups')
        .select('admin_token')
        .eq('id', signupId)
        .single();

      if (!signup || signup.admin_token !== body.adminToken) {
        return NextResponse.json({ error: 'Invalid admin token' }, { status: 403 });
      }

      const { error: deleteError } = await supabase
        .from('signup_claims')
        .delete()
        .eq('id', claimId);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to remove claim' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
