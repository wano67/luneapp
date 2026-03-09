import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  createSessionToken,
  validateAndRotateRefreshToken,
  cleanupExpiredRefreshTokens,
  toPublicUser,
} from '@/server/auth/auth.service';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';

// Lazy cleanup: run at most once per 10 minutes
let lastCleanup = 0;
const CLEANUP_INTERVAL = 10 * 60 * 1000;

function maybeLazyCleanup() {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    lastCleanup = now;
    cleanupExpiredRefreshTokens().catch(() => {});
  }
}

/**
 * POST /api/auth/refresh — API flow
 * Called by apiClient on 401 to silently refresh tokens.
 * Returns new access + refresh cookies, plus user payload.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:refresh'),
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  maybeLazyCleanup();

  const rawRefresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!rawRefresh) {
    const res = NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const result = await validateAndRotateRefreshToken(rawRefresh);
  if (!result) {
    // Invalid/expired — clear refresh cookie
    const res = NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    res.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: '',
      ...refreshCookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });
    res.headers.set('Cache-Control', 'no-store');
    return withRequestId(res, requestId);
  }

  const { user, newRawToken } = result;
  const accessToken = await createSessionToken(user);

  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    ...authCookieOptions,
  });
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: newRawToken,
    ...refreshCookieOptions,
  });
  response.headers.set('Cache-Control', 'no-store');
  return withRequestId(response, requestId);
}

/**
 * GET /api/auth/refresh?redirect=... — Page navigation flow
 * Called by middleware when access token expired but refresh cookie exists.
 * Refreshes tokens and redirects to the original page.
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'auth:refresh'),
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  maybeLazyCleanup();

  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/app';
  // Sanitize redirect: must start with /app
  const safeRedirect = redirectTo.startsWith('/app') ? redirectTo : '/app';

  const rawRefresh = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!rawRefresh) {
    return NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(safeRedirect)}`, request.url));
  }

  const result = await validateAndRotateRefreshToken(rawRefresh);
  if (!result) {
    const res = NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(safeRedirect)}`, request.url));
    res.cookies.set({
      name: REFRESH_COOKIE_NAME,
      value: '',
      ...refreshCookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });
    return res;
  }

  const { user, newRawToken } = result;
  const accessToken = await createSessionToken(user);

  const response = NextResponse.redirect(new URL(safeRedirect, request.url));
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    ...authCookieOptions,
  });
  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: newRawToken,
    ...refreshCookieOptions,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('x-request-id', requestId);
  return response;
}
