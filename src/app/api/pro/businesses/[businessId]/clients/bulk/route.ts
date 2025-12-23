import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: unknown) {
  if (typeof param !== 'string' || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withNoStore(withRequestId(csrf, requestId));

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withNoStore(withRequestId(badRequest('businessId invalide.'), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) {
    return withNoStore(withRequestId(badRequest('Forbidden'), requestId));
  }

  const limited = rateLimit(request, {
    key: `pro:clients:bulk:${businessIdBigInt}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return withNoStore(withRequestId(limited, requestId));

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withNoStore(withRequestId(badRequest('Payload invalide.'), requestId));
  }

  const action = (body as { action?: string }).action;
  if (action !== 'ARCHIVE' && action !== 'UNARCHIVE' && action !== 'DELETE' && action !== 'ANONYMIZE') {
    return withNoStore(withRequestId(badRequest('Action invalide (ARCHIVE|UNARCHIVE|DELETE|ANONYMIZE).'), requestId));
  }

  const clientIdsRaw = Array.isArray((body as { clientIds?: unknown }).clientIds)
    ? ((body as { clientIds: unknown[] }).clientIds ?? [])
    : [];
  const clientIds = Array.from(
    new Set(
      clientIdsRaw
        .map((id) => parseId(id))
        .filter((id): id is bigint => id !== null)
    )
  );

  if (clientIds.length === 0) {
    return withNoStore(withRequestId(badRequest('clientIds requis.'), requestId));
  }

  if (action === 'DELETE') {
    const clients = await prisma.client.findMany({
      where: { businessId: businessIdBigInt, id: { in: clientIds } },
      select: { id: true, archivedAt: true },
    });
    const clientIdsFound = clients.map((c) => c.id.toString());

    const invoiceCounts = await prisma.invoice.groupBy({
      by: ['clientId'],
      where: { businessId: businessIdBigInt, clientId: { in: clientIds } },
      _count: true,
    });
    const quotesCounts = await prisma.quote.groupBy({
      by: ['clientId'],
      where: { businessId: businessIdBigInt, clientId: { in: clientIds } },
      _count: true,
    });

    const invoiceMap = new Map<string, number>();
    invoiceCounts.forEach((row) => {
      if (row.clientId != null) invoiceMap.set(row.clientId.toString(), row._count);
    });
    const quoteMap = new Map<string, number>();
    quotesCounts.forEach((row) => {
      if (row.clientId != null) quoteMap.set(row.clientId.toString(), row._count);
    });

    const deletable: bigint[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const c of clients) {
      const idStr = c.id.toString();
      if (!c.archivedAt) {
        failed.push({ id: idStr, reason: 'Client must be archived first' });
        continue;
      }
      if ((invoiceMap.get(idStr) ?? 0) > 0) {
        failed.push({ id: idStr, reason: 'Client has invoices' });
        continue;
      }
      if ((quoteMap.get(idStr) ?? 0) > 0) {
        failed.push({ id: idStr, reason: 'Client has quotes' });
        continue;
      }
      deletable.push(c.id);
    }

    // mark unknown ids as failed
    clientIds.forEach((id) => {
      const asStr = id.toString();
      if (!clientIdsFound.includes(asStr)) {
        failed.push({ id: asStr, reason: 'Client not found' });
      }
    });

    let deletedCount = 0;
    if (deletable.length) {
      const deleted = await prisma.client.deleteMany({
        where: { businessId: businessIdBigInt, id: { in: deletable } },
      });
      deletedCount = deleted.count;
    }

    return withNoStore(
      withRequestId(
        jsonNoStore({
          deletedCount,
          failed,
        }),
        requestId
      )
    );
  }

  if (action === 'ANONYMIZE') {
    const reasonRaw = typeof (body as { reason?: unknown }).reason === 'string' ? (body as { reason?: string }).reason?.trim() : '';
    const clients = await prisma.client.findMany({
      where: { businessId: businessIdBigInt, id: { in: clientIds } },
      select: { id: true, archivedAt: true, name: true },
    });
    const clientIdsFound = clients.map((c) => c.id.toString());
    const failed: Array<{ id: string; reason: string }> = [];
    const toAnonymize = clients.filter((c) => {
      if (!c.archivedAt) {
        failed.push({ id: c.id.toString(), reason: 'Client must be archived first' });
        return false;
      }
      return true;
    });

    clientIds.forEach((id) => {
      const asStr = id.toString();
      if (!clientIdsFound.includes(asStr)) {
        failed.push({ id: asStr, reason: 'Client not found' });
      }
    });

    let anonymizedCount = 0;
    const now = new Date();
    if (toAnonymize.length) {
      await Promise.all(
        toAnonymize.map((c) =>
          prisma.client.update({
            where: { id: c.id, businessId: businessIdBigInt },
            data: {
              name: 'Client anonymisé',
              email: null,
              phone: null,
              websiteUrl: null,
              companyName: null,
              mainContactName: null,
              address: null,
              sector: null,
              needsType: null,
              notes: null,
              categoryReferenceId: null,
              tags: { deleteMany: { clientId: c.id } },
              anonymizedAt: now,
              anonymizedByUserId: BigInt(userId),
              anonymizationReason: reasonRaw || null,
            },
          })
        )
      );
      anonymizedCount = toAnonymize.length;
    }

    return withNoStore(
      withRequestId(
        jsonNoStore({
          anonymizedCount,
          failed,
        }),
        requestId
      )
    );
  }

  const now = new Date();
  const result = await prisma.client.updateMany({
    where: {
      businessId: businessIdBigInt,
      id: { in: clientIds },
    },
    data: {
      archivedAt: action === 'ARCHIVE' ? now : null,
    },
  });

  return withNoStore(
    withRequestId(
      jsonNoStore({
        updatedCount: result.count,
        action,
      }),
      requestId
    )
  );
}
