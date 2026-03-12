import { prisma } from '@/server/db/client';
import { AssetType } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

const VALID_TYPES = Object.values(AssetType);

// PATCH /api/personal/assets/{assetId}
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const assetId = parseId(req.url.split('/').at(-1));

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, userId: ctx.userId },
  });
  if (!existing) return notFound('Actif introuvable.');

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
  const b = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if ('name' in b && typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim().slice(0, 200);
  if ('type' in b && VALID_TYPES.includes(b.type as AssetType)) data.type = b.type;
  if ('institution' in b) data.institution = typeof b.institution === 'string' ? b.institution.trim().slice(0, 200) || null : null;
  if ('currentValueCents' in b && typeof b.currentValueCents === 'number') data.currentValue = BigInt(Math.trunc(b.currentValueCents));
  if ('quantity' in b && typeof b.quantity === 'number') data.quantity = b.quantity;
  if ('notes' in b) data.notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 2000) || null : null;

  if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data,
  });

  return jsonb({
    item: {
      id: updated.id.toString(),
      type: updated.type,
      name: updated.name,
      institution: updated.institution,
      purchasePriceCents: updated.purchasePrice?.toString() ?? null,
      currentValueCents: updated.currentValue?.toString() ?? null,
      quantity: updated.quantity,
      currency: updated.currency,
      purchaseDate: updated.purchaseDate?.toISOString() ?? null,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
    },
  }, ctx.requestId);
});

// DELETE /api/personal/assets/{assetId}
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const assetId = parseId(req.url.split('/').at(-1));

  const existing = await prisma.asset.findFirst({
    where: { id: assetId, userId: ctx.userId },
    select: { id: true },
  });
  if (!existing) return notFound('Actif introuvable.');

  await prisma.asset.delete({ where: { id: assetId } });
  return jsonbNoContent(ctx.requestId);
});
