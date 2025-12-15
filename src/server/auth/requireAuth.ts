// src/server/auth/requireAuth.ts
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '@/server/auth/jwt';

export async function requireAuthAsync(req: NextRequest): Promise<{
  userId: string;
  email?: string;
  role?: string;
}> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  try {
    const { payload } = await verifyAuthToken(token);
    const userId = payload?.sub;

    if (!userId) throw new Error('UNAUTHORIZED');

    const email = typeof payload.email === 'string' ? payload.email : undefined;
    const role = typeof payload.role === 'string' ? payload.role : undefined;

    return {
      userId,
      email,
      role,
    };
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}
