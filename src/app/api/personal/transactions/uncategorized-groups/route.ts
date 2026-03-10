import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { rateLimit } from '@/server/security/rateLimit';

/**
 * Normalise un label de transaction pour regroupement.
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\d{2}[/\-]\d{2}[/\-]?\d{0,4}/g, '')
    .replace(/\b(cb|carte|vir(ement)?|prlv|prelevement|cheque|chq)\b/gi, '')
    .replace(/\b[a-z0-9]{16,}\b/g, '')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// GET /api/personal/transactions/uncategorized-groups
export const GET = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:uncat-groups:${ctx.userId}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  // Fetch all uncategorized transactions
  const uncategorized = await prisma.personalTransaction.findMany({
    where: { userId: ctx.userId, categoryId: null },
    select: { id: true, label: true, amountCents: true, date: true },
    orderBy: { date: 'desc' },
  });

  // Group by normalized label
  const groups = new Map<string, {
    normalizedLabel: string;
    sampleLabels: string[];
    count: number;
    totalAbsCents: bigint;
    lastDate: Date;
  }>();

  for (const tx of uncategorized) {
    const key = normalizeLabel(tx.label);
    if (!key || key.length < 3) continue;

    const existing = groups.get(key);
    const abs = tx.amountCents < 0n ? -tx.amountCents : tx.amountCents;

    if (existing) {
      existing.count++;
      existing.totalAbsCents += abs;
      if (!existing.sampleLabels.includes(tx.label) && existing.sampleLabels.length < 3) {
        existing.sampleLabels.push(tx.label);
      }
      if (tx.date > existing.lastDate) existing.lastDate = tx.date;
    } else {
      groups.set(key, {
        normalizedLabel: key,
        sampleLabels: [tx.label],
        count: 1,
        totalAbsCents: abs,
        lastDate: tx.date,
      });
    }
  }

  // Filter groups with 2+ occurrences, sort by count desc
  const items = Array.from(groups.values())
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((g) => ({
      normalizedLabel: g.normalizedLabel,
      sampleLabel: g.sampleLabels[0],
      count: g.count,
      avgAmountCents: g.totalAbsCents / BigInt(g.count),
      lastDate: g.lastDate.toISOString(),
    }));

  return jsonb({ items }, ctx.requestId);
});
