import { Prisma } from '@/generated/prisma/client';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  registerUser,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { assertSameOrigin } from '@/server/security/csrf';
import { NextRequest, NextResponse } from 'next/server';
import { badRequest, getRequestId, withRequestId } from '@/server/http/apiUtils';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:register'),
    limit: 5,
    windowMs: 60 * 60 * 1000,
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
    const res = withRequestId(badRequest('Email et mot de passe sont requis.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const { email, password } = body;
  const name = typeof body.name === 'string' ? body.name : undefined;

  if (password.length < MIN_PASSWORD_LENGTH) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir au moins 8 caractères.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  try {
    const user = await registerUser({ email, password, name });
    const token = await createSessionToken(user);
    const response = NextResponse.json(
      { user: toPublicUser(user) },
      { status: 201 }
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      ...authCookieOptions,
    });

    response.headers.set('Cache-Control', 'no-store');
    return withRequestId(response, requestId);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const res = NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 });
      res.headers.set('Cache-Control', 'no-store');
      return withRequestId(res, requestId);
    }

    console.error('Error during registration', error);

    const res = NextResponse.json({ error: 'Impossible de créer le compte pour le moment.' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }
}
