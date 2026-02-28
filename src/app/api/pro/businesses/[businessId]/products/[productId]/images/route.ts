import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { saveLocalFile } from '@/server/storage/local';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

async function ensureProduct(businessId: bigint, productId: bigint) {
  return prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
}

// GET list images
export const GET = withBusinessRoute<{ businessId: string; productId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const productId = parseId(params.productId);

    const product = await ensureProduct(ctx.businessId, productId);
    if (!product) return notFound('Produit introuvable.');

    const items = await prisma.productImage.findMany({
      where: { businessId: ctx.businessId, productId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return jsonb({
      items: items.map((img) => ({
        id: img.id,
        url: `/api/pro/businesses/${ctx.businessId}/products/${productId}/images/${img.id}`,
        alt: img.alt,
        position: img.position,
        mimeType: img.mimeType,
        createdAt: img.createdAt,
      })),
    }, ctx.requestId);
  }
);

// POST upload
export const POST = withBusinessRoute<{ businessId: string; productId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:products:images:create:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const productId = parseId(params.productId);

    const product = await ensureProduct(ctx.businessId, productId);
    if (!product) return notFound('Produit introuvable.');

    const form = await req.formData().catch(() => null);
    if (!form) return badRequest('FormData requis.');
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('Fichier requis.');
    if (file.size === 0) return badRequest('Fichier vide.');
    if (file.size > MAX_UPLOAD_BYTES) return badRequest('Fichier trop volumineux (5MB max).');
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.includes(mime)) return badRequest('Type non autorisé (png/jpg/webp).');

    const altRaw = form.get('alt');
    const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await saveLocalFile({
      buffer,
      filename: file.name,
      businessId: ctx.businessId,
      productId,
    });

    const maxPos = await prisma.productImage.aggregate({
      where: { businessId: ctx.businessId, productId },
      _max: { position: true },
    });
    const nextPosition = (maxPos._max.position ?? 0) + 1;

    const created = await prisma.productImage.create({
      data: {
        businessId: ctx.businessId,
        productId,
        storageKey,
        mimeType: mime,
        alt,
        position: nextPosition,
      },
    });

    return jsonbCreated({
      item: {
        id: created.id,
        url: `/api/pro/businesses/${ctx.businessId}/products/${productId}/images/${created.id}`,
        alt: created.alt,
        position: created.position,
        mimeType: created.mimeType,
      },
    }, ctx.requestId);
  }
);
