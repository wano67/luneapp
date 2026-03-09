import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseDateOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/accounting/tva?from=...&to=...
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);

    const fromDate = parseDateOpt(searchParams.get('from'));
    const toDate = parseDateOpt(searchParams.get('to'));
    if (!fromDate || !toDate) {
      return withIdNoStore(badRequest('from et to requis.'), requestId);
    }

    const finances = await prisma.finance.findMany({
      where: {
        businessId: businessIdBigInt,
        deletedAt: null,
        date: { gte: fromDate, lte: toDate },
        vatRate: { not: null },
      },
      select: {
        type: true,
        amountCents: true,
        vatRate: true,
        vatCents: true,
      },
    });

    // Breakdown by vatRate for income (collectée) and expense (déductible)
    const ventesParTaux = new Map<number, { baseHT: bigint; tva: bigint }>();
    const achatsParTaux = new Map<number, { baseHT: bigint; tva: bigint }>();

    let totalTvaCollectee = 0n;
    let totalTvaDeductible = 0n;

    for (const f of finances) {
      const rate = f.vatRate ?? 0;
      const tvaCents = f.vatCents ?? 0n;
      const htCents = f.amountCents - tvaCents;

      if (f.type === 'INCOME') {
        totalTvaCollectee += tvaCents;
        const existing = ventesParTaux.get(rate);
        if (existing) {
          existing.baseHT += htCents;
          existing.tva += tvaCents;
        } else {
          ventesParTaux.set(rate, { baseHT: htCents, tva: tvaCents });
        }
      } else {
        totalTvaDeductible += tvaCents;
        const existing = achatsParTaux.get(rate);
        if (existing) {
          existing.baseHT += htCents;
          existing.tva += tvaCents;
        } else {
          achatsParTaux.set(rate, { baseHT: htCents, tva: tvaCents });
        }
      }
    }

    const tvaAPayer = totalTvaCollectee - totalTvaDeductible;

    return jsonb(
      {
        periode: { from: fromDate.toISOString(), to: toDate.toISOString() },
        ventesParTaux: Array.from(ventesParTaux.entries())
          .sort(([a], [b]) => b - a)
          .map(([taux, data]) => ({
            tauxBps: taux,
            tauxPercent: taux / 100,
            baseHTCents: data.baseHT.toString(),
            tvaCents: data.tva.toString(),
          })),
        achatsParTaux: Array.from(achatsParTaux.entries())
          .sort(([a], [b]) => b - a)
          .map(([taux, data]) => ({
            tauxBps: taux,
            tauxPercent: taux / 100,
            baseHTCents: data.baseHT.toString(),
            tvaCents: data.tva.toString(),
          })),
        totalTvaCollecteeCents: totalTvaCollectee.toString(),
        totalTvaDeductibleCents: totalTvaDeductible.toString(),
        tvaAPayerCents: tvaAPayer > 0n ? tvaAPayer.toString() : '0',
        creditTvaCents: tvaAPayer < 0n ? (-tvaAPayer).toString() : '0',
      },
      requestId
    );
  }
);
