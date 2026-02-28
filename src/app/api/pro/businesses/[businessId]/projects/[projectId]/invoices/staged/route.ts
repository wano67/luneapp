import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { computeProjectBillingSummary } from '@/server/billing/summary';
import { InvoiceStatus } from '@/generated/prisma';

function roundPercent(amount: bigint, percent: number) {
  return (amount * BigInt(Math.round(percent))) / BigInt(100);
}

type StagedMode = 'PERCENT' | 'AMOUNT' | 'FINAL';

// POST /api/pro/businesses/{businessId}/projects/{projectId}/invoices/staged
export const POST = withBusinessRoute<{ businessId: string; projectId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:invoices:staged:${ctx.businessId}:${ctx.userId}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);

    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const modeRaw = (body as { mode?: unknown }).mode;
    const valueRaw = (body as { value?: unknown }).value;
    if (typeof modeRaw !== 'string' || !['PERCENT', 'AMOUNT', 'FINAL'].includes(modeRaw)) {
      return badRequest('mode invalide.');
    }
    const mode = modeRaw as StagedMode;

    const summary = await computeProjectBillingSummary(ctx.businessId, projectId);
    if (!summary || summary.totalCents <= 0) {
      return badRequest('Total projet indisponible.');
    }
    const projectTotalCents = summary.totalCents;
    const currency = summary.currency;
    const clientId = summary.clientId ?? null;
    const remaining = summary.remainingCents;
    if (remaining <= 0) {
      return badRequest('Aucun montant restant à facturer.');
    }

    let amountCents: bigint;
    if (mode === 'FINAL') {
      amountCents = remaining;
    } else if (mode === 'PERCENT') {
      if (typeof valueRaw !== 'number' || !Number.isFinite(valueRaw)) {
        return badRequest('value invalide.');
      }
      if (valueRaw <= 0 || valueRaw > 100) {
        return badRequest('Le pourcentage doit être entre 1 et 100.');
      }
      amountCents = roundPercent(projectTotalCents, valueRaw);
    } else {
      if (typeof valueRaw !== 'number' || !Number.isFinite(valueRaw)) {
        return badRequest('value invalide.');
      }
      if (valueRaw <= 0) {
        return badRequest('Le montant doit être supérieur à 0.');
      }
      amountCents = BigInt(Math.trunc(valueRaw));
    }

    if (amountCents > remaining) {
      return badRequest('Montant supérieur au reste à facturer.');
    }

    const dueAt = new Date();
    const settings = await prisma.businessSettings.findUnique({
      where: { businessId: ctx.businessId },
      select: { paymentTermsDays: true },
    });
    if (settings?.paymentTermsDays) {
      dueAt.setDate(dueAt.getDate() + settings.paymentTermsDays);
    } else {
      dueAt.setDate(dueAt.getDate() + 30);
    }

    const label =
      mode === 'FINAL'
        ? 'Facture finale'
        : mode === 'PERCENT'
          ? `Situation de paiement (${valueRaw}%)`
          : 'Situation de paiement';

    const invoice = await prisma.invoice.create({
      data: {
        businessId: ctx.businessId,
        projectId,
        clientId: clientId ?? undefined,
        createdByUserId: ctx.userId,
        status: InvoiceStatus.DRAFT,
        depositPercent: 0,
        currency,
        totalCents: amountCents,
        depositCents: BigInt(0),
        balanceCents: amountCents,
        dueAt,
        items: {
          create: [
            {
              label,
              description: null,
              discountType: 'NONE',
              billingUnit: 'ONE_OFF',
              quantity: 1,
              unitPriceCents: amountCents,
              totalCents: amountCents,
            },
          ],
        },
      },
      include: { items: { orderBy: { id: 'asc' } } },
    });

    const basePath = `/api/pro/businesses/${params.businessId}/invoices/${invoice.id}`;

    return jsonb(
      {
        invoice,
        pdfUrl: `${basePath}/pdf`,
        downloadUrl: `${basePath}/pdf`,
      },
      ctx.requestId,
      { status: 201 }
    );
  }
);
