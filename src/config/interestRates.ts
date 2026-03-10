/**
 * Taux de référence réglementés français (mars 2026).
 * interestRateBps = taux annuel en points de base (250 = 2.50 %).
 */
export type ReferenceRate = {
  label: string;
  rateBps: number;
  ceilingCents: number | null; // plafond en centimes, null si pas de plafond
};

export const REFERENCE_RATES: ReferenceRate[] = [
  { label: 'Livret A', rateBps: 250, ceilingCents: 2_295_000 },
  { label: 'LDDS', rateBps: 250, ceilingCents: 1_200_000 },
  { label: 'LEP', rateBps: 400, ceilingCents: 1_000_000 },
  { label: 'PEL', rateBps: 225, ceilingCents: null },
  { label: 'Livret Jeune', rateBps: 250, ceilingCents: 160_000 },
];

/**
 * Retourne le meilleur taux de référence applicable
 * pour un montant donné (en centimes).
 */
export function bestReferenceRate(balanceCents: bigint): ReferenceRate | null {
  // Priorité : LEP > Livret A > LDDS (plus haut taux d'abord)
  const sorted = [...REFERENCE_RATES].sort((a, b) => b.rateBps - a.rateBps);
  for (const rate of sorted) {
    if (rate.ceilingCents == null || balanceCents <= BigInt(rate.ceilingCents)) {
      return rate;
    }
  }
  return sorted[sorted.length - 1] ?? null;
}
