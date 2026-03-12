import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_DAYS = 5;

type SuggestedMatch = {
  financeId: string;
  paymentId: string;
  confidence: 'high' | 'medium';
  financeLabel: string;
  financeAmountCents: string;
  financeDate: string;
  paymentAmountCents: string;
  paymentDate: string;
  paymentReference: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
};

// GET /api/pro/businesses/{businessId}/reconciliation
// Returns unreconciled finances, payments, and suggested matches
export const GET = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:reconciliation:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 1000,
    },
  },
  async (ctx) => {
    const bId = ctx.businessId;

    // Get unreconciled income finances (potential bank deposits)
    const unreconciledFinances = await prisma.finance.findMany({
      where: { businessId: bId, reconciled: false, deletedAt: null, type: 'INCOME' },
      select: {
        id: true, amountCents: true, date: true, category: true, vendor: true,
        note: true, pieceRef: true, method: true,
      },
      orderBy: { date: 'desc' },
      take: 200,
    });

    // Get all payments (potential matches)
    const payments = await prisma.payment.findMany({
      where: { businessId: bId, deletedAt: null },
      select: {
        id: true, amountCents: true, paidAt: true, method: true, reference: true,
        invoice: { select: { number: true, totalCents: true } },
        client: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
      take: 200,
    });

    // Get reconciled count
    const reconciledCount = await prisma.finance.count({
      where: { businessId: bId, reconciled: true, deletedAt: null },
    });

    // Auto-suggest matches: same amount within MATCH_WINDOW_DAYS
    const suggestions: SuggestedMatch[] = [];
    const usedPaymentIds = new Set<string>();

    for (const fin of unreconciledFinances) {
      for (const pay of payments) {
        if (usedPaymentIds.has(pay.id.toString())) continue;

        const amountMatch = fin.amountCents === pay.amountCents;
        if (!amountMatch) continue;

        const daysDiff = Math.abs(fin.date.getTime() - pay.paidAt.getTime()) / DAY_MS;
        if (daysDiff > MATCH_WINDOW_DAYS) continue;

        const confidence: 'high' | 'medium' = daysDiff <= 1 ? 'high' : 'medium';

        suggestions.push({
          financeId: fin.id.toString(),
          paymentId: pay.id.toString(),
          confidence,
          financeLabel: fin.vendor || fin.category || '—',
          financeAmountCents: fin.amountCents.toString(),
          financeDate: fin.date.toISOString(),
          paymentAmountCents: pay.amountCents.toString(),
          paymentDate: pay.paidAt.toISOString(),
          paymentReference: pay.reference,
          invoiceNumber: pay.invoice.number,
          clientName: pay.client?.name ?? null,
        });

        usedPaymentIds.add(pay.id.toString());
        break; // One match per finance entry
      }
    }

    return jsonb({
      unreconciledCount: unreconciledFinances.length,
      reconciledCount,
      suggestions,
      unreconciled: unreconciledFinances.map((f) => ({
        id: f.id.toString(),
        amountCents: f.amountCents.toString(),
        date: f.date.toISOString(),
        label: f.vendor || f.category || '—',
        method: f.method,
        pieceRef: f.pieceRef,
      })),
    }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/reconciliation
// Confirm a reconciliation match or manually reconcile
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:reconciliation:confirm:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const { financeId, paymentId, action } = body as Record<string, unknown>;

    const finId = parseIdOpt(financeId as string);
    if (!finId) return badRequest('financeId invalide.');

    const finance = await prisma.finance.findFirst({
      where: { id: finId, businessId: ctx.businessId, deletedAt: null },
    });
    if (!finance) return badRequest('Écriture introuvable.');

    if (action === 'unreconcile') {
      await prisma.finance.update({
        where: { id: finId },
        data: { reconciled: false, reconciledAt: null, reconciledPaymentId: null },
      });
      return jsonb({ ok: true, reconciled: false }, ctx.requestId);
    }

    // Reconcile with or without a payment
    let payId: bigint | null = null;
    if (paymentId) {
      payId = parseIdOpt(paymentId as string);
      if (payId) {
        const payment = await prisma.payment.findFirst({
          where: { id: payId, businessId: ctx.businessId, deletedAt: null },
          select: { id: true },
        });
        if (!payment) return badRequest('Paiement introuvable.');
      }
    }

    await prisma.finance.update({
      where: { id: finId },
      data: {
        reconciled: true,
        reconciledAt: new Date(),
        reconciledPaymentId: payId,
      },
    });

    return jsonb({ ok: true, reconciled: true }, ctx.requestId);
  },
);
