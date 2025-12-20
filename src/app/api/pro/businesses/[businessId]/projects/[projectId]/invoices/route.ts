import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';

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

function serialize(invoice: Awaited<ReturnType<typeof prisma.invoice.findFirst>>) {
  if (!invoice) return null;
  return {
    id: invoice.id.toString(),
    businessId: invoice.businessId.toString(),
    projectId: invoice.projectId.toString(),
    clientId: invoice.clientId ? invoice.clientId.toString() : null,
    quoteId: invoice.quoteId ? invoice.quoteId.toString() : null,
    status: invoice.status,
    totalCents: invoice.totalCents.toString(),
    depositCents: invoice.depositCents.toString(),
    balanceCents: invoice.balanceCents.toString(),
    currency: invoice.currency,
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
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

  return withIdNoStore(jsonNoStore({ items: invoices.map(serialize) }), requestId);
}
