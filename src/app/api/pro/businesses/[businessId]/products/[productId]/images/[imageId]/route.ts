import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { readLocalFile, deleteLocalFile } from '@/server/storage/local';

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

async function getImage(businessId: bigint, productId: bigint, imageId: bigint) {
  return prisma.productImage.findFirst({
    where: { id: imageId, productId, businessId },
  });
}

// GET serve image
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string; imageId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, productId, imageId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  const imgId = parseId(imageId);
  if (!b || !p || !imgId) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const image = await getImage(b, p, imgId);
  if (!image) return withIdNoStore(notFound('Image introuvable.'), requestId);
  const buffer = await readLocalFile(image.storageKey).catch(() => null);
  if (!buffer) return withIdNoStore(notFound('Fichier introuvable.'), requestId);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': image.mimeType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// DELETE image
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string; imageId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId, imageId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  const imgId = parseId(imageId);
  if (!b || !p || !imgId) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:images:delete:${b}:${p}:${imgId}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const image = await getImage(b, p, imgId);
  if (!image) return withIdNoStore(notFound('Image introuvable.'), requestId);

  await prisma.productImage.delete({ where: { id: imgId } });
  await deleteLocalFile(image.storageKey).catch(() => null);

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}

// PATCH alt/position
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string; imageId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId, imageId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  const imgId = parseId(imageId);
  if (!b || !p || !imgId) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const updates: Record<string, unknown> = {};
  if ('alt' in body) {
    if (body.alt === null) updates.alt = null;
    else if (typeof body.alt === 'string') updates.alt = body.alt.trim();
    else return withIdNoStore(badRequest('alt invalide.'), requestId);
  }
  if ('position' in body) {
    if (body.position === null) updates.position = 0;
    else if (typeof body.position === 'number' && Number.isFinite(body.position)) updates.position = Math.trunc(body.position);
    else return withIdNoStore(badRequest('position invalide.'), requestId);
  }
  if (Object.keys(updates).length === 0) return withIdNoStore(badRequest('Aucune mise à jour.'), requestId);

  const image = await getImage(b, p, imgId);
  if (!image) return withIdNoStore(notFound('Image introuvable.'), requestId);

  const updated = await prisma.productImage.update({ where: { id: imgId }, data: updates });

  return withIdNoStore(
    NextResponse.json({
      id: updated.id.toString(),
      alt: updated.alt,
      position: updated.position,
    }),
    requestId
  );
}
