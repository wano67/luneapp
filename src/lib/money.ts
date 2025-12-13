// src/lib/money.ts
export function formatCents(cents: string | number | bigint, currency = 'EUR') {
  const n =
    typeof cents === 'bigint'
      ? Number(cents)
      : typeof cents === 'number'
      ? cents
      : Number(cents);

  const value = Number.isFinite(n) ? n / 100 : 0;

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function absCents(cents: string) {
  try {
    const b = BigInt(cents);
    return (b < 0 ? -b : b).toString();
  } catch {
    return cents;
  }
}
