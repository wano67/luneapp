import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function serialize(l: {
  id: bigint; businessId: bigint; invoiceId: bigint | null; clientId: bigint | null;
  token: string; amountCents: number; currency: string; description: string | null;
  status: string; expiresAt: Date | null; paidAt: Date | null; createdAt: Date;
  invoice?: { number: string | null } | null;
  client?: { name: string } | null;
}) {
  return {
    id: l.id.toString(),
    token: l.token,
    amountCents: l.amountCents,
    currency: l.currency,
    description: l.description,
    status: l.status,
    invoiceNumber: l.invoice?.number ?? null,
    clientName: l.client?.name ?? null,
    expiresAt: l.expiresAt?.toISOString() ?? null,
    paidAt: l.paidAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    payUrl: `/pay/${l.token}`,
  };
}

const include = {
  invoice: { select: { number: true } },
  client: { select: { name: true } },
} as const;

// GET /api/pro/businesses/{businessId}/payment-links
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.paymentLink.findMany({
      where: { businessId: ctx.businessId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/payment-links
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:paylinks:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { amountCents, description, invoiceId, clientId, expiresAt } = body as Record<string, unknown>;

    if (typeof amountCents !== 'number' || amountCents <= 0) return badRequest('amountCents requis (> 0).');

    let invoiceIdBigInt: bigint | null = null;
    if (invoiceId) {
      invoiceIdBigInt = parseIdOpt(invoiceId as string);
      if (invoiceIdBigInt) {
        const inv = await prisma.invoice.findFirst({
          where: { id: invoiceIdBigInt, businessId: ctx.businessId },
          select: { id: true },
        });
        if (!inv) return badRequest('Facture introuvable.');
      }
    }

    let clientIdBigInt: bigint | null = null;
    if (clientId) {
      clientIdBigInt = parseIdOpt(clientId as string);
      if (clientIdBigInt) {
        const cl = await prisma.client.findFirst({
          where: { id: clientIdBigInt, businessId: ctx.businessId },
          select: { id: true },
        });
        if (!cl) return badRequest('Client introuvable.');
      }
    }

    const item = await prisma.paymentLink.create({
      data: {
        businessId: ctx.businessId,
        invoiceId: invoiceIdBigInt,
        clientId: clientIdBigInt,
        amountCents: Math.trunc(amountCents),
        description: typeof description === 'string' ? description.trim().slice(0, 500) || null : null,
        expiresAt: typeof expiresAt === 'string' ? new Date(expiresAt) : null,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
