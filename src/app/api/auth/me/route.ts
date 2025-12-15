import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME, toPublicUser } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { jsonNoStore } from '@/server/security/csrf';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';

function unauthorized(reason?: string) {
  return NextResponse.json(
    { error: 'Unauthorized', reason },
    { status: 401 }
  );
}

async function getUserIdFromRequest(request: NextRequest): Promise<bigint | null> {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME);
  const token = cookie?.value;

  if (!token) {
    console.warn('[auth/me] No auth token cookie found');
    return null;
  }

  try {
    const { payload } = await verifyAuthToken(token);

    if (!payload.sub) {
      console.warn('[auth/me] Token has no subject (sub)');
      return null;
    }

    return BigInt(payload.sub);
  } catch (error) {
    console.error('[auth/me] Error verifying auth token', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    return withRequestId(unauthorized('invalid_or_missing_token'), requestId);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      console.warn('[auth/me] User not found for id', userId.toString());
      return withRequestId(unauthorized('user_not_found'), requestId);
    }

    if (!user.isActive) {
      console.warn('[auth/me] User is not active', userId.toString());
      return withRequestId(unauthorized('user_inactive'), requestId);
    }

    // Pour l’instant, on renvoie un memberships vide.
    // /api/pro/businesses reste la source de vérité pour les entreprises.
    return jsonNoStore({
      user: toPublicUser(user),
      memberships: [],
    });
  } catch (error) {
    console.error('[auth/me] Error loading user', error);
    return withRequestId(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId
    );
  }
}
