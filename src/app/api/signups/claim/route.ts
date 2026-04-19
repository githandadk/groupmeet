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

      const { data: claim, error: claimError } = await supabase.rpc('claim_signup_item', {
        p_item_id: itemId,
        p_signup_id: signupId,
        p_participant_name: participantName.trim().slice(0, 100),
        p_participant_email: (participantEmail?.trim() || null),
        p_session_token: sessionToken,
      });

      if (claimError) {
        const msg = claimError.message || '';
        if (msg.includes('capacity_full')) {
          return NextResponse.json({ error: 'This item is full' }, { status: 409 });
        }
        if (msg.includes('already_claimed')) {
          return NextResponse.json({ error: 'You already claimed this item' }, { status: 409 });
        }
        if (msg.includes('item_not_found')) {
          return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }
        console.error('Claim error:', claimError);
        return NextResponse.json({ error: 'Failed to claim' }, { status: 500 });
      }

      // Notify organizer in background
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        fetch(`${appUrl}/api/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_signup_claim',
            signupId,
            itemId,
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
