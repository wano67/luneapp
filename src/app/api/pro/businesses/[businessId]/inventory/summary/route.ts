import { NextRequest, NextResponse } from 'next/server';
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

  const rows = products.map((p) => {
    let stock = 0;
    let lastMovementAt: Date | null = null;
    for (const m of p.movements) {
      if (m.type === 'IN') stock += m.quantity;
      else if (m.type === 'OUT') stock -= m.quantity;
      else stock += m.quantity;
      if (!lastMovementAt || m.date > lastMovementAt) lastMovementAt = m.date;
    }
    return {
      productId: p.id.toString(),
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      stock,
      salePriceCents: p.salePriceCents ? p.salePriceCents.toString() : null,
      purchasePriceCents: p.purchasePriceCents ? p.purchasePriceCents.toString() : null,
      lastMovementAt: lastMovementAt ? lastMovementAt.toISOString() : null,
    };
  });

  return withIdNoStore(jsonNoStore({ items: rows }), requestId);
}
