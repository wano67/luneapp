import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { deriveInvoicePaymentSummary } from '@/server/billing/payments';

type PaymentAggregate = {
  paidCents: bigint;
  count: number;
  lastPaidAt: Date | null;
};

// GET /api/pro/businesses/{businessId}/projects/{projectId}/invoices
export const GET = withBusinessRoute<{ businessId: string; projectId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const projectId = parseId(params.projectId);

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!project) return notFound('Projet introuvable.');

    const invoices = await prisma.invoice.findMany({
      where: { businessId: ctx.businessId, projectId },
      orderBy: { createdAt: 'desc' },
    });

    const invoiceIds = invoices.map((inv) => inv.id);
    const paymentGroups = invoiceIds.length
      ? await prisma.payment.groupBy({
          by: ['invoiceId'],
          where: {
            businessId: ctx.businessId,
            projectId,
            deletedAt: null,
            invoiceId: { in: invoiceIds },
          },
          _sum: { amountCents: true },
          _count: { _all: true },
          _max: { paidAt: true },
        })
      : [];

    const paidByInvoice = new Map<bigint, PaymentAggregate>();
    paymentGroups.forEach((row) => {
      paidByInvoice.set(row.invoiceId, {
        paidCents: row._sum.amountCents ?? BigInt(0),
        count: row._count._all ?? 0,
        lastPaidAt: row._max.paidAt ?? null,
      });
    });

    return jsonb(
      {
        items: invoices.map((inv) => {
          const summary = deriveInvoicePaymentSummary(
            {
              id: inv.id,
              businessId: inv.businessId,
              projectId: inv.projectId,
              clientId: inv.clientId,
              createdByUserId: inv.createdByUserId,
              status: inv.status,
              totalCents: inv.totalCents,
              paidAt: inv.paidAt,
            },
            paidByInvoice.get(inv.id)
          );
          return {
            id: inv.id,
            businessId: inv.businessId,
            projectId: inv.projectId,
            clientId: inv.clientId,
            quoteId: inv.quoteId,
            status: inv.status,
            number: inv.number,
            totalCents: inv.totalCents,
            depositCents: inv.depositCents,
            balanceCents: inv.balanceCents,
            currency: inv.currency,
            issuedAt: inv.issuedAt,
            dueAt: inv.dueAt,
            paidAt: inv.paidAt,
            paidCents: summary ? summary.paidCents : BigInt(0),
            remainingCents: summary ? summary.remainingCents : inv.totalCents,
            paymentStatus: summary ? summary.status : 'UNPAID',
            lastPaidAt: summary?.lastPaidAt ?? null,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          };
        }),
      },
      ctx.requestId
    );
  }
);
