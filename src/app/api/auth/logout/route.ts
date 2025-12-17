import { AUTH_COOKIE_NAME, authCookieOptions } from '@/server/auth/auth.service';
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

  const response = NextResponse.json({ status: 'logged_out' });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    ...authCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });

  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}
