import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, items, organizerEmail } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }
    if (type && !['timeslot', 'potluck'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabase = createSupabaseAdmin();

    const { data: signup, error: signupError } = await supabase
      .from('signups')
      .insert({
        slug,
        admin_token: adminToken,
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'timeslot',
        organizer_email: organizerEmail?.trim() || null,
      })
      .select()
      .single();

    if (signupError) {
      console.error('Signup creation error:', signupError);
      return NextResponse.json({ error: 'Failed to create signup' }, { status: 500 });
    }

    const itemRows = items.map((item: { label: string; description?: string; capacity?: number; date?: string }, i: number) => ({
      signup_id: signup.id,
      label: item.label.trim(),
      description: item.description?.trim() || null,
      capacity: item.capacity || 1,
      sort_order: i,
      date: item.date || null,
    }));

    const { error: itemsError } = await supabase
      .from('signup_items')
      .insert(itemRows);

    if (itemsError) {
      console.error('Items creation error:', itemsError);
      // Clean up the signup
      await supabase.from('signups').delete().eq('id', signup.id);
      return NextResponse.json({ error: 'Failed to create items' }, { status: 500 });
    }

    return NextResponse.json({
      slug: signup.slug,
      adminToken: signup.admin_token,
      signupId: signup.id,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
