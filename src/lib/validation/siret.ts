import { luhnCheck } from './luhn';

export function normalizeSiret(value: string): string {
  return value.replace(/[^\d]/g, '').trim();
}

export function isValidSiret(value: string): boolean {
  const digits = normalizeSiret(value);
  if (digits.length !== 14) return false;
  return luhnCheck(digits);
}

export function normalizeVat(value: string): string {
  return value.replace(/[\s\-.]/g, '').toUpperCase();
}

export function isValidVat(value: string, countryCode?: string): { ok: boolean; warning?: string } {
  const normalized = normalizeVat(value);
  if (!normalized) return { ok: false };
  if (!/^[A-Z]{2}[A-Z0-9]{6,18}$/.test(normalized)) return { ok: false };

  if (normalized.startsWith('FR')) {
    if (!/^FR[A-HJ-NP-Z0-9]{2}\d{9}$/.test(normalized)) return { ok: false };
  } else if (countryCode && countryCode !== normalized.slice(0, 2)) {
    return { ok: false };
  }

  return { ok: true };
}
