import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { readLocalFile, deleteLocalFile } from '@/server/storage/local';

async function getImage(businessId: bigint, productId: bigint, imageId: bigint) {
  return prisma.productImage.findFirst({
    where: { id: imageId, productId, businessId },
  });
}

// GET serve image (binary response)
export const GET = withBusinessRoute<{ businessId: string; productId: string; imageId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const productId = parseId(params.productId);
    const imageId = parseId(params.imageId);

    const image = await getImage(ctx.businessId, productId, imageId);
    if (!image) return notFound('Image introuvable.');
    const buffer = await readLocalFile(image.storageKey).catch(() => null);
    if (!buffer) return notFound('Fichier introuvable.');

    const res = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': image.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    res.headers.set('x-request-id', ctx.requestId);
    return res;
  }
);

// DELETE image
export const DELETE = withBusinessRoute<{ businessId: string; productId: string; imageId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:images:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const productId = parseId(params.productId);
    const imageId = parseId(params.imageId);

    const image = await getImage(ctx.businessId, productId, imageId);
    if (!image) return notFound('Image introuvable.');

    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteLocalFile(image.storageKey).catch(() => null);

    return jsonbNoContent(ctx.requestId);
  }
);

// PATCH alt/position
export const PATCH = withBusinessRoute<{ businessId: string; productId: string; imageId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const productId = parseId(params.productId);
    const imageId = parseId(params.imageId);

    const body = await readJson(req);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const updates: Record<string, unknown> = {};
    if ('alt' in body) {
      if ((body as Record<string, unknown>).alt === null) updates.alt = null;
      else if (typeof (body as Record<string, unknown>).alt === 'string') updates.alt = ((body as Record<string, unknown>).alt as string).trim();
      else return badRequest('alt invalide.');
    }
    if ('position' in body) {
      const pos = (body as Record<string, unknown>).position;
      if (pos === null) updates.position = 0;
      else if (typeof pos === 'number' && Number.isFinite(pos)) updates.position = Math.trunc(pos);
      else return badRequest('position invalide.');
    }
    if (Object.keys(updates).length === 0) return badRequest('Aucune mise à jour.');

    const image = await getImage(ctx.businessId, productId, imageId);
    if (!image) return notFound('Image introuvable.');

    const updated = await prisma.productImage.update({ where: { id: imageId }, data: updates });

    return jsonb({
      item: {
        id: updated.id,
        alt: updated.alt,
        position: updated.position,
      },
    }, ctx.requestId);
  }
);
