import { NextRequest, NextResponse } from 'next/server';
import { getRequestId, withIdNoStore } from '@/server/http/apiUtils';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

let warnedMissingOrigins = false;

export function getAllowedOrigins(): string[] {
  // Mettre l’origin canonique en premier (utile pour construire inviteLink côté serveur)
  const primary = [process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter(Boolean)
    .map((s) => s!.trim())
    .filter(Boolean);

  const extras = (process.env.APP_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const normalized = [...primary, ...extras].map(normalizeOrigin).filter(Boolean) as string[];
  if (process.env.NODE_ENV === 'production' && normalized.length === 0 && !warnedMissingOrigins) {
    warnedMissingOrigins = true;
    console.warn(
      '[csrf] No allowed origins configured; all mutations will be blocked in production. Set APP_URL / NEXT_PUBLIC_APP_URL / APP_ORIGINS.'
    );
  }
  return [...new Set(normalized)];
}

export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) return null;

  const requestId = getRequestId(request);

  const allowed = getAllowedOrigins();
  const enforce = process.env.NODE_ENV !== 'development';

  if (allowed.length === 0 && enforce) {
    return withIdNoStore(
      NextResponse.json({ error: 'Forbidden (CSRF origin)' }, { status: 403 }),
      requestId
    );
  }
  if (allowed.length === 0) return null; // dev sans config: on laisse passer

  const candidateHeader = request.headers.get('origin') ?? request.headers.get('referer');
  if (!candidateHeader) {
    return withIdNoStore(
      NextResponse.json({ error: 'Forbidden (CSRF origin)' }, { status: 403 }),
      requestId
    );
  }

  const candidateOrigin = normalizeOrigin(candidateHeader);
  if (!candidateOrigin) {
    return withIdNoStore(
      NextResponse.json({ error: 'Forbidden (CSRF origin)' }, { status: 403 }),
      requestId
    );
  }

  if (!allowed.includes(candidateOrigin)) {
    return withIdNoStore(
      NextResponse.json({ error: 'Forbidden (CSRF origin)' }, { status: 403 }),
      requestId
    );
  }

  return null;
}

export function withNoStore<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  return withNoStore(NextResponse.json(body, init));
}
