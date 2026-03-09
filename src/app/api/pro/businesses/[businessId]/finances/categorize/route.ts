import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { categorizeBatch, type CategorizationInput } from '@/server/services/ocr';
import { findCategoryByCode, computeVat } from '@/config/pcg';
import { upsertLedgerForFinance } from '@/server/services/financeToLedger';

// POST /api/pro/businesses/{businessId}/finances/categorize
// Body: { ids: string[] } — list of finance IDs to auto-categorize
// Or body: { all: true } — categorize all uncategorized entries
export const POST = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `finance-categorize:${ctx.businessId}`, limit: 10, windowMs: 3_600_000 } },
  async (ctx, request) => {
    const { requestId, businessId } = ctx;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const idsRaw = (body as { ids?: unknown }).ids;
    const allMode = (body as { all?: unknown }).all === true;

    // Find finances to categorize
    const finances = await prisma.finance.findMany({
      where: {
        businessId,
        deletedAt: null,
        ...(allMode
          ? { accountCode: null }
          : Array.isArray(idsRaw)
            ? { id: { in: idsRaw.map((id: string) => BigInt(id)) } }
            : {}),
      },
      select: {
        id: true,
        category: true,
        vendor: true,
        type: true,
        amountCents: true,
        accountCode: true,
      },
      take: 50,
    });

    if (finances.length === 0) {
      return jsonb({ updated: 0, results: [] }, requestId);
    }

    // Prepare input for AI
    const inputs: CategorizationInput[] = finances.map(f => ({
      id: f.id.toString(),
      category: f.category,
      vendor: f.vendor,
      type: f.type as 'INCOME' | 'EXPENSE',
      amountCents: f.amountCents.toString(),
    }));

    const results = await categorizeBatch(inputs);
    if (!results || results.length !== finances.length) {
      return badRequest('L\'IA n\'a pas pu classifier les écritures. Réessayez.');
    }

    // Update each finance with its new accountCode + regenerate ledger
    let updated = 0;
    const details: Array<{ id: string; accountCode: string; label: string; confidence: number }> = [];

    for (let i = 0; i < finances.length; i++) {
      const finance = finances[i];
      const result = results[i];
      if (!result || result.confidence < 30) continue;

      const pcg = findCategoryByCode(result.accountCode);
      if (!pcg) continue;

      // Compute vatCents if finance has a vatRate
      const vatRate = 2000; // default 20% if not set
      const vat = computeVat(finance.amountCents, vatRate);

      await prisma.$transaction(async (tx) => {
        await tx.finance.update({
          where: { id: finance.id },
          data: {
            accountCode: result.accountCode,
            category: result.label,
            vatRate: finance.accountCode ? undefined : vatRate,
            vatCents: finance.accountCode ? undefined : vat.tvaCents,
          },
        });

        await upsertLedgerForFinance(tx, {
          id: finance.id,
          businessId,
          type: finance.type as 'INCOME' | 'EXPENSE',
          amountCents: finance.amountCents,
          accountCode: result.accountCode,
          vatRate,
          vatCents: vat.tvaCents,
          pieceRef: null,
          category: result.label,
          vendor: finance.vendor,
          date: new Date(),
        });
      });

      updated++;
      details.push({
        id: finance.id.toString(),
        accountCode: result.accountCode,
        label: result.label,
        confidence: result.confidence,
      });
    }

    return jsonb({ updated, results: details }, requestId);
  }
);
