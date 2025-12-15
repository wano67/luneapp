// src/lib/money.ts
export function formatCents(cents: string | number | bigint, currency = 'EUR') {
  try {
    const b =
      typeof cents === 'bigint'
        ? cents
        : typeof cents === 'number'
        ? BigInt(Math.trunc(cents))
        : BigInt(cents);

    const sign = b < 0n ? '-' : '';
    const abs = b < 0n ? -b : b;
    const euros = abs / 100n;
    const remainder = abs % 100n;

    return `${sign}${euros.toString()}.${remainder.toString().padStart(2, '0')} ${currency}`;
  } catch {
    return `0.00 ${currency}`;
  }
}

export function formatCentsExact(cents: string | number | bigint, currency = 'EUR') {
  return formatCents(cents, currency);
}

export function absCents(cents: string) {
  try {
    const b = BigInt(cents);
    return (b < 0 ? -b : b).toString();
  } catch {
    return cents;
  }
}
