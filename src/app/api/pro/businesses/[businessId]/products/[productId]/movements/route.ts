import { NextRequest, NextResponse } from 'next/server';
import { FinanceType, InventoryMovementSource, InventoryMovementType } from '@/generated/prisma/client';
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

// GET /api/pro/businesses/{businessId}/products/{productId}/movements
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, productId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const productIdBigInt = parseId(productId);
  if (!businessIdBigInt || !productIdBigInt) {
    return withIdNoStore(badRequest('businessId ou productId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const product = await prisma.product.findFirst({
    where: { id: productIdBigInt, businessId: businessIdBigInt },
  });
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  const movements = await prisma.inventoryMovement.findMany({
    where: { productId: productIdBigInt, businessId: businessIdBigInt },
    orderBy: { date: 'desc' },
  });

  return withIdNoStore(
    jsonNoStore({ items: movements.map((m) => serializeMovement(m)) }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/products/{productId}/movements
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const productIdBigInt = parseId(productId);
  if (!businessIdBigInt || !productIdBigInt) {
    return withIdNoStore(badRequest('businessId ou productId invalide.'), requestId);
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
    key: `pro:products:movements:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const typeRaw = (body as { type?: unknown }).type;
  if (typeof typeRaw !== 'string' || !Object.values(InventoryMovementType).includes(typeRaw as InventoryMovementType)) {
    return withIdNoStore(badRequest('type invalide.'), requestId);
  }
  const type = typeRaw as InventoryMovementType;

  const sourceRaw = (body as { source?: unknown }).source;
  const source =
    typeof sourceRaw === 'string' && Object.values(InventoryMovementSource).includes(sourceRaw as InventoryMovementSource)
      ? (sourceRaw as InventoryMovementSource)
      : InventoryMovementSource.MANUAL;

  const quantityRaw = (body as { quantity?: unknown }).quantity;
  if (typeof quantityRaw !== 'number' || !Number.isFinite(quantityRaw)) {
    return withIdNoStore(badRequest('quantity invalide.'), requestId);
  }
  if (type !== 'ADJUST' && quantityRaw <= 0) {
    return withIdNoStore(badRequest('quantity doit être > 0 pour IN/OUT.'), requestId);
  }
  if (type === 'ADJUST' && quantityRaw === 0) {
    return withIdNoStore(badRequest('quantity ne peut pas être 0 pour ADJUST.'), requestId);
  }
  const quantity = Math.trunc(quantityRaw);

  const unitCostRaw = (body as { unitCostCents?: unknown }).unitCostCents;
  const unitCostCents =
    typeof unitCostRaw === 'number' && Number.isFinite(unitCostRaw)
      ? BigInt(Math.trunc(unitCostRaw))
      : typeof unitCostRaw === 'string' && unitCostRaw.trim() && /^\d+$/.test(unitCostRaw.trim())
        ? BigInt(unitCostRaw.trim())
        : null;
  if (unitCostRaw !== undefined && unitCostCents === null) {
    return withIdNoStore(badRequest('unitCostCents invalide.'), requestId);
  }

  const reason = typeof (body as { reason?: unknown }).reason === 'string' ? (body as { reason: string }).reason : null;
  const dateRaw = (body as { date?: unknown }).date;
  const date = typeof dateRaw === 'string' && dateRaw.trim() ? new Date(dateRaw) : new Date();
  if (Number.isNaN(date.getTime())) {
    return withIdNoStore(badRequest('date invalide.'), requestId);
  }

  const createFinanceEntry = (body as { createFinanceEntry?: unknown }).createFinanceEntry === true;
  const financeTypeRaw = (body as { financeType?: unknown }).financeType;
  const financeType =
    financeTypeRaw === 'INCOME' || financeTypeRaw === 'EXPENSE'
      ? (financeTypeRaw as FinanceType)
      : type === 'IN'
        ? FinanceType.EXPENSE
        : type === 'OUT'
          ? FinanceType.INCOME
          : null;

  const product = await prisma.product.findFirst({
    where: { id: productIdBigInt, businessId: businessIdBigInt },
  });
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryMovement.create({
      data: {
        businessId: businessIdBigInt,
        productId: productIdBigInt,
        type,
        source,
        quantity,
        unitCostCents: unitCostCents ?? undefined,
        reason: reason ?? undefined,
        date,
        createdByUserId: BigInt(userId),
      },
    });

    if (createFinanceEntry && financeType) {
      const amountPerUnit =
        unitCostCents ??
        product.purchasePriceCents ??
        product.salePriceCents ??
        BigInt(0);
      const amount = amountPerUnit * BigInt(Math.abs(quantity));
      await tx.finance.upsert({
        where: { inventoryMovementId: created.id },
        create: {
          businessId: businessIdBigInt,
          type: financeType,
          amountCents: amount,
          category: financeType === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
          date,
          inventoryMovementId: created.id,
          inventoryProductId: productIdBigInt,
          note: JSON.stringify({
            auto: true,
            source: 'inventory_movement',
            productId: productIdBigInt.toString(),
            productName: product.name,
            movementId: created.id.toString(),
            movementType: type,
            sku: product.sku,
            quantity,
            unitCostCents: amountPerUnit.toString(),
          }),
        },
        update: {
          type: financeType,
          amountCents: amount,
          category: financeType === FinanceType.EXPENSE ? 'INVENTORY' : 'PRODUCT_SALE',
          date,
          inventoryProductId: productIdBigInt,
          note: JSON.stringify({
            auto: true,
            source: 'inventory_movement',
            productId: productIdBigInt.toString(),
            productName: product.name,
            movementId: created.id.toString(),
            movementType: type,
            sku: product.sku,
            quantity,
            unitCostCents: amountPerUnit.toString(),
          }),
        },
      });
    }

    return created;
  });

  return withIdNoStore(jsonNoStore({ movement: serializeMovement(movement) }, { status: 201 }), requestId);
}
