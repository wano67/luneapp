import { NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/server/security/csrf';

export function buildBaseUrl(request: NextRequest) {
  const envBase = (process.env.BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (envBase) {
    try {
      return new URL(envBase).origin;
    } catch {
      // ignore and fallback
    }
  }
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (forwardedHost) {
    const proto = forwardedProto || 'https';
    try {
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {
      // fall through
    }
  }

  const allowed = getAllowedOrigins();
  if (allowed.length > 0) return allowed[0];

  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
