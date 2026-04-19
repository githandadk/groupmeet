import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateToken } from '@/lib/utils';
import {
  LIMITS, requireString, optionalString, optionalEmail, requireArray,
  requirePositiveInt, validationErrorResponse, ValidationError,
} from '@/lib/validation';

interface ItemInput {
  label?: unknown;
  description?: unknown;
  capacity?: unknown;
  date?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let name: string, description: string | null, organizerEmail: string | null;
    let items: ItemInput[];
    let type: 'timeslot' | 'potluck' | 'mealtrain';
    let recipientName: string | null = null;
    let dietaryNotes: string | null = null;
    let dropoffLocation: string | null = null;

    try {
      name = requireString('name', body.name, LIMITS.NAME);
      description = optionalString('description', body.description, LIMITS.DESCRIPTION);
      organizerEmail = optionalEmail('organizerEmail', body.organizerEmail);
      const rawType = body.type ?? 'timeslot';
      if (!['timeslot', 'potluck', 'mealtrain'].includes(rawType)) {
        throw new ValidationError('type', 'Invalid type');
      }
      type = rawType;
      items = requireArray<ItemInput>('items', body.items, 1, LIMITS.ITEMS);

      if (type === 'mealtrain') {
        recipientName = optionalString('recipientName', body.recipientName, LIMITS.NAME);
        dietaryNotes = optionalString('dietaryNotes', body.dietaryNotes, LIMITS.DESCRIPTION);
        dropoffLocation = optionalString('dropoffLocation', body.dropoffLocation, LIMITS.DESCRIPTION);
      }
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    // Validate each item
    const sanitizedItems: { label: string; description: string | null; capacity: number; date: string | null }[] = [];
    try {
      items.forEach((item, i) => {
        const label = requireString(`items[${i}].label`, item.label, LIMITS.LABEL);
        const desc = optionalString(`items[${i}].description`, item.description, LIMITS.DESCRIPTION);
        const cap = item.capacity === undefined ? 1 : requirePositiveInt(`items[${i}].capacity`, item.capacity, 999);
        const date = optionalString(`items[${i}].date`, item.date, 10);
        sanitizedItems.push({ label, description: desc, capacity: cap, date });
      });
    } catch (e) {
      const v = validationErrorResponse(e);
      if (v) return NextResponse.json(v.body, { status: v.status });
      throw e;
    }

    const slug = generateSlug();
    const adminToken = generateToken();
    const supabase = createSupabaseAdmin();

    const { data: signup, error: signupError } = await supabase
      .from('signups')
      .insert({
        slug,
        admin_token: adminToken,
        name,
        description,
        type,
        organizer_email: organizerEmail,
        recipient_name: recipientName,
        dietary_notes: dietaryNotes,
        dropoff_location: dropoffLocation,
      })
      .select()
      .single();

    if (signupError) {
      console.error('Signup creation error:', signupError);
      return NextResponse.json({ error: 'Failed to create signup' }, { status: 500 });
    }

    const itemRows = sanitizedItems.map((item, i) => ({
      signup_id: signup.id,
      label: item.label,
      description: item.description,
      capacity: item.capacity,
      sort_order: i,
      date: item.date,
    }));

    const { error: itemsError } = await supabase.from('signup_items').insert(itemRows);

    if (itemsError) {
      console.error('Items creation error:', itemsError);
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
