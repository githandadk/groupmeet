import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/superadmin-session';

export async function GET() {
  const ok = await isAuthenticated();
  if (!ok) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true });
}
