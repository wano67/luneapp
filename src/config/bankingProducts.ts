export type InterestMethod = 'QUINZAINE' | 'ANNUAL' | 'NONE';
export type ProductCategory = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'LOAN';

export type BankingProduct = {
  code: string;
  name: string;
  category: ProductCategory;
  /** Maps to Prisma PersonalAccountType */
  accountType: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH' | 'LOAN';
  /** Taux réglementé en points de base — 150 = 1.50% */
  regulatedRateBps?: number;
  /** Plafond de versement en cents */
  maxDepositCents?: number;
  interestMethod: InterestMethod;
  /** Exonéré d'impôt sur le revenu (hors prélèvements sociaux) */
  taxExempt?: boolean;
  description?: string;
};

// ─── Taux au 1er février 2026 ───

export const BANKING_PRODUCTS: BankingProduct[] = [
  // Espèces
  {
    code: 'COMPTE_COURANT',
    name: 'Compte courant',
    category: 'CHECKING',
    accountType: 'CURRENT',
    interestMethod: 'NONE',
    description: 'Compte de dépôt classique pour les opérations courantes.',
  },
  {
    code: 'CASH',
    name: 'Espèces',
    category: 'CHECKING',
    accountType: 'CASH',
    interestMethod: 'NONE',
    description: 'Argent liquide, portefeuille physique.',
  },

  // Épargne — taux fixe réglementé
  {
    code: 'LIVRET_A',
    name: 'Livret A',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 150,
    maxDepositCents: 2_295_000,
    interestMethod: 'QUINZAINE',
    taxExempt: true,
    description: 'Épargne réglementée, exonérée d\'impôt. Plafond 22 950 €.',
  },
  {
    code: 'LDDS',
    name: 'LDDS',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 150,
    maxDepositCents: 1_200_000,
    interestMethod: 'QUINZAINE',
    taxExempt: true,
    description: 'Livret de Développement Durable et Solidaire. Plafond 12 000 €.',
  },
  {
    code: 'LEP',
    name: 'Livret d\'Épargne Populaire',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 250,
    maxDepositCents: 1_000_000,
    interestMethod: 'QUINZAINE',
    taxExempt: true,
    description: 'Réservé aux revenus modestes. Taux supérieur au Livret A. Plafond 10 000 €.',
  },
  {
    code: 'PEL',
    name: 'Plan Épargne Logement',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 200,
    maxDepositCents: 6_120_000,
    interestMethod: 'ANNUAL',
    taxExempt: false,
    description: 'Épargne logement à taux fixe. Plafond 61 200 €. Durée min 4 ans.',
  },
  {
    code: 'CEL',
    name: 'Compte Épargne Logement',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 100,
    maxDepositCents: 1_530_000,
    interestMethod: 'QUINZAINE',
    taxExempt: false,
    description: 'Épargne logement souple. Plafond 15 300 €.',
  },
  {
    code: 'LIVRET_JEUNE',
    name: 'Livret Jeune',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    regulatedRateBps: 150,
    maxDepositCents: 160_000,
    interestMethod: 'QUINZAINE',
    taxExempt: true,
    description: 'Réservé aux 12-25 ans. Taux ≥ Livret A. Plafond 1 600 €.',
  },
  {
    code: 'LIVRET_BANCAIRE',
    name: 'Livret bancaire',
    category: 'SAVINGS',
    accountType: 'SAVINGS',
    interestMethod: 'QUINZAINE',
    taxExempt: false,
    description: 'Livret non réglementé. Taux fixé par la banque.',
  },

  // Investissement — taux variable
  {
    code: 'PEA',
    name: 'Plan Épargne en Actions',
    category: 'INVESTMENT',
    accountType: 'INVEST',
    maxDepositCents: 15_000_000,
    interestMethod: 'NONE',
    description: 'Investissement en actions européennes. Fiscalité allégée après 5 ans. Plafond 150 000 €.',
  },
  {
    code: 'CTO',
    name: 'Compte-titres ordinaire',
    category: 'INVESTMENT',
    accountType: 'INVEST',
    interestMethod: 'NONE',
    description: 'Investissement tous supports, sans limite géographique ni plafond.',
  },
  {
    code: 'ASSURANCE_VIE',
    name: 'Assurance-vie',
    category: 'INVESTMENT',
    accountType: 'INVEST',
    interestMethod: 'ANNUAL',
    description: 'Enveloppe fiscale mixte (fonds euros + unités de compte). Fiscalité allégée après 8 ans.',
  },
  {
    code: 'PER',
    name: 'Plan Épargne Retraite',
    category: 'INVESTMENT',
    accountType: 'INVEST',
    interestMethod: 'ANNUAL',
    description: 'Épargne retraite. Versements déductibles du revenu imposable.',
  },

  // Prêt
  {
    code: 'PRET_IMMOBILIER',
    name: 'Prêt immobilier',
    category: 'LOAN',
    accountType: 'LOAN',
    interestMethod: 'ANNUAL',
    description: 'Crédit pour l\'achat d\'un bien immobilier.',
  },
  {
    code: 'PRET_CONSO',
    name: 'Prêt à la consommation',
    category: 'LOAN',
    accountType: 'LOAN',
    interestMethod: 'ANNUAL',
    description: 'Crédit pour des dépenses personnelles (travaux, équipement, etc.).',
  },
  {
    code: 'PRET_ETUDIANT',
    name: 'Prêt étudiant',
    category: 'LOAN',
    accountType: 'LOAN',
    interestMethod: 'ANNUAL',
    description: 'Crédit pour financer des études.',
  },
  {
    code: 'PRET_AUTO',
    name: 'Prêt automobile',
    category: 'LOAN',
    accountType: 'LOAN',
    interestMethod: 'ANNUAL',
    description: 'Crédit affecté à l\'achat d\'un véhicule.',
  },
];

export const PRODUCT_MAP = new Map(BANKING_PRODUCTS.map((p) => [p.code, p]));

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  CHECKING: 'Espèces',
  SAVINGS: 'Épargne',
  INVESTMENT: 'Investissement',
  LOAN: 'Prêt',
};

/** Get products filtered by category */
export function getProductsByCategory(category: ProductCategory): BankingProduct[] {
  return BANKING_PRODUCTS.filter((p) => p.category === category);
}
