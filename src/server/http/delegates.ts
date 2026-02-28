/**
 * Vérification de delegates Prisma (modèles générés).
 *
 * Règle : ne jamais redéfinir ensureXDelegate dans une route.
 * Importer depuis ici.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { serverError, withIdNoStore } from '@/server/http/apiUtils';

// ---------------------------------------------------------------------------
// Generics
// ---------------------------------------------------------------------------

/**
 * Vérifie qu'un delegate Prisma existe (le modèle a bien été généré).
 * Retourne `null` si OK, sinon une NextResponse 500.
 *
 * @param delegateName — Le nom du delegate Prisma (ex: 'finance', 'task', 'prospect')
 * @param requestId — Si fourni, wrappé avec withIdNoStore + x-request-id header
 *
 * @example
 *   const err = ensureDelegate('finance', requestId);
 *   if (err) return err;
 */
export function ensureDelegate(
  delegateName: string,
  requestId?: string
): NextResponse | null {
  if (!(prisma as unknown as Record<string, unknown>)[delegateName]) {
    const res = serverError();
    return requestId ? withIdNoStore(res, requestId) : res;
  }
  return null;
}

/**
 * Vérifie plusieurs delegates Prisma d'un coup.
 *
 * @example
 *   const err = ensureDelegates(['process', 'processStep'], requestId);
 *   if (err) return err;
 */
export function ensureDelegates(
  delegateNames: string[],
  requestId?: string
): NextResponse | null {
  for (const name of delegateNames) {
    if (!(prisma as unknown as Record<string, unknown>)[name]) {
      const res = serverError();
      return requestId ? withIdNoStore(res, requestId) : res;
    }
  }
  return null;
}
