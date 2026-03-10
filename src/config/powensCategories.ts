/**
 * Mapping des ID catégories Powens → noms français.
 * Ces noms correspondent aux PersonalCategory.name (@@unique par userId).
 *
 * Source : documentation Powens /banks/categories
 * Les IDs sont stables dans l'API Powens.
 */
export const POWENS_CATEGORY_MAP: Record<number, string> = {
  1: 'Alimentation & Restauration',
  2: 'Auto & Transport',
  3: 'Frais bancaires',
  4: 'Loisirs & Sorties',
  5: 'Santé',
  6: 'Shopping',
  7: 'Logement',
  8: 'Impôts & Taxes',
  9: 'Revenus',
  10: 'Épargne',
  11: 'Éducation',
  12: 'Abonnements & Télécom',
  13: 'Voyages',
  14: 'Cadeaux & Dons',
  15: 'Vie quotidienne',
  16: 'Assurance',
  17: 'Services professionnels',
};
