import { proxy } from './src/proxy';
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/app/:path*',
    '/api/pro/:path*',
    '/api/personal/:path*',
    '/api/performance/:path*',
    '/api/caldav/:path*',
  ],
};

export default function middleware(request: NextRequest) {
  // CalDAV: rewrite non-standard HTTP methods (PROPFIND, REPORT) to POST
  // and skip auth proxy (token-based auth is handled in the route)
  if (request.nextUrl.pathname.startsWith('/api/caldav/')) {
    const method = request.method.toUpperCase();
    if (method === 'PROPFIND' || method === 'REPORT') {
      const url = request.nextUrl.clone();
      const headers = new Headers(request.headers);
      headers.set('X-HTTP-Method-Override', method);
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next();
  }

  return proxy(request);
}
