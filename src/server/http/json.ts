/**
 * Sérialisation JSON centralisée — compatible BigInt, Date, null.
 *
 * Problème résolu : JSON.stringify() lance une erreur sur les BigInt.
 * Solution : deepSerialize() convertit récursivement avant de passer
 *            à NextResponse.json().
 *
 * Règle : ne jamais faire BigInt.toString() manuellement dans une route.
 * Utiliser jsonb() ou deepSerialize() depuis ici.
 */

import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Sérialiseur récursif
// ---------------------------------------------------------------------------

/**
 * Transforme un objet quelconque en structure JSON-safe :
 *   - bigint  → string
 *   - Date    → ISO 8601 string
 *   - null/undefined → null
 *   - Array   → récursif
 *   - Object  → récursif
 *   - autres  → passthrough (string, number, boolean)
 */
export function deepSerialize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(deepSerialize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepSerialize(v);
    }
    return out;
  }
  // string, number, boolean
  return value;
}

// ---------------------------------------------------------------------------
// Helpers de réponse HTTP
// ---------------------------------------------------------------------------

/**
 * Équivalent de NextResponse.json() mais supporte BigInt.
 *
 * @example
 * return jsonb({ item: prismaRecord }, ctx.requestId);
 */
export function jsonb(
  data: unknown,
  requestId: string,
  init?: { status?: number }
): NextResponse {
  const serialized = deepSerialize(data);
  const res = NextResponse.json(serialized, { status: init?.status ?? 200 });
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  res.headers.set('x-request-id', requestId);
  return res;
}

/**
 * Réponse 201 Created avec corps BigInt-safe.
 */
export function jsonbCreated(data: unknown, requestId: string): NextResponse {
  return jsonb(data, requestId, { status: 201 });
}

/**
 * Réponse 204 No Content (pas de corps).
 */
export function jsonbNoContent(requestId: string): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('x-request-id', requestId);
  return res;
}
