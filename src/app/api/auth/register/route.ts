import { Prisma } from '@/generated/prisma/client';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  createSessionToken,
  registerUser,
  toPublicUser,
} from '@/server/auth/auth.service';
import { NextRequest, NextResponse } from 'next/server';

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Email et mot de passe sont requis.' },
      { status: 400 }
    );
  }

  const { email, password } = body;
  const name = typeof body.name === 'string' ? body.name : undefined;

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 8 caractères.' },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé.' },
        { status: 409 }
      );
    }

    console.error('Error during registration', error);

    return NextResponse.json(
      { error: 'Impossible de créer le compte pour le moment.' },
      { status: 500 }
    );
  }
}
