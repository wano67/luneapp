import { NextRequest, NextResponse } from 'next/server';
import { ProductUnit } from '@/generated/prisma/client';
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

function serializeProduct(
  product: Awaited<ReturnType<typeof prisma.product.findFirst>>,
  stock?: number
) {
  if (!product) return null;
  return {
    id: product.id.toString(),
    businessId: product.businessId.toString(),
    sku: product.sku,
    name: product.name,
    description: product.description,
    unit: product.unit,
    salePriceCents: product.salePriceCents ? product.salePriceCents.toString() : null,
    purchasePriceCents: product.purchasePriceCents ? product.purchasePriceCents.toString() : null,
    isArchived: product.isArchived,
    stock: stock ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function computeStock(productId: bigint) {
  const movements = await prisma.inventoryMovement.findMany({
    where: { productId },
    select: { type: true, quantity: true },
  });
  let total = 0;
  for (const m of movements) {
    if (m.type === 'IN') total += m.quantity;
    else if (m.type === 'OUT') total -= m.quantity;
    else total += m.quantity;
  }
  return total;
}

// GET /api/pro/businesses/{businessId}/products/{productId}
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

  const stock = await computeStock(productIdBigInt);

  return withIdNoStore(jsonNoStore({ product: serializeProduct(product, stock) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/products/{productId}
export async function PATCH(
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
    key: `pro:products:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const product = await prisma.product.findFirst({
    where: { id: productIdBigInt, businessId: businessIdBigInt },
  });
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  const data: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);
  const parseBigInt = (v: unknown) => {
    if (v === null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === 'string' && v.trim() && /^\d+$/.test(v.trim())) return BigInt(v.trim());
    return undefined;
  };

  const sku = str((body as { sku?: unknown }).sku);
  if (sku !== undefined) {
    if (!sku) return withIdNoStore(badRequest('SKU requis.'), requestId);
    if (sku.length > 100) return withIdNoStore(badRequest('SKU trop long (100 max).'), requestId);
    const skuLower = sku.toLowerCase();
    const exists = await prisma.product.findFirst({
      where: { businessId: businessIdBigInt, skuLower, id: { not: productIdBigInt } },
    });
    if (exists) return withIdNoStore(badRequest('SKU déjà utilisé pour ce business.'), requestId);
    data.sku = sku;
    data.skuLower = skuLower;
  }

  const name = str((body as { name?: unknown }).name);
  if (name !== undefined) {
    if (!name) return withIdNoStore(badRequest('Nom requis.'), requestId);
    if (name.length > 200) return withIdNoStore(badRequest('Nom trop long (200 max).'), requestId);
    data.name = name;
  }

  const description = (body as { description?: unknown }).description;
  if (description !== undefined) {
    if (typeof description === 'string') data.description = description.trim() || null;
    else if (description === null) data.description = null;
    else return withIdNoStore(badRequest('description invalide.'), requestId);
  }

  const unitRaw = (body as { unit?: unknown }).unit;
  if (unitRaw !== undefined) {
    if (typeof unitRaw !== 'string' || !Object.values(ProductUnit).includes(unitRaw as ProductUnit)) {
      return withIdNoStore(badRequest('unit invalide.'), requestId);
    }
    data.unit = unitRaw;
  }

  const salePriceRaw = (body as { salePriceCents?: unknown }).salePriceCents;
  const parsedSale = parseBigInt(salePriceRaw);
  if (salePriceRaw !== undefined) {
    if (parsedSale === undefined) return withIdNoStore(badRequest('salePriceCents invalide.'), requestId);
    data.salePriceCents = parsedSale;
  }

  const purchasePriceRaw = (body as { purchasePriceCents?: unknown }).purchasePriceCents;
  const parsedPurchase = parseBigInt(purchasePriceRaw);
  if (purchasePriceRaw !== undefined) {
    if (parsedPurchase === undefined) return withIdNoStore(badRequest('purchasePriceCents invalide.'), requestId);
    data.purchasePriceCents = parsedPurchase;
  }

  const isArchivedRaw = (body as { isArchived?: unknown }).isArchived;
  if (isArchivedRaw !== undefined) {
    if (typeof isArchivedRaw !== 'boolean') return withIdNoStore(badRequest('isArchived invalide.'), requestId);
    data.isArchived = isArchivedRaw;
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucun champ valide fourni.'), requestId);
  }

  const updated = await prisma.product.update({
    where: { id: productIdBigInt },
    data,
  });

  return withIdNoStore(jsonNoStore({ product: serializeProduct(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/products/{productId}
export async function DELETE(
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
    key: `pro:products:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const product = await prisma.product.findFirst({
    where: { id: productIdBigInt, businessId: businessIdBigInt },
  });
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  await prisma.product.update({
    where: { id: productIdBigInt },
    data: { isArchived: true },
  });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
