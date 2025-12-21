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

function serializeProduct(product: Awaited<ReturnType<typeof prisma.product.findFirst>>) {
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
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/products
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

  const searchParams = new URL(request.url).searchParams;
  const includeArchived = searchParams.get('archived') === '1';

  const products = await prisma.product.findMany({
    where: { businessId: businessIdBigInt, ...(includeArchived ? {} : { isArchived: false }) },
    orderBy: { createdAt: 'desc' },
  });

  return withIdNoStore(jsonNoStore({ items: products.map(serializeProduct) }), requestId);
}

// POST /api/pro/businesses/{businessId}/products
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:create:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const parseBigInt = (v: unknown) => {
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
    if (typeof v === 'string' && v.trim() && /^\d+$/.test(v.trim())) return BigInt(v.trim());
    return null;
  };

  const sku = str((body as { sku?: unknown }).sku);
  const name = str((body as { name?: unknown }).name);
  const descriptionRaw = (body as { description?: unknown }).description;
  const unitRaw = (body as { unit?: unknown }).unit;
  const salePriceRaw = (body as { salePriceCents?: unknown }).salePriceCents;
  const purchasePriceRaw = (body as { purchasePriceCents?: unknown }).purchasePriceCents;

  if (!sku) return withIdNoStore(badRequest('SKU requis.'), requestId);
  if (!name) return withIdNoStore(badRequest('Nom requis.'), requestId);
  if (sku.length > 100) return withIdNoStore(badRequest('SKU trop long (100 max).'), requestId);
  if (name.length > 200) return withIdNoStore(badRequest('Nom trop long (200 max).'), requestId);

  const unit = unitRaw && typeof unitRaw === 'string' && Object.values(ProductUnit).includes(unitRaw as ProductUnit)
    ? (unitRaw as ProductUnit)
    : ProductUnit.PIECE;

  const salePriceCents = salePriceRaw !== undefined ? parseBigInt(salePriceRaw) : null;
  const purchasePriceCents = purchasePriceRaw !== undefined ? parseBigInt(purchasePriceRaw) : null;
  const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() || null : null;

  const skuLower = sku.toLowerCase();
  const exists = await prisma.product.findFirst({
    where: { businessId: businessIdBigInt, skuLower },
  });
  if (exists) return withIdNoStore(badRequest('SKU déjà utilisé pour ce business.'), requestId);

  const product = await prisma.product.create({
    data: {
      businessId: businessIdBigInt,
      sku,
      skuLower,
      name,
      description,
      unit,
      salePriceCents: salePriceCents ?? undefined,
      purchasePriceCents: purchasePriceCents ?? undefined,
    },
  });

  return withIdNoStore(jsonNoStore({ product: serializeProduct(product) }, { status: 201 }), requestId);
}
