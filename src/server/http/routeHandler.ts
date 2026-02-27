/**
 * Handler de route unifié pour les routes Pro (business-scoped).
 *
 * Encapsule le boilerplate répété dans 106 routes :
 *   1. CSRF check (assertSameOrigin)
 *   2. Auth (requireAuthBase)
 *   3. Parse businessId depuis l'URL
 *   4. Vérification du rôle business (requireBusinessRole)
 *   5. Rate limiting optionnel
 *   6. Gestion d'erreur globale
 *
 * Usage :
 *   export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
 *     const items = await prisma.xxx.findMany({ where: { businessId: ctx.businessId } });
 *     return jsonb({ items }, ctx.requestId);
 *   });
 *
 *   export const PATCH = withBusinessRoute(
 *     { minRole: 'ADMIN', rateLimit: { key: (ctx) => `settings:${ctx.businessId}`, limit: 60, windowMs: 60_000 } },
 *     async (ctx, req) => { ... }
 *   );
 */

import { NextRequest, NextResponse } from 'next/server';
import type { BusinessMembership, BusinessRole } from '@/generated/prisma';
import { requireAuthBase } from '@/server/auth/requireAuthBase';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, withIdNoStore, badRequest, forbidden, unauthorized, serverError } from '@/server/http/apiUtils';
import { RouteParseError } from '@/server/http/parsers';

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

/**
 * Contexte injecté dans chaque handler.
 * Toutes les valeurs sont déjà validées et typées.
 */
export type BusinessRouteContext = {
  /** ID de l'utilisateur authentifié (BigInt). */
  userId: bigint;
  /** ID du business extrait et validé depuis l'URL. */
  businessId: bigint;
  /** Request ID pour la traçabilité (x-request-id header). */
  requestId: string;
  /** Membership validé — contient role, permissions, etc. */
  membership: BusinessMembership;
};

type RateLimitConfig = {
  /** Clé de rate limit. Reçoit le contexte pour permettre des clés dynamiques. */
  key: (ctx: BusinessRouteContext) => string;
  /** Nombre de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Fenêtre en millisecondes. */
  windowMs: number;
};

type BusinessRouteOptions = {
  /** Rôle minimum requis pour accéder à la route. */
  minRole: BusinessRole;
  /** Configuration optionnelle du rate limiting. */
  rateLimit?: RateLimitConfig;
};

/**
 * Params génériques d'une route Next.js App Router.
 * Le type P doit inclure `businessId`.
 */
type RouteContext<P extends Record<string, string> = { businessId: string }> = {
  params: Promise<P>;
};

// ---------------------------------------------------------------------------
// Handler principal : routes business-scoped
// ---------------------------------------------------------------------------

/**
 * Wrap une route Pro.
 * Gère auth + role + CSRF + rate limit + erreurs.
 */
export function withBusinessRoute<P extends { businessId: string } = { businessId: string }>(
  options: BusinessRouteOptions,
  handler: (ctx: BusinessRouteContext, req: NextRequest, params: P) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
    const requestId = getRequestId(req);

    try {
      // 1. CSRF (no-op pour GET/HEAD, bloque les mutations cross-origin)
      const csrfErr = assertSameOrigin(req);
      if (csrfErr) return withIdNoStore(csrfErr, requestId);

      // 2. Auth
      let userId: bigint;
      try {
        const auth = await requireAuthBase(req);
        userId = BigInt(auth.userId);
      } catch {
        return withIdNoStore(unauthorized(), requestId);
      }

      // 3. Parse businessId depuis l'URL
      const params = await context.params;
      const { businessId: businessIdStr } = params;
      if (!businessIdStr || !/^\d+$/.test(businessIdStr)) {
        return withIdNoStore(badRequest('businessId invalide.'), requestId);
      }
      const businessId = BigInt(businessIdStr);

      // 4. Vérification du rôle business (garantit le filtre businessId)
      const membership = await requireBusinessRole(businessId, userId, options.minRole);
      if (!membership) return withIdNoStore(forbidden(), requestId);

      const ctx: BusinessRouteContext = { userId, businessId, requestId, membership };

      // 5. Rate limiting optionnel
      if (options.rateLimit) {
        const key = options.rateLimit.key(ctx);
        const limited = rateLimit(req, {
          key,
          limit: options.rateLimit.limit,
          windowMs: options.rateLimit.windowMs,
        });
        if (limited) return withIdNoStore(limited, requestId);
      }

      // 6. Déléguer au handler métier
      return await handler(ctx, req, params);
    } catch (e) {
      // RouteParseError → 400 avec message explicite
      if (e instanceof RouteParseError) {
        return withIdNoStore(badRequest(e.message), requestId);
      }
      // Erreurs métier connues
      if (e instanceof Error) {
        if (e.message === 'NOT_FOUND') {
          return withIdNoStore(
            NextResponse.json({ error: 'Ressource introuvable.' }, { status: 404 }),
            requestId
          );
        }
        if (e.message === 'FORBIDDEN') {
          return withIdNoStore(forbidden(), requestId);
        }
      }
      // Erreur inattendue
      console.error('[routeHandler]', { requestId, error: e });
      return withIdNoStore(serverError(), requestId);
    }
  };
}

// ---------------------------------------------------------------------------
// Handler pour routes personnelles (sans businessId)
// ---------------------------------------------------------------------------

export type PersonalRouteContext = {
  userId: bigint;
  requestId: string;
};

/**
 * Wrap une route Personal (pas de businessId).
 */
export function withPersonalRoute(
  handler: (ctx: PersonalRouteContext, req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = getRequestId(req);

    try {
      const csrfErr = assertSameOrigin(req);
      if (csrfErr) return withIdNoStore(csrfErr, requestId);

      let userId: bigint;
      try {
        const auth = await requireAuthBase(req);
        userId = BigInt(auth.userId);
      } catch {
        return withIdNoStore(unauthorized(), requestId);
      }

      const ctx: PersonalRouteContext = { userId, requestId };
      return await handler(ctx, req);
    } catch (e) {
      if (e instanceof RouteParseError) {
        return withIdNoStore(badRequest(e.message), requestId);
      }
      console.error('[routeHandler:personal]', { requestId, error: e });
      return withIdNoStore(serverError(), requestId);
    }
  };
}
