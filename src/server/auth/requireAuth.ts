// src/server/auth/requireAuth.ts
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from './jwt';

export function requireAuth(req: NextRequest): { userId: string } {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  // jwtVerify est async, mais ici on veut rester sync → on fait une variante async plus bas
  // => Solution: on expose aussi requireAuthAsync (recommandé).
  throw new Error('USE_REQUIRE_AUTH_ASYNC');
}

export async function requireAuthAsync(req: NextRequest): Promise<{ userId: string }> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const { payload } = await verifyAuthToken(token);

  // userId = payload.sub (string)
  const userId = payload.sub;
  if (!userId) throw new Error('UNAUTHORIZED');

  return { userId };
}
