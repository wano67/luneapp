import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { saveLocalFile } from '@/server/storage/local';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

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

async function ensureProduct(businessId: bigint, productId: bigint) {
  return prisma.product.findFirst({ where: { id: productId, businessId }, select: { id: true } });
}

// GET list images
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, productId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  if (!b || !p) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const product = await ensureProduct(b, p);
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  const items = await prisma.productImage.findMany({
    where: { businessId: b, productId: p },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  return withIdNoStore(
    jsonNoStore({
      items: items.map((img) => ({
        id: img.id.toString(),
        url: `/api/pro/businesses/${businessId}/products/${productId}/images/${img.id.toString()}`,
        alt: img.alt,
        position: img.position,
        mimeType: img.mimeType,
        createdAt: img.createdAt.toISOString(),
      })),
    }),
    requestId
  );
}

// POST upload
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  if (!b || !p) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:images:create:${b}:${p}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const product = await ensureProduct(b, p);
  if (!product) return withIdNoStore(notFound('Produit introuvable.'), requestId);

  const form = await request.formData().catch(() => null);
  if (!form) return withIdNoStore(badRequest('FormData requis.'), requestId);
  const file = form.get('file');
  if (!(file instanceof File)) return withIdNoStore(badRequest('Fichier requis.'), requestId);
  if (file.size === 0) return withIdNoStore(badRequest('Fichier vide.'), requestId);
  if (file.size > MAX_UPLOAD_BYTES) return withIdNoStore(badRequest('Fichier trop volumineux (5MB max).'), requestId);
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.includes(mime)) return withIdNoStore(badRequest('Type non autorisé (png/jpg/webp).'), requestId);

  const altRaw = form.get('alt');
  const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storageKey } = await saveLocalFile({
    buffer,
    filename: file.name,
    businessId: b,
    productId: p,
  });

  const maxPos = await prisma.productImage.aggregate({
    where: { businessId: b, productId: p },
    _max: { position: true },
  });
  const nextPosition = (maxPos._max.position ?? 0) + 1;

  const created = await prisma.productImage.create({
    data: {
      businessId: b,
      productId: p,
      storageKey,
      mimeType: mime,
      alt,
      position: nextPosition,
    },
  });

  return withIdNoStore(
    NextResponse.json(
      {
        id: created.id.toString(),
        url: `/api/pro/businesses/${businessId}/products/${productId}/images/${created.id.toString()}`,
        alt: created.alt,
        position: created.position,
        mimeType: created.mimeType,
      },
      { status: 201 }
    ),
    requestId
  );
}
