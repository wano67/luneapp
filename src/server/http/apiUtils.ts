import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export type ApiErrorShape = { error: string };

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

export function isApiErrorShape(v: unknown): v is ApiErrorShape {
  return !!v && typeof v === 'object' && 'error' in v && typeof (v as { error?: unknown }).error === 'string';
}

export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Failed';
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError() {
  return NextResponse.json({ error: 'Failed' }, { status: 500 });
}

const REQUEST_ID_SYMBOL = Symbol.for('luneapp.requestId');

export function getRequestId(req: NextRequest): string {
  const anyReq = req as unknown as Record<PropertyKey, unknown>;
  const existing = anyReq[REQUEST_ID_SYMBOL];
  if (typeof existing === 'string' && existing.length) return existing;

  const hdr = req.headers.get('x-request-id');
  if (hdr) {
    anyReq[REQUEST_ID_SYMBOL] = hdr;
    return hdr;
  }

  const generated =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  anyReq[REQUEST_ID_SYMBOL] = generated;
  return generated;
}

export function withRequestId(res: NextResponse, requestId: string) {
  res.headers.set('x-request-id', requestId);
  return res;
}

export function withIdNoStore(res: NextResponse, requestId: string) {
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return withRequestId(res, requestId);
}
