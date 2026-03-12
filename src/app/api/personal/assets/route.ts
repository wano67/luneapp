import { prisma } from '@/server/db/client';
import { AssetType } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

const VALID_TYPES = Object.values(AssetType);

function serialize(a: {
  id: bigint; type: string; name: string; institution: string | null;
  purchasePrice: bigint | null; currentValue: bigint | null; quantity: number | null;
  currency: string; purchaseDate: Date | null; notes: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: a.id.toString(),
    type: a.type,
    name: a.name,
    institution: a.institution,
    purchasePriceCents: a.purchasePrice?.toString() ?? null,
    currentValueCents: a.currentValue?.toString() ?? null,
    quantity: a.quantity,
    currency: a.currency,
    purchaseDate: a.purchaseDate?.toISOString() ?? null,
    notes: a.notes,
    createdAt: a.createdAt.toISOString(),
  };
}

// GET /api/personal/assets
export const GET = withPersonalRoute(async (ctx) => {
  const items = await prisma.asset.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return jsonb({ items: items.map(serialize) }, ctx.requestId);
});

// POST /api/personal/assets
export const POST = withPersonalRoute(async (ctx, req) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

  const { type, name, institution, purchasePriceCents, currentValueCents, quantity, currency, purchaseDate, notes } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) return badRequest('name requis.');
  if (name.trim().length > 200) return badRequest('name trop long (200 max).');
  if (!VALID_TYPES.includes(type as AssetType)) return badRequest('type invalide.');

  const item = await prisma.asset.create({
    data: {
      userId: ctx.userId,
      type: type as AssetType,
      name: name.trim(),
      institution: typeof institution === 'string' ? institution.trim().slice(0, 200) || null : null,
      purchasePrice: typeof purchasePriceCents === 'number' ? BigInt(Math.trunc(purchasePriceCents)) : null,
      currentValue: typeof currentValueCents === 'number' ? BigInt(Math.trunc(currentValueCents)) : null,
      quantity: typeof quantity === 'number' ? quantity : null,
      currency: typeof currency === 'string' ? currency.trim().slice(0, 5) || 'EUR' : 'EUR',
      purchaseDate: typeof purchaseDate === 'string' ? new Date(purchaseDate) : null,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 2000) || null : null,
    },
  });

  return jsonbCreated({ item: serialize(item) }, ctx.requestId);
});
