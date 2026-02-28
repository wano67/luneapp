import { InventoryReservationStatus } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

// GET /api/pro/businesses/{businessId}/inventory/summary
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const products = await prisma.product.findMany({
    where: { businessId: ctx.businessId, isArchived: false },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      salePriceCents: true,
      purchasePriceCents: true,
      createdAt: true,
      updatedAt: true,
      movements: {
        select: { type: true, quantity: true, date: true },
        orderBy: { date: 'desc' },
      },
    },
  });

  const reservations = await prisma.inventoryReservationItem.findMany({
    where: { reservation: { businessId: ctx.businessId, status: InventoryReservationStatus.ACTIVE } },
    select: { productId: true, quantity: true },
  });
  const reservedByProduct = new Map<bigint, number>();
  for (const r of reservations) {
    reservedByProduct.set(r.productId, (reservedByProduct.get(r.productId) ?? 0) + r.quantity);
  }

  const rows = products.map((p) => {
    let onHand = 0;
    let lastMovementAt: Date | null = null;
    for (const m of p.movements) {
      if (m.type === 'IN') onHand += m.quantity;
      else if (m.type === 'OUT') onHand -= m.quantity;
      else onHand += m.quantity;
      if (!lastMovementAt || m.date > lastMovementAt) lastMovementAt = m.date;
    }
    const reserved = reservedByProduct.get(p.id) ?? 0;
    const available = onHand - reserved;
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock: onHand,
      onHand,
      reserved,
      available,
      salePriceCents: p.salePriceCents,
      purchasePriceCents: p.purchasePriceCents,
      lastMovementAt,
    };
  });

  return jsonb({ items: rows }, ctx.requestId);
});
