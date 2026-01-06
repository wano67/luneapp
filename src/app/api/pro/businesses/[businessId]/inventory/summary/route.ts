import { NextRequest, NextResponse } from 'next/server';
import { InventoryReservationStatus } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

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

// GET /api/pro/businesses/{businessId}/inventory/summary
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const products = await prisma.product.findMany({
    where: { businessId: businessIdBigInt, isArchived: false },
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
    where: { reservation: { businessId: businessIdBigInt, status: InventoryReservationStatus.ACTIVE } },
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
      productId: p.id.toString(),
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock: onHand,
      onHand,
      reserved,
      available,
      salePriceCents: p.salePriceCents ? p.salePriceCents.toString() : null,
      purchasePriceCents: p.purchasePriceCents ? p.purchasePriceCents.toString() : null,
      lastMovementAt: lastMovementAt ? lastMovementAt.toISOString() : null,
    };
  });

  return withIdNoStore(jsonNoStore({ items: rows }), requestId);
}
