import { prisma } from '@/server/db/client';
import { EInvoiceFormat } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function serialize(e: {
  id: bigint; businessId: bigint; invoiceId: bigint; format: string;
  status: string; xmlPayload: string | null; pdpTrackingId: string | null;
  transmittedAt: Date | null; acceptedAt: Date | null; rejectedAt: Date | null;
  rejectionReason: string | null; siren: string | null; recipientSiren: string | null;
  createdAt: Date; updatedAt: Date;
  invoice?: { number: string | null; totalCents: bigint; client: { name: string } | null } | null;
}) {
  return {
    id: e.id.toString(),
    invoiceId: e.invoiceId.toString(),
    format: e.format,
    status: e.status,
    pdpTrackingId: e.pdpTrackingId,
    siren: e.siren,
    recipientSiren: e.recipientSiren,
    transmittedAt: e.transmittedAt?.toISOString() ?? null,
    acceptedAt: e.acceptedAt?.toISOString() ?? null,
    rejectedAt: e.rejectedAt?.toISOString() ?? null,
    rejectionReason: e.rejectionReason,
    invoiceNumber: e.invoice?.number ?? null,
    invoiceTotalCents: Number(e.invoice?.totalCents ?? 0),
    clientName: e.invoice?.client?.name ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

const include = {
  invoice: { select: { number: true, totalCents: true, client: { select: { name: true } } } },
} as const;

// GET /api/pro/businesses/{businessId}/e-invoices
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.eInvoice.findMany({
      where: { businessId: ctx.businessId },
      include,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

const VALID_FORMATS = Object.values(EInvoiceFormat);

// POST /api/pro/businesses/{businessId}/e-invoices
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:einvoices:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { invoiceId, format, siren, recipientSiren } = body as Record<string, unknown>;

    const invId = parseIdOpt(invoiceId as string);
    if (!invId) return badRequest('invoiceId requis.');

    const invoice = await prisma.invoice.findFirst({
      where: { id: invId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!invoice) return badRequest('Facture introuvable.');

    // Check no existing e-invoice for this invoice
    const existing = await prisma.eInvoice.findUnique({ where: { invoiceId: invId } });
    if (existing) return badRequest('Une e-facture existe déjà pour cette facture.');

    const fmt = VALID_FORMATS.includes(format as EInvoiceFormat)
      ? (format as EInvoiceFormat)
      : EInvoiceFormat.FACTUR_X;

    const item = await prisma.eInvoice.create({
      data: {
        businessId: ctx.businessId,
        invoiceId: invId,
        format: fmt,
        siren: typeof siren === 'string' ? siren.trim().slice(0, 20) || null : null,
        recipientSiren: typeof recipientSiren === 'string' ? recipientSiren.trim().slice(0, 20) || null : null,
      },
      include,
    });

    return jsonbCreated({ item: serialize(item) }, ctx.requestId);
  },
);
