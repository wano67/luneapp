import { prisma } from '@/server/db/client';

/**
 * Règles système de catégorisation par défaut (marchands français courants).
 * Utilisées en fallback quand aucune règle utilisateur ne matche.
 */
const SYSTEM_RULES: Array<{ pattern: string; categoryName: string }> = [
  // ─── Alimentation & Restauration ───
  { pattern: 'carrefour', categoryName: 'Alimentation & Restauration' },
  { pattern: 'leclerc', categoryName: 'Alimentation & Restauration' },
  { pattern: 'lidl', categoryName: 'Alimentation & Restauration' },
  { pattern: 'auchan', categoryName: 'Alimentation & Restauration' },
  { pattern: 'intermarche', categoryName: 'Alimentation & Restauration' },
  { pattern: 'monoprix', categoryName: 'Alimentation & Restauration' },
  { pattern: 'picard', categoryName: 'Alimentation & Restauration' },
  { pattern: 'franprix', categoryName: 'Alimentation & Restauration' },
  { pattern: 'casino', categoryName: 'Alimentation & Restauration' },
  { pattern: 'super u', categoryName: 'Alimentation & Restauration' },
  { pattern: 'systeme u', categoryName: 'Alimentation & Restauration' },
  { pattern: 'netto', categoryName: 'Alimentation & Restauration' },
  { pattern: 'aldi', categoryName: 'Alimentation & Restauration' },
  { pattern: 'biocoop', categoryName: 'Alimentation & Restauration' },
  { pattern: 'uber eats', categoryName: 'Alimentation & Restauration' },
  { pattern: 'deliveroo', categoryName: 'Alimentation & Restauration' },
  { pattern: 'just eat', categoryName: 'Alimentation & Restauration' },
  { pattern: 'mcdonalds', categoryName: 'Alimentation & Restauration' },
  { pattern: 'mcdonald', categoryName: 'Alimentation & Restauration' },
  { pattern: 'burger king', categoryName: 'Alimentation & Restauration' },
  { pattern: 'kfc', categoryName: 'Alimentation & Restauration' },
  { pattern: 'subway', categoryName: 'Alimentation & Restauration' },
  { pattern: 'dominos', categoryName: 'Alimentation & Restauration' },
  { pattern: 'boulangerie', categoryName: 'Alimentation & Restauration' },
  { pattern: 'patisserie', categoryName: 'Alimentation & Restauration' },

  // ─── Auto & Transport ───
  { pattern: 'sncf', categoryName: 'Auto & Transport' },
  { pattern: 'ratp', categoryName: 'Auto & Transport' },
  { pattern: 'uber', categoryName: 'Auto & Transport' },
  { pattern: 'bolt', categoryName: 'Auto & Transport' },
  { pattern: 'blablacar', categoryName: 'Auto & Transport' },
  { pattern: 'totalenergies', categoryName: 'Auto & Transport' },
  { pattern: 'total energies', categoryName: 'Auto & Transport' },
  { pattern: 'shell', categoryName: 'Auto & Transport' },
  { pattern: 'bp station', categoryName: 'Auto & Transport' },
  { pattern: 'esso', categoryName: 'Auto & Transport' },
  { pattern: 'autoroute', categoryName: 'Auto & Transport' },
  { pattern: 'peage', categoryName: 'Auto & Transport' },
  { pattern: 'vinci autoroute', categoryName: 'Auto & Transport' },
  { pattern: 'sanef', categoryName: 'Auto & Transport' },
  { pattern: 'flixbus', categoryName: 'Auto & Transport' },
  { pattern: 'navigo', categoryName: 'Auto & Transport' },
  { pattern: 'lime', categoryName: 'Auto & Transport' },
  { pattern: 'tier', categoryName: 'Auto & Transport' },

  // ─── Logement ───
  { pattern: 'edf', categoryName: 'Logement' },
  { pattern: 'engie', categoryName: 'Logement' },
  { pattern: 'loyer', categoryName: 'Logement' },
  { pattern: 'veolia', categoryName: 'Logement' },
  { pattern: 'suez', categoryName: 'Logement' },
  { pattern: 'ikea', categoryName: 'Logement' },
  { pattern: 'leroy merlin', categoryName: 'Logement' },
  { pattern: 'castorama', categoryName: 'Logement' },
  { pattern: 'brico', categoryName: 'Logement' },

  // ─── Abonnements & Télécom ───
  { pattern: 'netflix', categoryName: 'Abonnements & Télécom' },
  { pattern: 'spotify', categoryName: 'Abonnements & Télécom' },
  { pattern: 'disney+', categoryName: 'Abonnements & Télécom' },
  { pattern: 'amazon prime', categoryName: 'Abonnements & Télécom' },
  { pattern: 'apple.com', categoryName: 'Abonnements & Télécom' },
  { pattern: 'google storage', categoryName: 'Abonnements & Télécom' },
  { pattern: 'youtube premium', categoryName: 'Abonnements & Télécom' },
  { pattern: 'canal+', categoryName: 'Abonnements & Télécom' },
  { pattern: 'deezer', categoryName: 'Abonnements & Télécom' },
  { pattern: 'free mobile', categoryName: 'Abonnements & Télécom' },
  { pattern: 'free telecom', categoryName: 'Abonnements & Télécom' },
  { pattern: 'sfr', categoryName: 'Abonnements & Télécom' },
  { pattern: 'orange', categoryName: 'Abonnements & Télécom' },
  { pattern: 'bouygues telecom', categoryName: 'Abonnements & Télécom' },
  { pattern: 'sosh', categoryName: 'Abonnements & Télécom' },
  { pattern: 'red by sfr', categoryName: 'Abonnements & Télécom' },

  // ─── Shopping ───
  { pattern: 'amazon', categoryName: 'Shopping' },
  { pattern: 'fnac', categoryName: 'Shopping' },
  { pattern: 'darty', categoryName: 'Shopping' },
  { pattern: 'cdiscount', categoryName: 'Shopping' },
  { pattern: 'zara', categoryName: 'Shopping' },
  { pattern: 'h&m', categoryName: 'Shopping' },
  { pattern: 'decathlon', categoryName: 'Shopping' },
  { pattern: 'action', categoryName: 'Shopping' },
  { pattern: 'aliexpress', categoryName: 'Shopping' },
  { pattern: 'shein', categoryName: 'Shopping' },
  { pattern: 'vinted', categoryName: 'Shopping' },

  // ─── Santé ───
  { pattern: 'pharmacie', categoryName: 'Santé' },
  { pattern: 'doctolib', categoryName: 'Santé' },
  { pattern: 'mutuelle', categoryName: 'Santé' },
  { pattern: 'cpam', categoryName: 'Santé' },
  { pattern: 'ameli', categoryName: 'Santé' },
  { pattern: 'dentiste', categoryName: 'Santé' },
  { pattern: 'opticien', categoryName: 'Santé' },

  // ─── Loisirs & Sorties ───
  { pattern: 'cinema', categoryName: 'Loisirs & Sorties' },
  { pattern: 'ugc', categoryName: 'Loisirs & Sorties' },
  { pattern: 'pathe', categoryName: 'Loisirs & Sorties' },
  { pattern: 'gaumont', categoryName: 'Loisirs & Sorties' },
  { pattern: 'fnac spectacle', categoryName: 'Loisirs & Sorties' },
  { pattern: 'ticketmaster', categoryName: 'Loisirs & Sorties' },
  { pattern: 'basic fit', categoryName: 'Loisirs & Sorties' },
  { pattern: 'fitness', categoryName: 'Loisirs & Sorties' },
  { pattern: 'salle de sport', categoryName: 'Loisirs & Sorties' },

  // ─── Assurance ───
  { pattern: 'maif', categoryName: 'Assurance' },
  { pattern: 'maaf', categoryName: 'Assurance' },
  { pattern: 'macif', categoryName: 'Assurance' },
  { pattern: 'axa', categoryName: 'Assurance' },
  { pattern: 'allianz', categoryName: 'Assurance' },
  { pattern: 'groupama', categoryName: 'Assurance' },
  { pattern: 'generali', categoryName: 'Assurance' },
  { pattern: 'matmut', categoryName: 'Assurance' },

  // ─── Impôts & Taxes ───
  { pattern: 'dgfip', categoryName: 'Impôts & Taxes' },
  { pattern: 'tresor public', categoryName: 'Impôts & Taxes' },
  { pattern: 'impot', categoryName: 'Impôts & Taxes' },
  { pattern: 'taxe', categoryName: 'Impôts & Taxes' },
  { pattern: 'urssaf', categoryName: 'Impôts & Taxes' },

  // ─── Revenus ───
  { pattern: 'salaire', categoryName: 'Revenus' },
  { pattern: 'virement employeur', categoryName: 'Revenus' },
  { pattern: 'pole emploi', categoryName: 'Revenus' },
  { pattern: 'france travail', categoryName: 'Revenus' },
  { pattern: 'caf', categoryName: 'Revenus' },
  { pattern: 'allocations', categoryName: 'Revenus' },

  // ─── Frais bancaires ───
  { pattern: 'frais bancaire', categoryName: 'Frais bancaires' },
  { pattern: 'cotisation carte', categoryName: 'Frais bancaires' },
  { pattern: 'commission intervention', categoryName: 'Frais bancaires' },
  { pattern: 'agios', categoryName: 'Frais bancaires' },

  // ─── Éducation ───
  { pattern: 'crous', categoryName: 'Éducation' },
  { pattern: 'universite', categoryName: 'Éducation' },
  { pattern: 'ecole', categoryName: 'Éducation' },

  // ─── Voyages ───
  { pattern: 'booking', categoryName: 'Voyages' },
  { pattern: 'airbnb', categoryName: 'Voyages' },
  { pattern: 'ryanair', categoryName: 'Voyages' },
  { pattern: 'easyjet', categoryName: 'Voyages' },
  { pattern: 'air france', categoryName: 'Voyages' },
  { pattern: 'transavia', categoryName: 'Voyages' },
  { pattern: 'hotel', categoryName: 'Voyages' },
];

/**
 * Normalise un label de transaction pour le matching.
 * Supprime les codes CB, dates, références, et met en minuscules.
 */
function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\d{2}[/\-]\d{2}[/\-]?\d{0,4}/g, '') // dates
    .replace(/\b(cb|carte|vir(ement)?|prlv|prelevement|cheque|chq)\b/gi, '')
    .replace(/\b[a-z0-9]{16,}\b/g, '') // long refs
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cache de règles utilisateur par userId (valide le temps d'une requête)
const ruleCache = new Map<string, Array<{ pattern: string; matchType: string; categoryId: bigint; priority: number }>>();

async function getUserRules(userId: bigint) {
  const key = userId.toString();
  const cached = ruleCache.get(key);
  if (cached) return cached;

  const rules = await prisma.categoryRule.findMany({
    where: { userId },
    orderBy: { priority: 'desc' },
    select: { pattern: true, matchType: true, categoryId: true, priority: true },
  });

  ruleCache.set(key, rules);
  return rules;
}

/** Clears the per-request rule cache */
export function clearRuleCache() {
  ruleCache.clear();
}

/**
 * Tente d'auto-catégoriser une transaction par son label.
 *
 * 1. Règles utilisateur (priority DESC) : EXACT → STARTS_WITH → CONTAINS
 * 2. Règles système (marchands FR connus)
 *
 * Retourne le categoryId ou null si aucune correspondance.
 */
export async function autoCategorize(
  userId: bigint,
  label: string,
): Promise<bigint | null> {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;

  // 1. Règles utilisateur
  const userRules = await getUserRules(userId);

  for (const rule of userRules) {
    const matches =
      rule.matchType === 'EXACT'
        ? normalized === rule.pattern
        : rule.matchType === 'STARTS_WITH'
          ? normalized.startsWith(rule.pattern)
          : normalized.includes(rule.pattern);

    if (matches) return rule.categoryId;
  }

  // 2. Règles système
  for (const rule of SYSTEM_RULES) {
    if (normalized.includes(rule.pattern)) {
      // Find-or-create la catégorie système pour cet utilisateur
      const cat = await prisma.personalCategory.upsert({
        where: { userId_name: { userId, name: rule.categoryName } },
        create: { userId, name: rule.categoryName },
        update: {},
        select: { id: true },
      });
      return cat.id;
    }
  }

  return null;
}

/**
 * Catégorise en masse les transactions sans catégorie d'un utilisateur.
 * Retourne le nombre de transactions nouvellement catégorisées.
 */
export async function bulkAutoCategorize(userId: bigint): Promise<number> {
  const uncategorized = await prisma.personalTransaction.findMany({
    where: { userId, categoryId: null },
    select: { id: true, label: true },
  });

  if (uncategorized.length === 0) return 0;

  // Clear cache pour charger les règles fraîches
  clearRuleCache();

  let count = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
    const batch = uncategorized.slice(i, i + BATCH_SIZE);
    const updates: Array<{ id: bigint; categoryId: bigint }> = [];

    for (const tx of batch) {
      const categoryId = await autoCategorize(userId, tx.label);
      if (categoryId) {
        updates.push({ id: tx.id, categoryId });
      }
    }

    // Appliquer les mises à jour en parallèle
    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) =>
          prisma.personalTransaction.update({
            where: { id: u.id },
            data: { categoryId: u.categoryId },
          }),
        ),
      );
      count += updates.length;
    }
  }

  clearRuleCache();
  return count;
}
