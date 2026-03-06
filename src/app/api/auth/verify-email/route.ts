import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:verify-email'),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);
  if (!body || typeof (body as Record<string, unknown>).token !== 'string') {
    const res = withRequestId(badRequest('Token requis.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const rawToken = ((body as Record<string, unknown>).token as string).trim();
  if (!rawToken) {
    const res = withRequestId(badRequest('Token invalide.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('base64url');

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: tokenHash,
      emailVerificationExpiry: { gt: new Date() },
    },
  });

  if (!user) {
    const res = NextResponse.json(
      { error: 'Lien invalide ou expiré.' },
      { status: 400 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  const updatedUser = { ...user, emailVerified: true };
  const sessionToken = await createSessionToken(updatedUser);

  const response = NextResponse.json(
    { user: toPublicUser(updatedUser), verified: true },
    { status: 200 }
  );

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: sessionToken,
    ...authCookieOptions,
  });

  response.headers.set('Cache-Control', 'no-store');
  return withRequestId(response, requestId);
}
