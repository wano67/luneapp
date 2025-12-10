import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  authenticateUser,
  createSessionToken,
  toPublicUser,
} from '@/server/auth/auth.service';
import { NextRequest, NextResponse } from 'next/server';

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

  try {
    const user = await authenticateUser({
      email: body.email,
      password: body.password,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Identifiants invalides ou utilisateur inactif.' },
        { status: 401 }
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

    return NextResponse.json(
      { error: 'Impossible de se connecter pour le moment.' },
      { status: 500 }
    );
  }
}
