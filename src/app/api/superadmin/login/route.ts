import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, issueSessionCookie, clearSessionCookie } from '@/lib/superadmin-session';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
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
    const body = await request.json();
    if (body.action === 'logout') {
      await clearSessionCookie();
      return NextResponse.json({ ok: true });
    }

    if (!rateLimit(getClientIp(request))) {
      return NextResponse.json({ error: 'Too many attempts — please wait' }, { status: 429 });
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
