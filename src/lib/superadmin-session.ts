import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'sa_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.SUPERADMIN_SECRET;
  if (!secret) {
    throw new Error(
      'SUPERADMIN_SECRET is not set — required for signing superadmin sessions. ' +
      'Generate with `openssl rand -hex 32` and add to env.'
    );
  }
  return secret;
}

function sign(issuedAt: number): string {
  return createHmac('sha256', getSecret()).update(`sa:${issuedAt}`).digest('hex');
}

/** Pad both buffers to equal length and constant-time compare. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkPassword(submitted: string): boolean {
  const expected = process.env.SUPERADMIN_PASSWORD;
  if (!expected) return false;
  // Pad both sides to the longer length so constant-time compare doesn't leak length.
  const max = Math.max(expected.length, submitted.length);
  return safeEqual(submitted.padEnd(max, '\0'), expected.padEnd(max, '\0')) && submitted.length === expected.length;
}

export async function issueSessionCookie() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const value = `${issuedAt}.${sign(issuedAt)}`;
  (await cookies()).set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function isAuthenticated(): Promise<boolean> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie?.value) return false;

  const [issuedAtStr, providedSig] = cookie.value.split('.');
  if (!issuedAtStr || !providedSig) return false;

  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return false;

  // Expiry check
  const ageSeconds = Math.floor(Date.now() / 1000) - issuedAt;
  if (ageSeconds < 0 || ageSeconds > SESSION_TTL_SECONDS) return false;

  // Signature check (constant-time)
  let expectedSig: string;
  try {
    expectedSig = sign(issuedAt);
  } catch {
    return false;
  }
  return safeEqual(providedSig, expectedSig);
}
