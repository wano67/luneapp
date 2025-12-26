export function formatCurrencyEUR(valueCents?: number | null, options?: { minimumFractionDigits?: number }) {
  const cents = typeof valueCents === 'number' && Number.isFinite(valueCents) ? valueCents : 0;
  const minimumFractionDigits = options?.minimumFractionDigits ?? 2;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits,
    maximumFractionDigits: minimumFractionDigits,
  }).format(cents / 100);
}
