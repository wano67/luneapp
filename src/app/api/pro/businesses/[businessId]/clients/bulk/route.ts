import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

function parseIdSoft(param: unknown) {
  if (typeof param !== 'string' || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// POST /api/pro/businesses/{businessId}/clients/bulk
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:clients:bulk:${ctx.businessId}`,
      limit: 60,
      windowMs: 10 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const action = (body as { action?: string }).action;
    if (action !== 'ARCHIVE' && action !== 'UNARCHIVE' && action !== 'DELETE' && action !== 'ANONYMIZE') {
      return badRequest('Action invalide (ARCHIVE|UNARCHIVE|DELETE|ANONYMIZE).');
    }

    const clientIdsRaw = Array.isArray((body as { clientIds?: unknown }).clientIds)
      ? ((body as { clientIds: unknown[] }).clientIds ?? [])
      : [];
    const clientIds = Array.from(
      new Set(
        clientIdsRaw
          .map((id) => parseIdSoft(id))
          .filter((id): id is bigint => id !== null)
      )
    );

    if (clientIds.length === 0) {
      return badRequest('clientIds requis.');
    }

    if (action === 'DELETE') {
      const clients = await prisma.client.findMany({
        where: { businessId: ctx.businessId, id: { in: clientIds } },
        select: { id: true, archivedAt: true },
      });
      const clientIdsFound = clients.map((c) => c.id.toString());

      const invoiceCounts = await prisma.invoice.groupBy({
        by: ['clientId'],
        where: { businessId: ctx.businessId, clientId: { in: clientIds } },
        _count: true,
      });
      const quotesCounts = await prisma.quote.groupBy({
        by: ['clientId'],
        where: { businessId: ctx.businessId, clientId: { in: clientIds } },
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
          where: { businessId: ctx.businessId, id: { in: deletable } },
        });
        deletedCount = deleted.count;
      }

      return jsonb({ deletedCount, failed }, ctx.requestId);
    }

    if (action === 'ANONYMIZE') {
      const reasonRaw = typeof (body as { reason?: unknown }).reason === 'string' ? (body as { reason?: string }).reason?.trim() : '';
      const clients = await prisma.client.findMany({
        where: { businessId: ctx.businessId, id: { in: clientIds } },
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
              where: { id: c.id, businessId: ctx.businessId },
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
                anonymizedByUserId: ctx.userId,
                anonymizationReason: reasonRaw || null,
              },
            })
          )
        );
        anonymizedCount = toAnonymize.length;
      }

      return jsonb({ anonymizedCount, failed }, ctx.requestId);
    }

    const now = new Date();
    const result = await prisma.client.updateMany({
      where: {
        businessId: ctx.businessId,
        id: { in: clientIds },
      },
      data: {
        archivedAt: action === 'ARCHIVE' ? now : null,
      },
    });

    return jsonb({ updatedCount: result.count, action }, ctx.requestId);
  }
);
