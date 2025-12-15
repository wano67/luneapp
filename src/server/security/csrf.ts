import { NextRequest, NextResponse } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

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
  return [...new Set(normalized)];
}

export function assertSameOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) return null;

  const allowed = getAllowedOrigins();
  const isProd = process.env.NODE_ENV === 'production';

  if (allowed.length === 0 && isProd) return forbidden();
  if (allowed.length === 0) return null; // dev sans config: on laisse passer

  const candidateHeader = request.headers.get('origin') ?? request.headers.get('referer');
  if (!candidateHeader) return forbidden();

  const candidateOrigin = normalizeOrigin(candidateHeader);
  if (!candidateOrigin) return forbidden();

  return allowed.includes(candidateOrigin) ? null : forbidden();
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
