import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/payment-links/{linkId}
export const PATCH = withBusinessRoute<{ businessId: string; linkId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const linkId = parseIdOpt(params?.linkId);
    if (!linkId) return badRequest('linkId invalide.');

    const existing = await prisma.paymentLink.findFirst({
      where: { id: linkId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Lien introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
    if ('status' in b) {
      const s = b.status as string;
      if (['ACTIVE', 'CANCELLED'].includes(s)) data.status = s;
    }
    if ('description' in b && typeof b.description === 'string') {
      data.description = b.description.trim().slice(0, 500) || null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.paymentLink.update({
      where: { id: linkId },
      data,
      include: {
        invoice: { select: { number: true } },
        client: { select: { name: true } },
      },
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        token: updated.token,
        amountCents: updated.amountCents,
        currency: updated.currency,
        description: updated.description,
        status: updated.status,
        invoiceNumber: updated.invoice?.number ?? null,
        clientName: updated.client?.name ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        paidAt: updated.paidAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        payUrl: `/pay/${updated.token}`,
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/payment-links/{linkId}
export const DELETE = withBusinessRoute<{ businessId: string; linkId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const linkId = parseIdOpt(params?.linkId);
    if (!linkId) return badRequest('linkId invalide.');

    const existing = await prisma.paymentLink.findFirst({
      where: { id: linkId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Lien introuvable.');

    await prisma.paymentLink.delete({ where: { id: linkId } });
    return jsonbNoContent(ctx.requestId);
  },
);
