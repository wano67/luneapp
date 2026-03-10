import { NextRequest } from 'next/server';
import { getAllowedOrigins } from '@/server/security/csrf';

/**
 * Résout l'URL de base de l'application.
 *
 * Priorité :
 *   1. BASE_URL (variable d'env — source de vérité en prod)
 *   2. Headers x-forwarded-host / host (reverse-proxy)
 *   3. APP_ORIGINS (première origine non-localhost)
 *   4. request.url
 *
 * Ne retourne JAMAIS localhost en dehors de NODE_ENV=development.
 */
export function buildBaseUrl(request: NextRequest): string {
  // 1. Variable d'env explicite — toujours prioritaire
  const envBase = (process.env.BASE_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (envBase) {
    try {
      return new URL(envBase).origin;
    } catch {
      // valeur mal formée, on continue
    }
  }

  // 2. Headers reverse-proxy (ignore localhost)
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
  if (forwardedHost && !forwardedHost.includes('localhost')) {
    const proto = forwardedProto || 'https';
    try {
      return new URL(`${proto}://${forwardedHost}`).origin;
    } catch {
      // fall through
    }
  }

  // 3. Première origine non-localhost dans APP_ORIGINS
  const allowed = getAllowedOrigins();
  const prodOrigin = allowed.find((o) => !o.includes('localhost'));
  if (prodOrigin) return prodOrigin;

  // 4. Fallback request.url
  try {
    const fromReq = new URL(request.url).origin;
    if (!fromReq.includes('localhost') || process.env.NODE_ENV === 'development') {
      return fromReq;
    }
  } catch {
    // ignore
  }

  // Dev-only fallback
  if (process.env.NODE_ENV === 'development') {
    return forwardedHost
      ? `${forwardedProto || 'http'}://${forwardedHost}`
      : 'http://localhost:3000';
  }

  // En prod sans BASE_URL configuré — log critique
  console.error('[baseUrl] CRITICAL: BASE_URL is not set in production. Email links may be broken.');
  if (allowed.length > 0) return allowed[0];
  return new URL(request.url).origin;
}
