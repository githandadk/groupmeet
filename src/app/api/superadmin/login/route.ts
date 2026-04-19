import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, issueSessionCookie, clearSessionCookie } from '@/lib/superadmin-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'logout') {
      await clearSessionCookie();
      return NextResponse.json({ ok: true });
    }

    const password = String(body.password || '');
    if (!checkPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await issueSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
