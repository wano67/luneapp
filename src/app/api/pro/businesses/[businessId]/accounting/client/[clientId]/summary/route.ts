import { prisma } from '@/server/db/client';
import { InvoiceStatus, Prisma } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { computeOutstanding } from '@/lib/accounting';

function toNumber(value: bigint | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

// GET /api/pro/businesses/:businessId/accounting/client/:clientId/summary
export const GET = withBusinessRoute<{ businessId: string; clientId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const clientId = parseId(params.clientId);

    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!client) return notFound('Client introuvable');

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseWhere: Prisma.InvoiceWhereInput = {
      businessId: ctx.businessId,
      clientId,
      status: { not: InvoiceStatus.CANCELLED },
      OR: [{ issuedAt: { gte: twelveMonthsAgo } }, { issuedAt: null, createdAt: { gte: twelveMonthsAgo } }],
    };

    const [agg, paidAgg, invoices, payments] = await Promise.all([
      prisma.invoice.aggregate({
        where: baseWhere,
        _sum: { totalCents: true },
      }),
      prisma.payment.aggregate({
        where: {
          businessId: ctx.businessId,
          clientId,
          deletedAt: null,
          paidAt: { gte: twelveMonthsAgo },
        },
        _sum: { amountCents: true },
      }),
      prisma.invoice.findMany({
        where: baseWhere,
        orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: { project: { select: { name: true } } },
      }),
      prisma.payment.findMany({
        where: {
          businessId: ctx.businessId,
          clientId,
          deletedAt: null,
          paidAt: { gte: twelveMonthsAgo },
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: { invoice: { select: { number: true, currency: true } } },
      }),
    ]);

    const invoicedCents = toNumber(agg._sum?.totalCents);
    const paidCents = toNumber(paidAgg._sum?.amountCents);
    const outstandingCents = computeOutstanding(invoicedCents, paidCents);

    return jsonb(
      {
        totals: { invoicedCents, paidCents, outstandingCents },
        invoices: invoices.map((inv) => ({
          id: inv.id,
          number: inv.number ?? `INV-${inv.id}`,
          status: inv.status,
          totalCents: Number(inv.totalCents),
          currency: inv.currency,
          issuedAt: inv.issuedAt,
          dueAt: inv.dueAt,
          projectName: (inv as typeof inv & { project?: { name: string | null } | null }).project?.name ?? null,
        })),
        payments: payments.map((p) => ({
          id: p.id,
          amountCents: Number(p.amountCents),
          currency: p.invoice?.currency ?? 'EUR',
          paidAt: p.paidAt,
          reference: p.reference ?? p.invoice?.number ?? `PAY-${p.id}`,
        })),
      },
      ctx.requestId
    );
  }
);
