/**
 * Financial calculation utilities.
 *
 * All money amounts are in cents (bigint).
 * Interest rates are in basis points (bps): 150 = 1.50%.
 */

/* ═══ Loan calculations ═══ */

/**
 * Monthly payment for a fixed-rate loan (annuité constante).
 * Formula: M = P × [r(1+r)^n] / [(1+r)^n - 1]
 * Uses floating-point for the math, then rounds to nearest cent.
 */
export function loanMonthlyPaymentCents(
  principalCents: bigint,
  annualRateBps: number,
  months: number,
): bigint {
  if (months <= 0) return 0n;
  if (annualRateBps <= 0) {
    // Zero-interest: simple division
    return BigInt(Math.ceil(Number(principalCents) / months));
  }

  const P = Number(principalCents);
  const r = annualRateBps / 10_000 / 12; // monthly rate
  const n = months;
  const factor = Math.pow(1 + r, n);
  const monthly = P * (r * factor) / (factor - 1);

  return BigInt(Math.round(monthly));
}

/**
 * Total cost of a loan (principal + interest).
 */
export function loanTotalCostCents(
  principalCents: bigint,
  annualRateBps: number,
  months: number,
): bigint {
  const monthly = loanMonthlyPaymentCents(principalCents, annualRateBps, months);
  return monthly * BigInt(months);
}

/**
 * Total interest paid over the life of a loan.
 */
export function loanTotalInterestCents(
  principalCents: bigint,
  annualRateBps: number,
  months: number,
): bigint {
  return loanTotalCostCents(principalCents, annualRateBps, months) - principalCents;
}

/* ═══ Savings yield calculations ═══ */

/**
 * Estimated annual yield for a savings account.
 * Simple calculation: balance × rate.
 */
export function annualYieldCents(balanceCents: bigint, rateBps: number): bigint {
  if (rateBps <= 0) return 0n;
  return (balanceCents * BigInt(rateBps)) / 10_000n;
}

/* ═══ Formatting helpers ═══ */

/**
 * Format basis points to percentage string (e.g., 150 → "1,50%").
 */
export function formatRateBps(bps: number): string {
  const pct = bps / 100;
  return pct.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}
