import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { validateShareToken } from '@/server/share/validateShareToken';
import {
  createShareSessionJwt,
  shareCookieName,
  SHARE_SESSION_COOKIE_OPTIONS,
} from '@/server/share/shareSession';

/**
 * POST /api/share/[token]/auth
 * Authenticate with a password for a protected share link.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:auth'),
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken } = await params;

  const result = await validateShareToken(rawToken);
  if (!result.ok) return result.response;

  if (!result.token.passwordHash) {
    return NextResponse.json({ error: 'Aucun mot de passe requis pour ce lien.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!password) {
    return NextResponse.json({ error: 'Mot de passe requis.' }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, result.token.passwordHash);

  if (!valid) {
    // Brief delay to slow down brute force
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
  }

  const jwt = await createShareSessionJwt(rawToken);
  const cookieName = shareCookieName(rawToken);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, jwt, SHARE_SESSION_COOKIE_OPTIONS);

  return response;
}
