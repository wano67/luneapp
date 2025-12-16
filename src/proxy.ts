// src/proxy.ts
import { verifyAuthToken, AUTH_COOKIE_NAME } from '@/server/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

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

  const loginUrl = new URL('/login', request.url);
  const from = request.nextUrl.pathname + request.nextUrl.search;
  loginUrl.searchParams.set('from', from);

  const res = NextResponse.redirect(loginUrl);
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return unauthorizedResponse(request);
  }

  try {
    const { payload } = await verifyAuthToken(token);

    if (payload.isActive === false) {
      return unauthorizedResponse(request);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Auth proxy error', error);
    return unauthorizedResponse(request);
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
