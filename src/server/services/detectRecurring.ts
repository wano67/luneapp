import { prisma } from '@/server/db/client';

export type RecurringCandidate = {
  label: string;
  estimatedAmountCents: bigint;
  estimatedFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  occurrences: number;
  lastSeen: Date;
  categoryId: bigint | null;
  categoryName: string | null;
};

/**
 * Normalise un label de transaction pour regroupement.
 * Supprime dates, codes CB, numéros de référence, etc.
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

/**
 * Calcule la médiane d'un tableau de bigints (valeurs absolues).
 */
function medianAbs(values: bigint[]): bigint {
  const sorted = values.map((v) => (v < 0n ? -v : v)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2n
    : sorted[mid];
}

/**
 * Déduit la fréquence à partir de l'intervalle moyen en jours.
 */
function classifyFrequency(avgDays: number): 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | null {
  if (avgDays >= 5 && avgDays <= 10) return 'WEEKLY';
  if (avgDays >= 25 && avgDays <= 35) return 'MONTHLY';
  if (avgDays >= 80 && avgDays <= 100) return 'QUARTERLY';
  if (avgDays >= 340 && avgDays <= 400) return 'YEARLY';
  return null;
}

/**
 * Détecte les transactions récurrentes sur les 12 derniers mois.
 * Exclut les abonnements déjà enregistrés (match par label).
 */
export async function detectRecurringTransactions(
  userId: bigint,
): Promise<RecurringCandidate[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);

  // 1. Récupérer toutes les dépenses des 12 derniers mois
  const transactions = await prisma.personalTransaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: since },
    },
    select: {
      label: true,
      amountCents: true,
      date: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  });

  // 2. Grouper par label normalisé
  const groups = new Map<string, Array<{
    amountCents: bigint;
    date: Date;
    categoryId: bigint | null;
    categoryName: string | null;
  }>>();

  for (const tx of transactions) {
    const key = normalizeLabel(tx.label);
    if (!key || key.length < 3) continue;

    const arr = groups.get(key);
    const entry = {
      amountCents: tx.amountCents,
      date: tx.date,
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? null,
    };
    if (arr) arr.push(entry);
    else groups.set(key, [entry]);
  }

  // 3. Analyser chaque groupe
  const candidates: RecurringCandidate[] = [];

  for (const [label, entries] of groups) {
    if (entries.length < 3) continue; // Au moins 3 occurrences pour être significatif

    // Calculer l'intervalle moyen entre transactions
    const dates = entries.map((e) => e.date.getTime()).sort((a, b) => a - b);
    let totalIntervalMs = 0;
    for (let i = 1; i < dates.length; i++) {
      totalIntervalMs += dates[i] - dates[i - 1];
    }
    const avgIntervalDays = totalIntervalMs / (dates.length - 1) / (1000 * 60 * 60 * 24);

    const frequency = classifyFrequency(avgIntervalDays);
    if (!frequency) continue;

    // Médiane des montants
    const amounts = entries.map((e) => e.amountCents);
    const estimatedAmount = medianAbs(amounts);

    // Catégorie la plus fréquente
    const lastEntry = entries[entries.length - 1];

    candidates.push({
      label,
      estimatedAmountCents: estimatedAmount,
      estimatedFrequency: frequency,
      occurrences: entries.length,
      lastSeen: new Date(dates[dates.length - 1]),
      categoryId: lastEntry.categoryId,
      categoryName: lastEntry.categoryName,
    });
  }

  // 4. Filtrer les abonnements déjà enregistrés
  const existingSubs = await prisma.personalSubscription.findMany({
    where: { userId, isActive: true },
    select: { name: true },
  });
  const subNames = new Set(existingSubs.map((s) => s.name.toLowerCase()));

  const filtered = candidates.filter((c) => !subNames.has(c.label));

  // 5. Trier par coût mensuel estimé (desc)
  filtered.sort((a, b) => {
    const aCost = toMonthlyCents(a.estimatedAmountCents, a.estimatedFrequency);
    const bCost = toMonthlyCents(b.estimatedAmountCents, b.estimatedFrequency);
    return bCost > aCost ? 1 : bCost < aCost ? -1 : 0;
  });

  return filtered;
}

function toMonthlyCents(amountCents: bigint, freq: string): bigint {
  switch (freq) {
    case 'WEEKLY': return (amountCents * 52n) / 12n;
    case 'QUARTERLY': return amountCents / 3n;
    case 'YEARLY': return amountCents / 12n;
    default: return amountCents;
  }
}
