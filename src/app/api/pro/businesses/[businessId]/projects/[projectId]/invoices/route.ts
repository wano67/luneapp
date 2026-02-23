import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { deriveInvoicePaymentSummary, type InvoicePaymentSummary } from '@/server/billing/payments';

type PaymentAggregate = {
  paidCents: bigint;
  count: number;
  lastPaidAt: Date | null;
};

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function serialize(
  invoice: Awaited<ReturnType<typeof prisma.invoice.findFirst>>,
  paymentSummary?: InvoicePaymentSummary
) {
  if (!invoice) return null;
  return {
    id: invoice.id.toString(),
    businessId: invoice.businessId.toString(),
    projectId: invoice.projectId.toString(),
    clientId: invoice.clientId ? invoice.clientId.toString() : null,
    quoteId: invoice.quoteId ? invoice.quoteId.toString() : null,
    status: invoice.status,
    number: invoice.number,
    totalCents: invoice.totalCents.toString(),
    depositCents: invoice.depositCents.toString(),
    balanceCents: invoice.balanceCents.toString(),
    currency: invoice.currency,
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    paidCents: paymentSummary ? paymentSummary.paidCents.toString() : '0',
    remainingCents: paymentSummary ? paymentSummary.remainingCents.toString() : invoice.totalCents.toString(),
    paymentStatus: paymentSummary ? paymentSummary.status : 'UNPAID',
    lastPaidAt: paymentSummary?.lastPaidAt ? paymentSummary.lastPaidAt.toISOString() : null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}/invoices
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  const invoices = await prisma.invoice.findMany({
    where: { businessId: businessIdBigInt, projectId: projectIdBigInt },
    orderBy: { createdAt: 'desc' },
  });

  const invoiceIds = invoices.map((inv) => inv.id);
  const paymentGroups = invoiceIds.length
    ? await prisma.payment.groupBy({
        by: ['invoiceId'],
        where: {
          businessId: businessIdBigInt,
          projectId: projectIdBigInt,
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

  return withIdNoStore(
    jsonNoStore({
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
        return serialize(inv, summary);
      }),
    }),
    requestId
  );
}
