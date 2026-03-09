/**
 * Plan Comptable Général (PCG) — Catégories pré-construites pour la saisie simplifiée.
 *
 * Chaque catégorie mappe un libellé métier à un code PCG + journal comptable.
 * L'utilisateur choisit un libellé → le système déduit le code comptable et le journal.
 */

export type PcgCategory = {
  code: string;
  label: string;
  type: 'EXPENSE' | 'INCOME';
  class: number;
  group: string;
  journalCode: 'AC' | 'VT' | 'BQ' | 'OD';
};

export const PCG_CATEGORIES: PcgCategory[] = [
  // ── Classe 6 — Charges ─────────────────────────────────────────────────────

  // 60 - Achats
  { code: '601', label: 'Matières premières', type: 'EXPENSE', class: 6, group: 'Achats', journalCode: 'AC' },
  { code: '602', label: 'Fournitures consommables', type: 'EXPENSE', class: 6, group: 'Achats', journalCode: 'AC' },
  { code: '604', label: 'Achats de prestations', type: 'EXPENSE', class: 6, group: 'Achats', journalCode: 'AC' },
  { code: '606', label: 'Fournitures non stockées', type: 'EXPENSE', class: 6, group: 'Achats', journalCode: 'AC' },
  { code: '607', label: 'Achats de marchandises', type: 'EXPENSE', class: 6, group: 'Achats', journalCode: 'AC' },

  // 61 - Services extérieurs
  { code: '611', label: 'Sous-traitance', type: 'EXPENSE', class: 6, group: 'Services extérieurs', journalCode: 'AC' },
  { code: '612', label: 'Crédit-bail / leasing', type: 'EXPENSE', class: 6, group: 'Services extérieurs', journalCode: 'AC' },
  { code: '613', label: 'Loyer & charges locatives', type: 'EXPENSE', class: 6, group: 'Services extérieurs', journalCode: 'AC' },
  { code: '615', label: 'Entretien & réparations', type: 'EXPENSE', class: 6, group: 'Services extérieurs', journalCode: 'AC' },
  { code: '616', label: 'Assurances', type: 'EXPENSE', class: 6, group: 'Services extérieurs', journalCode: 'AC' },

  // 62 - Autres services extérieurs
  { code: '622', label: 'Honoraires & commissions', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },
  { code: '623', label: 'Publicité & communication', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },
  { code: '624', label: 'Transport de biens', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },
  { code: '625', label: 'Déplacements & missions', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },
  { code: '626', label: 'Télécom & internet', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },
  { code: '627', label: 'Frais bancaires', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'BQ' },
  { code: '628', label: 'Divers services', type: 'EXPENSE', class: 6, group: 'Autres services', journalCode: 'AC' },

  // 63 - Impôts & taxes
  { code: '631', label: 'Impôts sur rémunérations', type: 'EXPENSE', class: 6, group: 'Impôts & taxes', journalCode: 'OD' },
  { code: '635', label: 'Autres impôts & taxes', type: 'EXPENSE', class: 6, group: 'Impôts & taxes', journalCode: 'OD' },
  { code: '637', label: 'CFE / CVAE', type: 'EXPENSE', class: 6, group: 'Impôts & taxes', journalCode: 'OD' },

  // 64 - Personnel & sous-traitance
  { code: '641', label: 'Salaires bruts', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '6411', label: 'Rémunération freelance / sous-traitant', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '645', label: 'Charges sociales patronales', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '6451', label: 'URSSAF', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '6452', label: 'Retraite complémentaire', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '6453', label: 'Mutuelle & prévoyance', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },
  { code: '648', label: 'Autres charges de personnel', type: 'EXPENSE', class: 6, group: 'Personnel & sous-traitance', journalCode: 'OD' },

  // 625x - Notes de frais (sous-comptes de 625)
  { code: '6251', label: 'Note de frais — Déplacements', type: 'EXPENSE', class: 6, group: 'Notes de frais', journalCode: 'AC' },
  { code: '6252', label: 'Note de frais — Hébergement', type: 'EXPENSE', class: 6, group: 'Notes de frais', journalCode: 'AC' },
  { code: '6253', label: 'Note de frais — Restauration', type: 'EXPENSE', class: 6, group: 'Notes de frais', journalCode: 'AC' },
  { code: '6254', label: 'Note de frais — Carburant', type: 'EXPENSE', class: 6, group: 'Notes de frais', journalCode: 'AC' },
  { code: '6255', label: 'Note de frais — Autre', type: 'EXPENSE', class: 6, group: 'Notes de frais', journalCode: 'AC' },

  // 65 - Autres charges de gestion
  { code: '651', label: 'Redevances & licences', type: 'EXPENSE', class: 6, group: 'Autres charges', journalCode: 'OD' },
  { code: '654', label: 'Créances irrécouvrables', type: 'EXPENSE', class: 6, group: 'Autres charges', journalCode: 'OD' },
  { code: '658', label: 'Charges diverses', type: 'EXPENSE', class: 6, group: 'Autres charges', journalCode: 'OD' },

  // 66 - Charges financières
  { code: '661', label: 'Intérêts & frais d\'emprunt', type: 'EXPENSE', class: 6, group: 'Charges financières', journalCode: 'BQ' },
  { code: '668', label: 'Autres charges financières', type: 'EXPENSE', class: 6, group: 'Charges financières', journalCode: 'BQ' },

  // 69 - Impôts sur les bénéfices
  { code: '695', label: 'Impôt sur les sociétés', type: 'EXPENSE', class: 6, group: 'Impôts sur bénéfices', journalCode: 'OD' },

  // ── Classe 7 — Produits ─────────────────────────────────────────────────────

  // 70 - Ventes
  { code: '706', label: 'Prestations de services', type: 'INCOME', class: 7, group: 'Ventes', journalCode: 'VT' },
  { code: '707', label: 'Ventes de marchandises', type: 'INCOME', class: 7, group: 'Ventes', journalCode: 'VT' },
  { code: '708', label: 'Produits annexes', type: 'INCOME', class: 7, group: 'Ventes', journalCode: 'VT' },

  // 74 - Subventions
  { code: '74', label: 'Subventions d\'exploitation', type: 'INCOME', class: 7, group: 'Autres produits', journalCode: 'OD' },

  // 75 - Autres produits
  { code: '758', label: 'Produits divers de gestion', type: 'INCOME', class: 7, group: 'Autres produits', journalCode: 'OD' },

  // 76 - Produits financiers
  { code: '764', label: 'Revenus de placements', type: 'INCOME', class: 7, group: 'Produits financiers', journalCode: 'BQ' },

  // 77 - Produits exceptionnels
  { code: '775', label: 'Cession d\'immobilisations', type: 'INCOME', class: 7, group: 'Produits exceptionnels', journalCode: 'OD' },
];

// ── Taux de TVA français ──────────────────────────────────────────────────────

export type VatRateOption = {
  /** Taux en % × 100 (ex: 2000 = 20%, 550 = 5.5%) */
  value: number;
  /** Taux affiché */
  percent: number;
  label: string;
};

export const VAT_RATES: VatRateOption[] = [
  { value: 2000, percent: 20, label: '20 % (normal)' },
  { value: 1000, percent: 10, label: '10 % (intermédiaire)' },
  { value: 550, percent: 5.5, label: '5,5 % (réduit)' },
  { value: 210, percent: 2.1, label: '2,1 % (particulier)' },
  { value: 0, percent: 0, label: '0 % (exonéré)' },
];

// ── Journaux comptables ───────────────────────────────────────────────────────

export const JOURNAL_CODES: Record<string, string> = {
  AC: 'Achats',
  VT: 'Ventes',
  BQ: 'Banque',
  OD: 'Opérations diverses',
};

// ── Comptes TVA ───────────────────────────────────────────────────────────────

export const TVA_ACCOUNTS = {
  COLLECTEE: '44571',
  DEDUCTIBLE: '44566',
  A_DECAISSER: '44551',
} as const;

export const BANK_ACCOUNT = '512';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Catégories groupées par type puis par group (pour le picker UI). */
export function groupedCategories(type: 'EXPENSE' | 'INCOME'): Map<string, PcgCategory[]> {
  const map = new Map<string, PcgCategory[]>();
  for (const cat of PCG_CATEGORIES) {
    if (cat.type !== type) continue;
    const list = map.get(cat.group);
    if (list) list.push(cat);
    else map.set(cat.group, [cat]);
  }
  return map;
}

/** Trouve une catégorie par code PCG. */
export function findCategoryByCode(code: string): PcgCategory | undefined {
  return PCG_CATEGORIES.find((c) => c.code === code);
}

/**
 * Calcule la TVA à partir d'un montant TTC et d'un taux (en bps, ex: 2000 = 20%).
 * Retourne { ht, tva, ttc } en cents.
 */
export function computeVat(ttcCents: bigint, rateBps: number): { htCents: bigint; tvaCents: bigint; ttcCents: bigint } {
  if (rateBps <= 0) return { htCents: ttcCents, tvaCents: 0n, ttcCents };
  const base = 10000n;
  const htCents = (ttcCents * base) / (base + BigInt(rateBps));
  const tvaCents = ttcCents - htCents;
  return { htCents, tvaCents, ttcCents };
}
