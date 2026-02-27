import { ProductUnit } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseCentsInput } from '@/lib/money';

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// GET /api/pro/businesses/{businessId}/products
// ---------------------------------------------------------------------------

export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
  const includeArchived = new URL(req.url).searchParams.get('archived') === '1';
  const products = await prisma.product.findMany({
    where: { businessId: ctx.businessId, ...(includeArchived ? {} : { isArchived: false }) },
    orderBy: { createdAt: 'desc' },
  });
  return jsonb({ items: products.map(serializeProduct) }, ctx.requestId);
});

// ---------------------------------------------------------------------------
// POST /api/pro/businesses/{businessId}/products
// ---------------------------------------------------------------------------

export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:create:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
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

    const unit =
      unitRaw && typeof unitRaw === 'string' && Object.values(ProductUnit).includes(unitRaw as ProductUnit)
        ? (unitRaw as ProductUnit)
        : ProductUnit.PIECE;

    const salePriceParsed = salePriceRaw !== undefined ? parseCentsInput(salePriceRaw) : null;
    const purchasePriceParsed = purchasePriceRaw !== undefined ? parseCentsInput(purchasePriceRaw) : null;
    const salePriceCents = salePriceParsed != null ? BigInt(salePriceParsed) : null;
    const purchasePriceCents = purchasePriceParsed != null ? BigInt(purchasePriceParsed) : null;
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

    return jsonbCreated({ item: serializeProduct(product) }, requestId);
  }
);
