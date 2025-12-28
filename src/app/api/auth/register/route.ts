import { Prisma } from '@/generated/prisma/client';
import { getErrorMessage, getErrorStack } from '@/lib/error';
type PrismaClientKnownRequestError = Prisma.PrismaClientKnownRequestError;
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
import { authenticateUser } from '@/server/auth/auth.service';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

  const email = normalizeEmail(body.email);
  const password = body.password.trim();
  const name = typeof body.name === 'string' ? body.name : undefined;

  if (!isValidEmail(email)) {
    const res = withRequestId(badRequest('Email invalide.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    const res = withRequestId(badRequest('Le mot de passe doit contenir au moins 8 caractères.'), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    const res = withRequestId(badRequest('Mot de passe trop long.'), requestId);
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
  } catch (error: unknown) {
    if (isPrismaKnownError(error) && error.code === 'P2002') {
      // Email déjà utilisé : comportement non-énumérable, on tente un login silencieux si le mot de passe correspond.
      const existing = await authenticateUser({ email, password });
      if (existing) {
        const token = await createSessionToken(existing);
        const response = NextResponse.json(
          { user: toPublicUser(existing) },
          { status: 200 }
        );
        response.cookies.set({
          name: AUTH_COOKIE_NAME,
          value: token,
          ...authCookieOptions,
        });
        response.headers.set('Cache-Control', 'no-store');
        return withRequestId(response, requestId);
      }
      const res = NextResponse.json(
        { message: 'Si un compte existe déjà, utilisez la connexion.' },
        { status: 200 }
      );
      res.headers.set('Cache-Control', 'no-store');
      return withRequestId(res, requestId);
    }

    console.error('Error during registration', getErrorMessage(error), getErrorStack(error));

    const res = NextResponse.json({ error: 'Impossible de créer le compte pour le moment.' }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }
}

function isPrismaKnownError(error: unknown): error is PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}
