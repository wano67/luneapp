import { SignJWT, jwtVerify } from 'jose';
import { type NextRequest, NextResponse } from 'next/server';
import { hashShareToken, validateShareToken, type ValidatedShareToken } from './validateShareToken';

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

/** Cookie name scoped to the specific share token (no collision between links). */
export function shareCookieName(rawToken: string): string {
  const hash = hashShareToken(rawToken);
  return `share_session_${hash.slice(0, 12)}`;
}

/** Create a share session JWT. Expires in 24h. */
export async function createShareSessionJwt(rawToken: string): Promise<string> {
  const hash = hashShareToken(rawToken);
  return new SignJWT({ th: hash.slice(0, 16) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

/** Verify the share session cookie for a given raw token. */
export async function verifyShareSession(request: NextRequest, rawToken: string): Promise<boolean> {
  const cookieName = shareCookieName(rawToken);
  const cookie = request.cookies.get(cookieName)?.value;
  if (!cookie) return false;

  try {
    const { payload } = await jwtVerify(cookie, getSecret());
    const expectedPrefix = hashShareToken(rawToken).slice(0, 16);
    return payload.th === expectedPrefix;
  } catch {
    return false;
  }
}

export const SHARE_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 24 * 60 * 60,
};

/**
 * Middleware helper: validate token + check password session.
 * Returns the validated token or a NextResponse error.
 * Use this in all share sub-routes.
 */
export async function requireShareAccess(
  request: NextRequest,
  rawToken: string
): Promise<
  | { ok: true; token: ValidatedShareToken }
  | { ok: false; response: NextResponse }
> {
  const result = await validateShareToken(rawToken);
  if (!result.ok) return result;

  if (result.token.passwordHash) {
    const hasSession = await verifyShareSession(request, rawToken);
    if (!hasSession) {
      return { ok: false, response: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
    }
  }

  return { ok: true, token: result.token };
}
