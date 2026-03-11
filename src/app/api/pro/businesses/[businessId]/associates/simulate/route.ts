import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import {
  computeDirigeantCost,
  optimizeCompensation,
  type BusinessLegalForm,
  type SocialRegimeType,
} from '@/config/taxation';

export const POST = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER', rateLimit: { key: (ctx) => `sim:${ctx.businessId}`, limit: 60, windowMs: 60_000 } },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Corps de requete invalide.'), ctx.requestId);
    }

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { legalForm: true, socialRegime: true, capital: true },
    });

    const legalForm = (body.legalForm ?? business?.legalForm ?? 'SAS') as BusinessLegalForm;
    const socialRegime = (body.socialRegime ?? business?.socialRegime ?? 'ASSIMILE_SALARIE') as SocialRegimeType;
    const capitalCents = Number(body.capitalCents ?? (business?.capital ?? 0));
    const ccaCents = Number(body.ccaCents ?? 0);
    const effectif = Number(body.effectif ?? 1);

    const grossSalaryYearlyCents = Math.max(0, Math.round(Number(body.grossSalaryYearlyCents) || 0));
    const dividendsCents = Math.max(0, Math.round(Number(body.dividendsCents) || 0));

    const result = computeDirigeantCost({
      grossSalaryYearlyCents,
      dividendsCents,
      legalForm,
      socialRegime,
      capitalCents,
      ccaCents,
      effectif,
    });

    // Also compute optimal split if a budget is provided
    let optimal = null;
    const totalBudget = body.totalBudgetCents;
    if (typeof totalBudget === 'number' && totalBudget > 0) {
      optimal = optimizeCompensation({
        totalBudgetCents: Math.round(totalBudget),
        legalForm,
        socialRegime,
        capitalCents,
        ccaCents,
        effectif,
      });
    }

    return jsonb({ result, optimal }, ctx.requestId);
  },
);
