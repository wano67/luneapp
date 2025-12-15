import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  authenticateUser,
  createSessionToken,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:login'),
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    return withRequestId(badRequest('Email et mot de passe sont requis.'), requestId);
  }

  try {
    const user = await authenticateUser({
      email: body.email,
      password: body.password,
    });

    if (!user) {
      return withRequestId(
        NextResponse.json({ error: 'Identifiants invalides ou utilisateur inactif.' }, { status: 401 }),
        requestId
      );
    }

    const token = await createSessionToken(user);
    const response = NextResponse.json({ user: toPublicUser(user) });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      ...authCookieOptions,
    });

    return response;
  } catch (error) {
    console.error('Login error', error);

    return withRequestId(
      NextResponse.json({ error: 'Impossible de se connecter pour le moment.' }, { status: 500 }),
      requestId
    );
  }
}
