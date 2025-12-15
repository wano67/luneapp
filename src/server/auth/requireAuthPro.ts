import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';

export async function requireAuthPro(req: NextRequest): Promise<{ userId: string }> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) throw new Error('UNAUTHORIZED');

  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) throw new Error('UNAUTHORIZED');
    return { userId: String(payload.sub) };
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}
