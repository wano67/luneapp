import { prisma } from '@/server/db/client';
import { StoreOrderStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_STATUSES = Object.values(StoreOrderStatus);

// PATCH /api/pro/businesses/{businessId}/store/orders/{orderId}
export const PATCH = withBusinessRoute<{ businessId: string; orderId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const oid = parseIdOpt(params?.orderId);
    if (!oid) return badRequest('orderId invalide.');

    const existing = await prisma.storeOrder.findFirst({
      where: { id: oid, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Commande introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    if ('status' in b && VALID_STATUSES.includes(b.status as StoreOrderStatus)) {
      data.status = b.status;
      if (b.status === 'SHIPPED') data.shippedAt = new Date();
    }
    if ('trackingNumber' in b && typeof b.trackingNumber === 'string') {
      data.trackingNumber = b.trackingNumber.trim().slice(0, 100) || null;
    }
    if ('note' in b) {
      data.note = typeof b.note === 'string' ? b.note.trim().slice(0, 1000) || null : null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.storeOrder.update({
      where: { id: oid },
      data,
      include: {
        items: {
          include: { storeProduct: { select: { name: true } } },
        },
      },
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        orderNumber: updated.orderNumber,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        totalCents: updated.totalCents,
        status: updated.status,
        paidAt: updated.paidAt?.toISOString() ?? null,
        shippedAt: updated.shippedAt?.toISOString() ?? null,
        trackingNumber: updated.trackingNumber,
        note: updated.note,
        createdAt: updated.createdAt.toISOString(),
        items: updated.items.map((i) => ({
          id: i.id.toString(),
          productName: i.storeProduct.name,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
        })),
      },
    }, ctx.requestId);
  },
);
