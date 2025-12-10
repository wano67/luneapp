import { verifyAuthToken, AUTH_COOKIE_NAME } from '@/server/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

function unauthorizedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
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
    console.error('Auth middleware error', error);
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
