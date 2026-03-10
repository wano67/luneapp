// src/proxy.ts
import { verifyAuthToken, AUTH_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/server/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { buildBaseUrl } from '@/server/http/baseUrl';

function unauthorizedResponse(request: NextRequest) {
  const requestId =
    request.headers.get('x-request-id') ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);

  if (request.nextUrl.pathname.startsWith('/api')) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const loginUrl = new URL('/login', buildBaseUrl(request));
  const from = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set('from', from);

  const res = NextResponse.redirect(loginUrl);
  res.headers.set('x-request-id', requestId);
  return res;
}

/**
 * When the access token is expired but a refresh cookie exists:
 * - API requests → 401 (apiClient will POST /api/auth/refresh and retry)
 * - Page requests → redirect to GET /api/auth/refresh?redirect=... for transparent renewal
 */
function refreshOrUnauthorized(request: NextRequest): NextResponse {
  const hasRefresh = !!request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!hasRefresh) {
    return unauthorizedResponse(request);
  }

  // API calls: return 401, let apiClient handle the refresh via POST
  if (request.nextUrl.pathname.startsWith('/api')) {
    const requestId =
      request.headers.get('x-request-id') ||
      (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // Page navigation: redirect to GET refresh endpoint
  const from = request.nextUrl.pathname + request.nextUrl.search;
  const refreshUrl = new URL('/api/auth/refresh', buildBaseUrl(request));
  refreshUrl.searchParams.set('redirect', from);
  return NextResponse.redirect(refreshUrl);
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return refreshOrUnauthorized(request);
  }

  try {
    const { payload } = await verifyAuthToken(token);

    if (payload.isActive === false) {
      return unauthorizedResponse(request);
    }

    // Block unverified users from /app (redirect to /verify-email)
    if (
      payload.emailVerified === false &&
      request.nextUrl.pathname.startsWith('/app')
    ) {
      return NextResponse.redirect(new URL('/verify-email', buildBaseUrl(request)));
    }

    return NextResponse.next();
  } catch {
    // Token expired or invalid — try refresh
    return refreshOrUnauthorized(request);
  }
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/pro/:path*',
    '/api/personal/:path*',
    '/api/performance/:path*',
  ],
};
