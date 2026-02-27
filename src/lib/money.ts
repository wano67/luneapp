// src/lib/money.ts
export function sanitizeEuroInput(value: string) {
  if (!value) return '';
  const raw = value.replace(/\s+/g, '').replace(/[^\d.,]/g, '');
  let out = '';
  let hasSeparator = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if ((ch === '.' || ch === ',') && !hasSeparator) {
      out += ',';
      hasSeparator = true;
    }
  }
  if (!hasSeparator) return out;
  const [whole, fraction = ''] = out.split(',');
  const trimmedFraction = fraction.slice(0, 2);
  const safeWhole = whole || '0';
  return trimmedFraction ? `${safeWhole},${trimmedFraction}` : `${safeWhole},`;
}

export function parseEuroToCents(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return Number.NaN;
    if (input < 0) return Number.NaN;
    const cents = Math.round(input * 100);
    return Number.isSafeInteger(cents) ? cents : Number.NaN;
  }

  const raw = input.trim();
  if (!raw) return Number.NaN;
  if (raw.includes('-')) return Number.NaN;

  let whole = '';
  let fraction = '';
  let hasSeparator = false;

  for (const ch of raw.replace(/\s+/g, '').replace(/[^\d.,]/g, '')) {
    if (ch >= '0' && ch <= '9') {
      if (hasSeparator) {
        fraction += ch;
      } else {
        whole += ch;
      }
      continue;
    }
    if ((ch === '.' || ch === ',') && !hasSeparator) {
      hasSeparator = true;
    }
  }

  if (!whole && !fraction) return Number.NaN;

  const euros = whole ? Number(whole) : 0;
  if (!Number.isFinite(euros)) return Number.NaN;

  const baseFraction = fraction.slice(0, 2).padEnd(2, '0');
  const fracValue = baseFraction ? Number(baseFraction) : 0;
  if (!Number.isFinite(fracValue)) return Number.NaN;

  let cents = euros * 100 + fracValue;
  if (fraction.length > 2) {
    const roundDigit = Number(fraction[2]);
    if (Number.isFinite(roundDigit) && roundDigit >= 5) {
      cents += 1;
    }
  }

  if (!Number.isSafeInteger(cents)) return Number.NaN;
  return Math.max(0, cents);
}

export function formatCentsToEuroInput(cents: number | string | bigint | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return '';
  try {
    const value =
      typeof cents === 'bigint'
        ? cents
        : typeof cents === 'number'
        ? BigInt(Math.trunc(cents))
        : BigInt(String(cents));
    const sign = value < 0n ? '-' : '';
    const abs = value < 0n ? -value : value;
    const euros = abs / 100n;
    const remainder = abs % 100n;
    if (remainder === 0n) return `${sign}${euros.toString()}`;
    return `${sign}${euros.toString()},${remainder.toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function formatCentsToEuroDisplay(cents: number | string | bigint | null | undefined, currency = 'EUR') {
  if (cents === null || cents === undefined || cents === '') return '—';
  const num =
    typeof cents === 'bigint'
      ? Number(cents)
      : typeof cents === 'number'
      ? cents
      : Number(cents);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num / 100);
}

export function parseCentsInput(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    if (Number.isInteger(raw)) return Math.trunc(raw);
    const cents = parseEuroToCents(raw);
    return Number.isFinite(cents) ? cents : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/[.,]/.test(trimmed)) {
      const cents = parseEuroToCents(trimmed);
      return Number.isFinite(cents) ? cents : null;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    if (Number.isInteger(num)) return Math.trunc(num);
    const cents = parseEuroToCents(num);
    return Number.isFinite(cents) ? cents : null;
  }
  return null;
}

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
