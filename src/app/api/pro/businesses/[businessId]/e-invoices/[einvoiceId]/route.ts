import { prisma } from '@/server/db/client';
import { EInvoiceStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_STATUSES = Object.values(EInvoiceStatus);

const include = {
  invoice: { select: { number: true, totalCents: true, client: { select: { name: true } } } },
} as const;

// PATCH /api/pro/businesses/{businessId}/e-invoices/{einvoiceId}
export const PATCH = withBusinessRoute<{ businessId: string; einvoiceId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const eid = parseIdOpt(params?.einvoiceId);
    if (!eid) return badRequest('einvoiceId invalide.');

    const existing = await prisma.eInvoice.findFirst({
      where: { id: eid, businessId: ctx.businessId },
    });
    if (!existing) return notFound('E-facture introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    if ('status' in b && VALID_STATUSES.includes(b.status as EInvoiceStatus)) {
      data.status = b.status;
      if (b.status === 'TRANSMITTED') data.transmittedAt = new Date();
      if (b.status === 'ACCEPTED') data.acceptedAt = new Date();
      if (b.status === 'REJECTED') {
        data.rejectedAt = new Date();
        if (typeof b.rejectionReason === 'string') {
          data.rejectionReason = b.rejectionReason.trim().slice(0, 500) || null;
        }
      }
    }

    if ('siren' in b && typeof b.siren === 'string') {
      data.siren = b.siren.trim().slice(0, 20) || null;
    }
    if ('recipientSiren' in b && typeof b.recipientSiren === 'string') {
      data.recipientSiren = b.recipientSiren.trim().slice(0, 20) || null;
    }
    if ('pdpTrackingId' in b && typeof b.pdpTrackingId === 'string') {
      data.pdpTrackingId = b.pdpTrackingId.trim().slice(0, 100) || null;
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.eInvoice.update({
      where: { id: eid },
      data,
      include,
    });

    return jsonb({
      item: {
        id: updated.id.toString(),
        invoiceId: updated.invoiceId.toString(),
        format: updated.format,
        status: updated.status,
        pdpTrackingId: updated.pdpTrackingId,
        siren: updated.siren,
        recipientSiren: updated.recipientSiren,
        transmittedAt: updated.transmittedAt?.toISOString() ?? null,
        acceptedAt: updated.acceptedAt?.toISOString() ?? null,
        rejectedAt: updated.rejectedAt?.toISOString() ?? null,
        rejectionReason: updated.rejectionReason,
        invoiceNumber: updated.invoice?.number ?? null,
        invoiceTotalCents: Number(updated.invoice?.totalCents ?? 0),
        clientName: updated.invoice?.client?.name ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/e-invoices/{einvoiceId}
export const DELETE = withBusinessRoute<{ businessId: string; einvoiceId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const eid = parseIdOpt(params?.einvoiceId);
    if (!eid) return badRequest('einvoiceId invalide.');

    const existing = await prisma.eInvoice.findFirst({
      where: { id: eid, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('E-facture introuvable.');

    await prisma.eInvoice.delete({ where: { id: eid } });
    return jsonbNoContent(ctx.requestId);
  },
);
