import { NextRequest, NextResponse } from 'next/server';
import { FinanceType, InventoryMovementType } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
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

function serializeMovement(movement: Awaited<ReturnType<typeof prisma.inventoryMovement.findFirst>>) {
  if (!movement) return null;
  return {
    id: movement.id.toString(),
    businessId: movement.businessId.toString(),
    productId: movement.productId.toString(),
    type: movement.type,
    source: movement.source,
    quantity: movement.quantity,
    unitCostCents: movement.unitCostCents ? movement.unitCostCents.toString() : null,
    reason: movement.reason,
    date: movement.date.toISOString(),
    createdByUserId: movement.createdByUserId ? movement.createdByUserId.toString() : null,
    createdAt: movement.createdAt.toISOString(),
    updatedAt: movement.updatedAt.toISOString(),
  };
}

// PATCH /api/pro/businesses/{businessId}/products/{productId}/movements/{movementId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string; movementId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId, movementId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const productIdBigInt = parseId(productId);
  const movementIdBigInt = parseId(movementId);
  if (!businessIdBigInt || !productIdBigInt || !movementIdBigInt) {
    return withIdNoStore(badRequest('IDs invalides.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:movements:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const movement = await prisma.inventoryMovement.findFirst({
    where: { id: movementIdBigInt, productId: productIdBigInt, businessId: businessIdBigInt },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          purchasePriceCents: true,
          salePriceCents: true,
        },
      },
      financeEntry: {
        select: {
          id: true,
          type: true,
        },
      },
    },
  });
  if (!movement) return withIdNoStore(notFound('Mouvement introuvable.'), requestId);

  const data: Record<string, unknown> = {};
  const quantityRaw = (body as { quantity?: unknown }).quantity;
  if (quantityRaw !== undefined) {
    if (typeof quantityRaw !== 'number' || !Number.isFinite(quantityRaw)) {
      return withIdNoStore(badRequest('quantity invalide.'), requestId);
    }
    const q = Math.trunc(quantityRaw);
    if (movement.type !== InventoryMovementType.ADJUST && q <= 0) {
      return withIdNoStore(badRequest('quantity doit être > 0 pour IN/OUT.'), requestId);
    }
    if (movement.type === InventoryMovementType.ADJUST && q === 0) {
      return withIdNoStore(badRequest('quantity ne peut pas être 0 pour ADJUST.'), requestId);
    }
    data.quantity = q;
  }

  const reason = (body as { reason?: unknown }).reason;
  if (reason !== undefined) {
    if (typeof reason !== 'string') return withIdNoStore(badRequest('reason invalide.'), requestId);
    data.reason = reason;
  }

  const dateRaw = (body as { date?: unknown }).date;
  if (dateRaw !== undefined) {
    if (typeof dateRaw !== 'string' || !dateRaw.trim()) {
      return withIdNoStore(badRequest('date invalide.'), requestId);
    }
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) return withIdNoStore(badRequest('date invalide.'), requestId);
    data.date = d;
  }

  const unitCostRaw = (body as { unitCostCents?: unknown }).unitCostCents;
  if (unitCostRaw !== undefined) {
    const parsed =
      typeof unitCostRaw === 'number' && Number.isFinite(unitCostRaw)
        ? BigInt(Math.trunc(unitCostRaw))
        : typeof unitCostRaw === 'string' && unitCostRaw.trim() && /^\d+$/.test(unitCostRaw.trim())
          ? BigInt(unitCostRaw.trim())
          : null;
    if (parsed === null) {
      return withIdNoStore(badRequest('unitCostCents invalide.'), requestId);
    }
    data.unitCostCents = parsed;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucun champ valide fourni.'), requestId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMovement = await tx.inventoryMovement.update({
      where: { id: movementIdBigInt },
      data,
    });

    if (movement.financeEntry) {
      const amountPerUnit =
        (data.unitCostCents as bigint | undefined) ??
        updatedMovement.unitCostCents ??
        movement.product.purchasePriceCents ??
        movement.product.salePriceCents ??
        BigInt(0);
      const amount = amountPerUnit * BigInt(Math.abs(updatedMovement.quantity));
      await tx.finance.update({
        where: { inventoryMovementId: movementIdBigInt },
        data: {
          amountCents: amount,
          date: updatedMovement.date,
          inventoryProductId: movement.productId,
          category: movement.financeEntry.type === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
          note: JSON.stringify({
            auto: true,
            source: 'inventory_movement',
            productId: movement.productId.toString(),
            productName: movement.product.name,
            movementId: movementIdBigInt.toString(),
            movementType: updatedMovement.type,
            sku: movement.product.sku,
            quantity: updatedMovement.quantity,
            unitCostCents: amountPerUnit.toString(),
          }),
        },
      });
    }

    return updatedMovement;
  });

  return withIdNoStore(jsonNoStore({ movement: serializeMovement(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/products/{productId}/movements/{movementId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string; movementId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId, movementId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const productIdBigInt = parseId(productId);
  const movementIdBigInt = parseId(movementId);
  if (!businessIdBigInt || !productIdBigInt || !movementIdBigInt) {
    return withIdNoStore(badRequest('IDs invalides.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:movements:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const movement = await prisma.inventoryMovement.findFirst({
    where: { id: movementIdBigInt, productId: productIdBigInt, businessId: businessIdBigInt },
  });
  if (!movement) return withIdNoStore(notFound('Mouvement introuvable.'), requestId);

  await prisma.$transaction(async (tx) => {
    await tx.finance.deleteMany({ where: { inventoryMovementId: movementIdBigInt } });
    await tx.inventoryMovement.delete({ where: { id: movementIdBigInt } });
  });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
