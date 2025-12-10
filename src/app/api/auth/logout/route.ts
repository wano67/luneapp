import { AUTH_COOKIE_NAME, authCookieOptions } from '@/server/auth/auth.service';
import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ status: 'logged_out' });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    ...authCookieOptions,
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
