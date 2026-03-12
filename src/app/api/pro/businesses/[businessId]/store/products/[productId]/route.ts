import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/store/products/{productId}
export const PATCH = withBusinessRoute<{ businessId: string; productId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const pid = parseIdOpt(params?.productId);
    if (!pid) return badRequest('productId invalide.');

    const existing = await prisma.storeProduct.findFirst({
      where: { id: pid, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Produit introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('name' in b && typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 200);
    if ('description' in b) data.description = typeof b.description === 'string' ? b.description.trim().slice(0, 2000) || null : null;
    if ('priceCents' in b && typeof b.priceCents === 'number') data.priceCents = Math.trunc(b.priceCents);
    if ('imageUrl' in b) data.imageUrl = typeof b.imageUrl === 'string' ? b.imageUrl.trim().slice(0, 500) || null : null;
    if ('isPublished' in b && typeof b.isPublished === 'boolean') data.isPublished = b.isPublished;
    if ('stockCount' in b && typeof b.stockCount === 'number') data.stockCount = Math.trunc(b.stockCount);

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.storeProduct.update({
      where: { id: pid },
      data,
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        productId: updated.productId?.toString() ?? null,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        priceCents: updated.priceCents,
        currency: updated.currency,
        imageUrl: updated.imageUrl,
        isPublished: updated.isPublished,
        stockCount: updated.stockCount,
        createdAt: updated.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/store/products/{productId}
export const DELETE = withBusinessRoute<{ businessId: string; productId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const pid = parseIdOpt(params?.productId);
    if (!pid) return badRequest('productId invalide.');

    const existing = await prisma.storeProduct.findFirst({
      where: { id: pid, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Produit introuvable.');

    await prisma.storeProduct.delete({ where: { id: pid } });
    return jsonbNoContent(ctx.requestId);
  },
);
