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
    return withRequestId(badRequest('Email et mot de passe sont requis.'), requestId);
  }

  const { email, password } = body;
  const name = typeof body.name === 'string' ? body.name : undefined;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return withRequestId(badRequest('Le mot de passe doit contenir au moins 8 caractères.'), requestId);
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

    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return withRequestId(NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 409 }), requestId);
    }

    console.error('Error during registration', error);

    return withRequestId(
      NextResponse.json({ error: 'Impossible de créer le compte pour le moment.' }, { status: 500 }),
      requestId
    );
  }
}
