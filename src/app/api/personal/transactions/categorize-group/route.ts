import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseId } from '@/server/http/parsers';
import { clearRuleCache } from '@/server/services/autoCategorize';

/**
 * Normalise un label de transaction pour le matching (même logique que partout).
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

// POST /api/personal/transactions/categorize-group
// Body: { pattern: string, categoryId: string }
// 1. Creates a CategoryRule (CONTAINS) so future transactions are auto-categorized
// 2. Updates all uncategorized transactions matching the pattern
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:cat-group:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const pattern = typeof body.pattern === 'string' ? body.pattern.trim().toLowerCase() : '';
  if (!pattern || pattern.length < 2) return badRequest('pattern requis (2 caractères min).');

  let categoryId: bigint;
  try {
    categoryId = parseId(String(body.categoryId));
  } catch {
    return badRequest('categoryId invalide.');
  }

  // Validate category belongs to user
  const cat = await prisma.personalCategory.findFirst({
    where: { id: categoryId, userId: ctx.userId },
    select: { id: true },
  });
  if (!cat) return badRequest('Catégorie introuvable.');

  // 1. Create or update the CategoryRule
  const existingRule = await prisma.categoryRule.findFirst({
    where: { userId: ctx.userId, pattern },
    select: { id: true },
  });

  if (existingRule) {
    await prisma.categoryRule.update({
      where: { id: existingRule.id },
      data: { categoryId, matchType: 'CONTAINS' },
    });
  } else {
    await prisma.categoryRule.create({
      data: {
        userId: ctx.userId,
        categoryId,
        pattern,
        matchType: 'CONTAINS',
        priority: 10, // higher than default
      },
    });
  }

  clearRuleCache();

  // 2. Find and update all uncategorized transactions matching pattern
  const uncategorized = await prisma.personalTransaction.findMany({
    where: { userId: ctx.userId, categoryId: null },
    select: { id: true, label: true },
  });

  const matchingIds: bigint[] = [];
  for (const tx of uncategorized) {
    const normalized = normalizeLabel(tx.label);
    if (normalized.includes(pattern)) {
      matchingIds.push(tx.id);
    }
  }

  let updatedCount = 0;
  if (matchingIds.length > 0) {
    const result = await prisma.personalTransaction.updateMany({
      where: { id: { in: matchingIds } },
      data: { categoryId },
    });
    updatedCount = result.count;
  }

  return jsonb({ updatedCount, ruleCreated: !existingRule }, ctx.requestId);
});
