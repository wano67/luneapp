import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { computeProjectPricing } from '@/server/services/pricing';

// GET /api/pro/businesses/{businessId}/projects/{projectId}/pricing
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const pricing = await computeProjectPricing(ctx.businessId, projectId);
    if (!pricing) return notFound('Projet introuvable.');

    return jsonb({ pricing }, ctx.requestId);
  }
);
