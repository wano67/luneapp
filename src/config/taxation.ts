/**
 * Constantes fiscales françaises 2026 — tous types de sociétés.
 *
 * Couvre : IS, IR, micro-entreprise, TVA, cotisations sociales, CFE/CVAE.
 */

// ── Types de société ────────────────────────────────────────────────────────────

export type BusinessLegalForm =
  | 'SAS'
  | 'SASU'
  | 'SARL'
  | 'EURL'
  | 'SA'
  | 'EI'            // Entreprise Individuelle
  | 'MICRO'         // Micro-entreprise / Auto-entrepreneur
  | 'SCI'
  | 'SNC'
  | 'OTHER';

export type TaxRegime = 'IS' | 'IR';

export type MicroActivityType =
  | 'VENTE'         // Vente de marchandises, fournitures, denrées
  | 'SERVICES_BIC'  // Prestations de services commerciales
  | 'BNC'           // Professions libérales
  | 'BNC_CIPAV';    // Professions libérales CIPAV

export type VatRegime =
  | 'FRANCHISE'     // Franchise en base de TVA
  | 'SIMPLIFIE'     // Régime simplifié
  | 'REEL_NORMAL';  // Régime réel normal

// ── Plafonds sociaux ────────────────────────────────────────────────────────────

export const PASS = 48_060;
export const PMSS = 4_005;
export const SMIC_HORAIRE_BRUT = 11.88;

// ── Impôt sur les Sociétés (IS) ─────────────────────────────────────────────────

export const IS = {
  TAUX_REDUIT: 0.15,
  TAUX_NORMAL: 0.25,
  SEUIL_TAUX_REDUIT: 42_500,        // €
  CA_MAX_TAUX_REDUIT: 10_000_000,   // € CA HT
  /** Contribution sociale IS : 3.3% au-delà de 763k€ d'IS, si CA > 7.63M€ */
  CONTRIBUTION_SOCIALE: {
    TAUX: 0.033,
    SEUIL_CA: 7_630_000,
    ABATTEMENT: 763_000,
  },
} as const;

/**
 * Calcule l'IS (taux réduit PME + normal).
 */
export function computeIS(beneficeImposable: number, eligibleTauxReduit = true): number {
  if (beneficeImposable <= 0) return 0;
  if (eligibleTauxReduit) {
    const trancheReduite = Math.min(beneficeImposable, IS.SEUIL_TAUX_REDUIT);
    const trancheNormale = Math.max(0, beneficeImposable - IS.SEUIL_TAUX_REDUIT);
    return trancheReduite * IS.TAUX_REDUIT + trancheNormale * IS.TAUX_NORMAL;
  }
  return beneficeImposable * IS.TAUX_NORMAL;
}

// ── Impôt sur le Revenu (IR) ─────────────────────────────────────────────────────

export const IR_TRANCHES = [
  { min: 0,       max: 11_600,   taux: 0 },
  { min: 11_600,  max: 29_579,   taux: 0.11 },
  { min: 29_579,  max: 84_577,   taux: 0.30 },
  { min: 84_577,  max: 181_917,  taux: 0.41 },
  { min: 181_917, max: Infinity,  taux: 0.45 },
] as const;

/**
 * Calcule l'IR pour un revenu imposable, avec le nombre de parts du foyer.
 */
export function computeIR(revenuImposable: number, nbParts = 1): number {
  if (revenuImposable <= 0) return 0;
  const parPart = revenuImposable / nbParts;
  let impotParPart = 0;
  for (const tranche of IR_TRANCHES) {
    if (parPart <= tranche.min) break;
    const base = Math.min(parPart, tranche.max) - tranche.min;
    impotParPart += base * tranche.taux;
  }
  return Math.round(impotParPart * nbParts * 100) / 100;
}

// ── Micro-entreprise ─────────────────────────────────────────────────────────────

export const MICRO = {
  SEUILS_CA: {
    VENTE: 203_100,
    SERVICES: 83_600,
  },
  /** Abattement forfaitaire pour le calcul de l'IR (régime micro-fiscal classique) */
  ABATTEMENTS: {
    VENTE: 0.71,
    SERVICES_BIC: 0.50,
    BNC: 0.34,
    MINIMUM: 305,
  },
  /** Versement libératoire de l'IR */
  VERSEMENT_LIBERATOIRE: {
    VENTE: 0.01,
    SERVICES_BIC: 0.017,
    BNC: 0.022,
    RFR_MAX_PAR_PART_2026: 29_315,
  },
  /** Cotisations sociales URSSAF 2026 */
  COTISATIONS: {
    VENTE: 0.123,
    SERVICES_BIC: 0.212,
    BNC: 0.256,
    BNC_CIPAV: 0.232,
  },
  /** ACRE : réduction de cotisations */
  ACRE: {
    REDUCTION_AVANT_JUILLET_2026: 0.50,
    REDUCTION_APRES_JUILLET_2026: 0.25,
  },
} as const;

/**
 * Calcule les cotisations + IR micro-entrepreneur.
 */
export function computeMicroCharges(
  ca: number,
  activite: MicroActivityType,
  versementLiberatoire = false,
  acre = false,
  acreApresJuillet = false,
  nbParts = 1,
): {
  cotisations: number;
  ir: number;
  total: number;
  revenuNet: number;
} {
  // Cotisations sociales
  const tauxCotis = {
    VENTE: MICRO.COTISATIONS.VENTE,
    SERVICES_BIC: MICRO.COTISATIONS.SERVICES_BIC,
    BNC: MICRO.COTISATIONS.BNC,
    BNC_CIPAV: MICRO.COTISATIONS.BNC_CIPAV,
  }[activite];

  let cotisations = ca * tauxCotis;
  if (acre) {
    const reduction = acreApresJuillet
      ? MICRO.ACRE.REDUCTION_APRES_JUILLET_2026
      : MICRO.ACRE.REDUCTION_AVANT_JUILLET_2026;
    cotisations *= (1 - reduction);
  }

  // IR
  let ir: number;
  if (versementLiberatoire) {
    const tauxVL = {
      VENTE: MICRO.VERSEMENT_LIBERATOIRE.VENTE,
      SERVICES_BIC: MICRO.VERSEMENT_LIBERATOIRE.SERVICES_BIC,
      BNC: MICRO.VERSEMENT_LIBERATOIRE.BNC,
      BNC_CIPAV: MICRO.VERSEMENT_LIBERATOIRE.BNC,
    }[activite];
    ir = ca * tauxVL;
  } else {
    const abattement = {
      VENTE: MICRO.ABATTEMENTS.VENTE,
      SERVICES_BIC: MICRO.ABATTEMENTS.SERVICES_BIC,
      BNC: MICRO.ABATTEMENTS.BNC,
      BNC_CIPAV: MICRO.ABATTEMENTS.BNC,
    }[activite];
    const revenuImposable = Math.max(ca * (1 - abattement), MICRO.ABATTEMENTS.MINIMUM);
    ir = computeIR(revenuImposable, nbParts);
  }

  const total = cotisations + ir;
  return { cotisations, ir, total, revenuNet: ca - total };
}

// ── TVA — Seuils par régime ──────────────────────────────────────────────────────

export const TVA_SEUILS = {
  FRANCHISE: {
    VENTE: { normal: 85_000, majore: 93_500 },
    SERVICES: { normal: 37_500, majore: 41_250 },
  },
  SIMPLIFIE: {
    VENTE_MAX: 945_000,
    SERVICES_MAX: 286_000,
  },
} as const;

/**
 * Détermine le régime TVA applicable selon le CA.
 */
export function determineVatRegime(ca: number, isVente: boolean): VatRegime {
  const franchise = isVente ? TVA_SEUILS.FRANCHISE.VENTE : TVA_SEUILS.FRANCHISE.SERVICES;
  if (ca <= franchise.normal) return 'FRANCHISE';
  const simplMax = isVente ? TVA_SEUILS.SIMPLIFIE.VENTE_MAX : TVA_SEUILS.SIMPLIFIE.SERVICES_MAX;
  if (ca <= simplMax) return 'SIMPLIFIE';
  return 'REEL_NORMAL';
}

// ── CFE / CVAE ───────────────────────────────────────────────────────────────────

export const CFE = {
  EXONERATION_CA_MAX: 5_000,
  TAXE_ADDITIONNELLE: 0.0112,
  /** Barème base minimum par tranche de CA */
  BASES_MINIMALES: [
    { maxCA: 10_000,   min: 243, max: 579 },
    { maxCA: 32_600,   min: 243, max: 1_158 },
    { maxCA: 100_000,  min: 243, max: 2_433 },
    { maxCA: 250_000,  min: 243, max: 4_056 },
    { maxCA: 500_000,  min: 243, max: 5_793 },
    { maxCA: Infinity,  min: 243, max: 7_533 },
  ],
} as const;

export const CVAE = {
  SEUIL_DECLARATION: 152_500,
  SEUIL_PAIEMENT: 500_000,
  TAUX_MAX_2026: 0.0019,
} as const;

/**
 * Calcule le taux effectif de CVAE.
 */
export function computeCVAETaux(ca: number): number {
  if (ca <= 500_000) return 0;
  if (ca <= 3_000_000) return 0.00063 * (ca - 500_000) / 2_500_000;
  if (ca <= 10_000_000) return 0.00063 + 0.00113 * (ca - 3_000_000) / 7_000_000;
  if (ca <= 50_000_000) return 0.00176 + 0.00014 * (ca - 10_000_000) / 40_000_000;
  return 0.0019;
}

// ── Cotisations sociales TNS (gérant majoritaire SARL) ───────────────────────────

export const TNS = {
  RETRAITE_BASE_PLAFONNEE: 0.1715,
  RETRAITE_BASE_DEPLAFONNEE: 0.0072,
  RETRAITE_COMP_T1: 0.081,
  RETRAITE_COMP_T2: 0.091,
  INVALIDITE_DECES: 0.013,
  IJ_ARTISAN_COMMERCANT: 0.005,
  CSG_CRDS: 0.097,
  ABATTEMENT_ASSIETTE_CSG: 0.26,
} as const;

/**
 * Estimation simplifiée des cotisations TNS (gérant majoritaire SARL).
 * Retourne environ 43-45% du revenu net pour la plupart des cas.
 */
export function estimateTNSCotisations(revenuNet: number): number {
  if (revenuNet <= 0) return 0;
  return Math.round(revenuNet * 0.45 * 100) / 100;
}

/**
 * Détail des cotisations TNS par poste — remplace l'approximation flat 45%.
 */
export type TNSDetail = {
  retraiteBasePlafonnee: number;
  retraiteBaseDeplafonnee: number;
  retraiteCompT1: number;
  retraiteCompT2: number;
  invaliditeDeces: number;
  ijMaladie: number;
  allocationsFamiliales: number;
  formationPro: number;
  csgCrds: number;
  total: number;
};

export function computeTNSDetaille(revenuNet: number): TNSDetail {
  if (revenuNet <= 0) {
    return { retraiteBasePlafonnee: 0, retraiteBaseDeplafonnee: 0, retraiteCompT1: 0, retraiteCompT2: 0, invaliditeDeces: 0, ijMaladie: 0, allocationsFamiliales: 0, formationPro: 0, csgCrds: 0, total: 0 };
  }
  const retraiteBasePlafonnee = Math.min(revenuNet, PASS) * TNS.RETRAITE_BASE_PLAFONNEE;
  const retraiteBaseDeplafonnee = revenuNet * TNS.RETRAITE_BASE_DEPLAFONNEE;
  const retraiteCompT1 = Math.min(revenuNet, PASS) * TNS.RETRAITE_COMP_T1;
  const retraiteCompT2 = Math.max(0, Math.min(revenuNet, PASS * 4) - PASS) * TNS.RETRAITE_COMP_T2;
  const invaliditeDeces = Math.min(revenuNet, PASS) * TNS.INVALIDITE_DECES;
  const ijMaladie = Math.min(revenuNet, PASS * 5) * TNS.IJ_ARTISAN_COMMERCANT;
  // Allocations familiales : 0% si revenu < 48 060€, 3.10% au-delà
  const allocationsFamiliales = revenuNet > PASS ? revenuNet * 0.031 : 0;
  const formationPro = revenuNet * 0.0025;
  // CSG-CRDS : 9.7% sur (revenu net + cotisations obligatoires) abattues de 26% (estimé)
  const baseCSG = revenuNet * (1 - TNS.ABATTEMENT_ASSIETTE_CSG);
  const csgCrds = baseCSG * TNS.CSG_CRDS;
  const total = retraiteBasePlafonnee + retraiteBaseDeplafonnee + retraiteCompT1 + retraiteCompT2 + invaliditeDeces + ijMaladie + allocationsFamiliales + formationPro + csgCrds;
  return {
    retraiteBasePlafonnee: Math.round(retraiteBasePlafonnee * 100) / 100,
    retraiteBaseDeplafonnee: Math.round(retraiteBaseDeplafonnee * 100) / 100,
    retraiteCompT1: Math.round(retraiteCompT1 * 100) / 100,
    retraiteCompT2: Math.round(retraiteCompT2 * 100) / 100,
    invaliditeDeces: Math.round(invaliditeDeces * 100) / 100,
    ijMaladie: Math.round(ijMaladie * 100) / 100,
    allocationsFamiliales: Math.round(allocationsFamiliales * 100) / 100,
    formationPro: Math.round(formationPro * 100) / 100,
    csgCrds: Math.round(csgCrds * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ── Cotisations assimilé salarié (président SAS/SASU) ────────────────────────────

export const ASSIMILE_SALARIE = {
  /** Approximation coût total employeur ≈ 1.82× le net */
  RATIO_COUT_NET: 1.82,
  /** Part patronale ≈ 45% du brut */
  RATIO_PATRONAL_BRUT: 0.45,
  /** Part salariale ≈ 22% du brut */
  RATIO_SALARIAL_BRUT: 0.22,
  /** Net ≈ 78% du brut */
  RATIO_NET_BRUT: 0.78,
} as const;

// ── Charges patronales (employeur) ──────────────────────────────────────────────

export type ChargesPatronalesDetail = {
  maladie: number;
  vieillessePlafonnee: number;
  vieillesseDeplafonnee: number;
  retraiteCompT1: number;
  retraiteCompT2: number;
  assuranceChomage: number;
  ags: number;
  accidentTravail: number;
  formationPro: number;
  taxeApprentissage: number;
  mutuellePatronale: number;
  total: number;
};

/**
 * Calcule les charges patronales détaillées pour un salarié.
 * @param grossMensuel — salaire brut mensuel en euros
 * @param effectif — effectif de l'entreprise (impacte le taux formation pro)
 */
export function computeChargesPatronales(grossMensuel: number, effectif = 1): ChargesPatronalesDetail {
  if (grossMensuel <= 0) {
    return { maladie: 0, vieillessePlafonnee: 0, vieillesseDeplafonnee: 0, retraiteCompT1: 0, retraiteCompT2: 0, assuranceChomage: 0, ags: 0, accidentTravail: 0, formationPro: 0, taxeApprentissage: 0, mutuellePatronale: 0, total: 0 };
  }
  const smicMensuel = SMIC_HORAIRE_BRUT * 151.67;
  const ratioSmic = grossMensuel / smicMensuel;

  // Assurance maladie : 7% (13% si > 2.5 SMIC)
  const maladie = grossMensuel * (ratioSmic > 2.5 ? 0.13 : 0.07);
  // Vieillesse plafonnée : 8.55% sur tranche ≤ PMSS
  const vieillessePlafonnee = Math.min(grossMensuel, PMSS) * 0.0855;
  // Vieillesse déplafonnée : 2.02% sur totalité
  const vieillesseDeplafonnee = grossMensuel * 0.0202;
  // Retraite complémentaire T1 : 4.72% sur tranche ≤ PMSS
  const retraiteCompT1 = Math.min(grossMensuel, PMSS) * 0.0472;
  // Retraite complémentaire T2 : 12.95% sur tranche PMSS → 8×PMSS
  const retraiteCompT2 = Math.max(0, Math.min(grossMensuel, PMSS * 8) - PMSS) * 0.1295;
  // Assurance chômage : 4.05%
  const assuranceChomage = grossMensuel * 0.0405;
  // AGS (garantie des salaires) : 0.20%
  const ags = grossMensuel * 0.002;
  // Accident du travail : taux moyen ~1.50% (varie par secteur)
  const accidentTravail = grossMensuel * 0.015;
  // Formation professionnelle : 0.55% (<11 salariés) ou 1% (>=11)
  const formationPro = grossMensuel * (effectif >= 11 ? 0.01 : 0.0055);
  // Taxe d'apprentissage : 0.68%
  const taxeApprentissage = grossMensuel * 0.0068;
  // Mutuelle patronale minimum : ~1% (part employeur 50% d'environ 2%)
  const mutuellePatronale = grossMensuel * 0.01;

  const total = maladie + vieillessePlafonnee + vieillesseDeplafonnee + retraiteCompT1 + retraiteCompT2 + assuranceChomage + ags + accidentTravail + formationPro + taxeApprentissage + mutuellePatronale;

  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    maladie: r(maladie),
    vieillessePlafonnee: r(vieillessePlafonnee),
    vieillesseDeplafonnee: r(vieillesseDeplafonnee),
    retraiteCompT1: r(retraiteCompT1),
    retraiteCompT2: r(retraiteCompT2),
    assuranceChomage: r(assuranceChomage),
    ags: r(ags),
    accidentTravail: r(accidentTravail),
    formationPro: r(formationPro),
    taxeApprentissage: r(taxeApprentissage),
    mutuellePatronale: r(mutuellePatronale),
    total: r(total),
  };
}

/**
 * Calcule le net estimé à partir du brut pour un salarié.
 * Part salariale ≈ 22% du brut (URSSAF + retraite + CSG-CRDS).
 */
export function computeNetFromGross(grossMensuel: number): number {
  return Math.round(grossMensuel * ASSIMILE_SALARIE.RATIO_NET_BRUT * 100) / 100;
}

export type MasseSalarialeEmployee = {
  brutCents: number;
  chargesPatronalesCents: number;
  coutEmployeurCents: number;
  netEstimeCents: number;
};

export type MasseSalarialeResult = {
  totalBrutCents: number;
  totalChargesPatronalesCents: number;
  totalCoutEmployeurCents: number;
  totalNetEstimeCents: number;
  parEmploye: MasseSalarialeEmployee[];
};

/**
 * Calcule la masse salariale complète pour une liste d'employés.
 * @param employees — tableau de salaires bruts mensuels en cents
 * @param effectif — effectif total (impacte taux formation pro)
 */
export function computeMasseSalariale(
  grossSalaryCentsArray: number[],
  effectif?: number,
): MasseSalarialeResult {
  const eff = effectif ?? grossSalaryCentsArray.length;
  const parEmploye: MasseSalarialeEmployee[] = grossSalaryCentsArray.map((brutCents) => {
    const brutEuros = brutCents / 100;
    const charges = computeChargesPatronales(brutEuros, eff);
    const netEuros = computeNetFromGross(brutEuros);
    return {
      brutCents,
      chargesPatronalesCents: Math.round(charges.total * 100),
      coutEmployeurCents: brutCents + Math.round(charges.total * 100),
      netEstimeCents: Math.round(netEuros * 100),
    };
  });
  return {
    totalBrutCents: parEmploye.reduce((s, e) => s + e.brutCents, 0),
    totalChargesPatronalesCents: parEmploye.reduce((s, e) => s + e.chargesPatronalesCents, 0),
    totalCoutEmployeurCents: parEmploye.reduce((s, e) => s + e.coutEmployeurCents, 0),
    totalNetEstimeCents: parEmploye.reduce((s, e) => s + e.netEstimeCents, 0),
    parEmploye,
  };
}

/**
 * Estime la CFE annuelle (base minimum selon CA).
 */
export function estimateCFE(ca: number): number {
  if (ca <= CFE.EXONERATION_CA_MAX) return 0;
  for (const tranche of CFE.BASES_MINIMALES) {
    if (ca <= tranche.maxCA) {
      return Math.round(((tranche.min + tranche.max) / 2) * (1 + CFE.TAXE_ADDITIONNELLE));
    }
  }
  return 0;
}

/**
 * Estime la CVAE annuelle.
 */
export function estimateCVAE(ca: number, valeurAjoutee: number): number {
  const taux = computeCVAETaux(ca);
  if (taux === 0) return 0;
  return Math.round(valeurAjoutee * taux * 100) / 100;
}

// ── Configuration par forme juridique ──────────────────────────────────────────

export type SocialRegimeType = 'TNS' | 'ASSIMILE_SALARIE' | 'MICRO_SOCIAL';

export type LegalFormConfig = {
  code: BusinessLegalForm;
  label: string;
  description: string;
  defaultTaxRegime: TaxRegime;
  allowedTaxRegimes: TaxRegime[];
  defaultSocialRegime: SocialRegimeType;
  minAssocies: number;
  maxAssocies: number | null;
  leaderTitle: string;
  features: { hasStock: boolean; hasTeam: boolean; hasAdvancedAccounting: boolean };
};

export const LEGAL_FORM_CONFIGS: LegalFormConfig[] = [
  {
    code: 'MICRO',
    label: 'Micro-entreprise',
    description: 'Regime simplifie, plafonds de CA, cotisations forfaitaires.',
    defaultTaxRegime: 'IR',
    allowedTaxRegimes: ['IR'],
    defaultSocialRegime: 'MICRO_SOCIAL',
    minAssocies: 1, maxAssocies: 1,
    leaderTitle: 'Entrepreneur individuel',
    features: { hasStock: false, hasTeam: false, hasAdvancedAccounting: false },
  },
  {
    code: 'EI',
    label: 'Entreprise individuelle',
    description: 'IR par defaut, option IS depuis 2022.',
    defaultTaxRegime: 'IR',
    allowedTaxRegimes: ['IR', 'IS'],
    defaultSocialRegime: 'TNS',
    minAssocies: 1, maxAssocies: 1,
    leaderTitle: 'Entrepreneur individuel',
    features: { hasStock: true, hasTeam: false, hasAdvancedAccounting: true },
  },
  {
    code: 'EURL',
    label: 'EURL',
    description: 'Societe unipersonnelle, IR par defaut (option IS).',
    defaultTaxRegime: 'IR',
    allowedTaxRegimes: ['IR', 'IS'],
    defaultSocialRegime: 'TNS',
    minAssocies: 1, maxAssocies: 1,
    leaderTitle: 'Gerant',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'SARL',
    label: 'SARL',
    description: 'IS par defaut. Gerant majoritaire = TNS.',
    defaultTaxRegime: 'IS',
    allowedTaxRegimes: ['IS', 'IR'],
    defaultSocialRegime: 'TNS',
    minAssocies: 2, maxAssocies: 100,
    leaderTitle: 'Gerant',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'SAS',
    label: 'SAS',
    description: 'IS, president = assimile salarie.',
    defaultTaxRegime: 'IS',
    allowedTaxRegimes: ['IS'],
    defaultSocialRegime: 'ASSIMILE_SALARIE',
    minAssocies: 2, maxAssocies: null,
    leaderTitle: 'President',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'SASU',
    label: 'SASU',
    description: 'IS, president = assimile salarie.',
    defaultTaxRegime: 'IS',
    allowedTaxRegimes: ['IS'],
    defaultSocialRegime: 'ASSIMILE_SALARIE',
    minAssocies: 1, maxAssocies: 1,
    leaderTitle: 'President',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'SA',
    label: 'SA',
    description: 'Societe anonyme, IS, DG = assimile salarie. Capital min 37 000 EUR.',
    defaultTaxRegime: 'IS',
    allowedTaxRegimes: ['IS'],
    defaultSocialRegime: 'ASSIMILE_SALARIE',
    minAssocies: 2, maxAssocies: null,
    leaderTitle: 'Directeur general',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'SCI',
    label: 'SCI',
    description: 'Societe civile immobiliere, IR par defaut.',
    defaultTaxRegime: 'IR',
    allowedTaxRegimes: ['IR', 'IS'],
    defaultSocialRegime: 'TNS',
    minAssocies: 2, maxAssocies: null,
    leaderTitle: 'Gerant',
    features: { hasStock: false, hasTeam: false, hasAdvancedAccounting: true },
  },
  {
    code: 'SNC',
    label: 'SNC',
    description: 'Societe en nom collectif, IR, tous associes = TNS.',
    defaultTaxRegime: 'IR',
    allowedTaxRegimes: ['IR', 'IS'],
    defaultSocialRegime: 'TNS',
    minAssocies: 2, maxAssocies: null,
    leaderTitle: 'Gerant',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
  {
    code: 'OTHER',
    label: 'Autre',
    description: 'Forme juridique non listee.',
    defaultTaxRegime: 'IS',
    allowedTaxRegimes: ['IS', 'IR'],
    defaultSocialRegime: 'ASSIMILE_SALARIE',
    minAssocies: 1, maxAssocies: null,
    leaderTitle: 'Dirigeant',
    features: { hasStock: true, hasTeam: true, hasAdvancedAccounting: true },
  },
];

export function getLegalFormConfig(code: string): LegalFormConfig | undefined {
  return LEGAL_FORM_CONFIGS.find((f) => f.code === code);
}

// ── Estimation fiscale globale ───────────────────────────────────────────────────

export type FiscalEstimation = {
  legalForm: BusinessLegalForm;
  taxRegime: TaxRegime;
  ca: number;
  charges: number;
  resultat: number;
  impot: number;
  tauxEffectif: number;
  cotisationsSociales: number;
  tvaRegime: VatRegime;
  revenuNetApresImpots: number;
};

/**
 * Estimation fiscale simplifiée pour n'importe quel type de société.
 */
export function estimateFiscal(params: {
  legalForm: BusinessLegalForm;
  taxRegime?: TaxRegime;
  ca: number;
  charges: number;
  isVente?: boolean;
  microActivite?: MicroActivityType;
  versementLiberatoire?: boolean;
  nbParts?: number;
}): FiscalEstimation {
  const {
    legalForm,
    ca,
    charges,
    isVente = false,
    microActivite = 'SERVICES_BIC',
    versementLiberatoire = false,
    nbParts = 1,
  } = params;

  const tvaRegime = determineVatRegime(ca, isVente);

  // Micro-entreprise
  if (legalForm === 'MICRO') {
    const micro = computeMicroCharges(ca, microActivite, versementLiberatoire, false, false, nbParts);
    return {
      legalForm,
      taxRegime: 'IR',
      ca,
      charges,
      resultat: ca - charges,
      impot: micro.ir,
      tauxEffectif: ca > 0 ? (micro.total / ca) * 100 : 0,
      cotisationsSociales: micro.cotisations,
      tvaRegime,
      revenuNetApresImpots: micro.revenuNet,
    };
  }

  const resultat = ca - charges;
  const taxRegime = params.taxRegime ?? (['SAS', 'SASU', 'SA', 'SARL'].includes(legalForm) ? 'IS' : 'IR');

  if (taxRegime === 'IS') {
    const impot = computeIS(Math.max(0, resultat));
    const tauxEffectif = resultat > 0 ? (impot / resultat) * 100 : 0;
    // Cotisations : dépend du statut du dirigeant
    const cotisations = legalForm === 'SARL'
      ? estimateTNSCotisations(resultat * 0.5) // Approximation : rémunération = 50% du résultat
      : 0; // SAS : cotisations incluses dans les charges salariales
    return {
      legalForm,
      taxRegime,
      ca,
      charges,
      resultat,
      impot,
      tauxEffectif,
      cotisationsSociales: cotisations,
      tvaRegime,
      revenuNetApresImpots: resultat - impot,
    };
  }

  // IR (EURL, EI)
  const revenuImposable = Math.max(0, resultat);
  const impot = computeIR(revenuImposable, nbParts);
  const cotisations = estimateTNSCotisations(revenuImposable);
  const tauxEffectif = revenuImposable > 0 ? ((impot + cotisations) / revenuImposable) * 100 : 0;
  return {
    legalForm,
    taxRegime,
    ca,
    charges,
    resultat,
    impot,
    tauxEffectif,
    cotisationsSociales: cotisations,
    tvaRegime,
    revenuNetApresImpots: resultat - impot - cotisations,
  };
}

// ── Labels ───────────────────────────────────────────────────────────────────────

export const LEGAL_FORM_LABELS: Record<BusinessLegalForm, string> = {
  SAS: 'SAS',
  SASU: 'SASU',
  SARL: 'SARL',
  EURL: 'EURL',
  SA: 'SA',
  EI: 'Entreprise individuelle',
  MICRO: 'Micro-entreprise',
  SCI: 'SCI',
  SNC: 'SNC',
  OTHER: 'Autre',
};

export const VAT_REGIME_LABELS: Record<VatRegime, string> = {
  FRANCHISE: 'Franchise en base',
  SIMPLIFIE: 'Regime simplifie',
  REEL_NORMAL: 'Regime reel normal',
};

export const SOCIAL_REGIME_LABELS: Record<SocialRegimeType, string> = {
  TNS: 'TNS (Travailleur Non Salarie)',
  ASSIMILE_SALARIE: 'Assimile salarie',
  MICRO_SOCIAL: 'Micro-social simplifie',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  SERVICE: 'Services',
  COMMERCE: 'Commerce',
  MIXTE: 'Mixte',
  LIBERALE: 'Liberale',
};

export const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'Stage',
  ALTERNANCE: 'Alternance',
  FREELANCE: 'Freelance',
};
