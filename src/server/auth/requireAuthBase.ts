import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthTokenPayload } from '@/server/auth/jwt';
import { prisma } from '@/server/db/client';

export type RequireAuthResult = {
  userId: string;
  email?: string;
  role?: string;
};

function unauthorizedError() {
  return new Error('UNAUTHORIZED');
}

function parseUserId(sub: AuthTokenPayload['sub']) {
  if (!sub) throw unauthorizedError();

  try {
    return BigInt(sub);
  } catch {
    throw unauthorizedError();
  }
}

export async function requireAuthBase(req: NextRequest): Promise<RequireAuthResult> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) throw unauthorizedError();

  try {
    const { payload } = await verifyAuthToken(token);
    const userId = parseUserId(payload?.sub);

    if (payload.isActive === false) {
      throw unauthorizedError();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) throw unauthorizedError();
    if (user.isActive === false) {
      throw unauthorizedError();
    }

    const email =
      typeof payload.email === 'string'
        ? payload.email
        : typeof user.email === 'string'
          ? user.email
          : undefined;

    const role =
      typeof payload.role === 'string'
        ? payload.role
        : typeof user.role === 'string'
          ? user.role
          : undefined;

    return {
      userId: user.id.toString(),
      email,
      role,
    };
  } catch {
    throw unauthorizedError();
  }
}
