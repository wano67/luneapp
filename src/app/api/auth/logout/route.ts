import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  deleteUserRefreshTokens,
} from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:logout'),
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const res = withRequestId(unauthorized(), requestId);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // Delete all refresh tokens for this user
  try {
    const { payload } = await verifyAuthToken(token);
    if (payload.sub) {
      deleteUserRefreshTokens(BigInt(payload.sub)).catch(() => {});
    }
  } catch {
    // Token may be expired but we still clear cookies
  }

  const response = NextResponse.json({ status: 'logged_out' });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    ...authCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: '',
    ...refreshCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}
