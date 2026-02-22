import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { InvoiceStatus, Prisma } from '@/generated/prisma';
import { computeOutstanding } from '@/lib/accounting';

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

function toNumber(value: bigint | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

// GET /api/pro/businesses/:businessId/accounting/client/:clientId/summary
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; clientId: string }> },
) {
  const requestId = getRequestId(request);
  const { businessId, clientId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const clientIdBigInt = parseId(clientId);
  if (!businessIdBigInt || !clientIdBigInt) {
    return withIdNoStore(badRequest('businessId ou clientId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const client = await prisma.client.findFirst({
    where: { id: clientIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!client) return withIdNoStore(notFound('Client introuvable'), requestId);

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const baseWhere: Prisma.InvoiceWhereInput = {
    businessId: businessIdBigInt,
    clientId: clientIdBigInt,
    status: { not: InvoiceStatus.CANCELLED },
    OR: [{ issuedAt: { gte: twelveMonthsAgo } }, { issuedAt: null, createdAt: { gte: twelveMonthsAgo } }],
  };

  const [agg, paidAgg, invoices, paidInvoices] = await Promise.all([
    prisma.invoice.aggregate({
      where: baseWhere,
      _sum: { totalCents: true },
    }),
    prisma.invoice.aggregate({
      where: { ...baseWhere, status: InvoiceStatus.PAID },
      _sum: { totalCents: true },
    }),
    prisma.invoice.findMany({
      where: baseWhere,
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: { project: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { ...baseWhere, status: InvoiceStatus.PAID, paidAt: { not: null } },
      orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
      take: 10,
    }),
  ]);

  const invoicedCents = toNumber(agg._sum?.totalCents);
  const paidCents = toNumber(paidAgg._sum?.totalCents);
  const outstandingCents = computeOutstanding(invoicedCents, paidCents);

  return withIdNoStore(
    jsonNoStore({
      totals: { invoicedCents, paidCents, outstandingCents },
      invoices: invoices.map((inv) => ({
        id: inv.id.toString(),
        number: inv.number ?? `INV-${inv.id}`,
        status: inv.status,
        totalCents: Number(inv.totalCents),
        currency: inv.currency,
        issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
        dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
        projectName: (inv as typeof inv & { project?: { name: string | null } | null }).project?.name ?? null,
      })),
      payments: paidInvoices.map((inv) => ({
        id: inv.id.toString(),
        amountCents: Number(inv.totalCents),
        currency: inv.currency,
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
        reference: inv.number ?? `INV-${inv.id}`,
      })),
    }),
    requestId,
  );
}
