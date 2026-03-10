/** Format cents to EUR display (e.g. "1 500 €") */
export function fmtKpi(cents: string | number | null | undefined): string {
  if (!cents) return '0 €';
  const n = Number(cents);
  if (!Number.isFinite(n)) return '0 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n / 100);
}

/** Format ISO date to French locale (e.g. "3 mars 2026") */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
