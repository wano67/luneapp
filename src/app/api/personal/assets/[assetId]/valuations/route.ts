import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/personal/assets/{assetId}/valuations
export const GET = withPersonalRoute(async (ctx, req) => {
  const segments = req.url.split('/');
  const assetId = parseId(segments.at(-2)); // .../assets/{id}/valuations

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId: ctx.userId },
    select: { id: true },
  });
  if (!asset) return notFound('Actif introuvable.');

  const valuations = await prisma.assetValuation.findMany({
    where: { assetId },
    orderBy: { date: 'desc' },
    take: 100,
  });

  return jsonb({
    items: valuations.map((v) => ({
      id: v.id.toString(),
      valueCents: v.valueCents.toString(),
      date: v.date.toISOString(),
      createdAt: v.createdAt.toISOString(),
    })),
  }, ctx.requestId);
});

// POST /api/personal/assets/{assetId}/valuations
export const POST = withPersonalRoute(async (ctx, req) => {
  const segments = req.url.split('/');
  const assetId = parseId(segments.at(-2));

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId: ctx.userId },
    select: { id: true },
  });
  if (!asset) return notFound('Actif introuvable.');

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

  const { valueCents, date } = body as Record<string, unknown>;
  if (typeof valueCents !== 'number' || valueCents < 0) return badRequest('valueCents requis (>= 0).');

  const valuation = await prisma.assetValuation.create({
    data: {
      assetId,
      valueCents: BigInt(Math.trunc(valueCents)),
      date: typeof date === 'string' ? new Date(date) : new Date(),
    },
  });

  // Also update asset's currentValue
  await prisma.asset.update({
    where: { id: assetId },
    data: { currentValue: BigInt(Math.trunc(valueCents)) },
  });

  return jsonbCreated({
    item: {
      id: valuation.id.toString(),
      valueCents: valuation.valueCents.toString(),
      date: valuation.date.toISOString(),
      createdAt: valuation.createdAt.toISOString(),
    },
  }, ctx.requestId);
});
