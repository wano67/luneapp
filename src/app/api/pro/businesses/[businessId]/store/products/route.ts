import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

function serialize(p: {
  id: bigint; businessId: bigint; productId: bigint | null; name: string; slug: string;
  description: string | null; priceCents: number; currency: string; imageUrl: string | null;
  isPublished: boolean; stockCount: number; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id.toString(),
    productId: p.productId?.toString() ?? null,
    name: p.name,
    slug: p.slug,
    description: p.description,
    priceCents: p.priceCents,
    currency: p.currency,
    imageUrl: p.imageUrl,
    isPublished: p.isPublished,
    stockCount: p.stockCount,
    createdAt: p.createdAt.toISOString(),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

// GET /api/pro/businesses/{businessId}/store/products
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.storeProduct.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/store/products
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:store:products:create:${ctx.businessId}:${ctx.userId}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { name, description, priceCents, imageUrl, isPublished, stockCount } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) return badRequest('name requis.');
    if (name.trim().length > 200) return badRequest('name trop long (200 max).');
    if (typeof priceCents !== 'number' || priceCents < 0) return badRequest('priceCents requis (>= 0).');

    let slug = slugify(name);
    // Ensure unique slug
    const existing = await prisma.storeProduct.findUnique({
      where: { businessId_slug: { businessId: ctx.businessId, slug } },
    });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const item = await prisma.storeProduct.create({
      data: {
        businessId: ctx.businessId,
        name: name.trim(),
        slug,
        description: typeof description === 'string' ? description.trim().slice(0, 2000) || null : null,
        priceCents: Math.trunc(priceCents),
        imageUrl: typeof imageUrl === 'string' ? imageUrl.trim().slice(0, 500) || null : null,
        isPublished: typeof isPublished === 'boolean' ? isPublished : false,
        stockCount: typeof stockCount === 'number' ? Math.trunc(stockCount) : 0,
      },
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
