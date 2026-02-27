/**
 * Parsers centralisés pour les routes API.
 *
 * Règle : ne jamais redéfinir parseId / parseDate dans une route.
 * Importer depuis ici.
 */

// ---------------------------------------------------------------------------
// Erreur dédiée au parsing de route — interceptée par routeHandler
// ---------------------------------------------------------------------------

export class RouteParseError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RouteParseError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// IDs (BigInt)
// ---------------------------------------------------------------------------

/** Parse un ID string en BigInt. Lance RouteParseError si invalide. */
export function parseId(param: string | undefined | null): bigint {
  if (!param || !/^\d+$/.test(param)) {
    throw new RouteParseError(`ID invalide : "${param}"`);
  }
  try {
    return BigInt(param);
  } catch {
    throw new RouteParseError(`ID invalide : "${param}"`);
  }
}

/** Variante nullable — retourne null si absent. */
export function parseIdOpt(param: string | undefined | null): bigint | null {
  if (!param) return null;
  return parseId(param);
}

/**
 * Parse un ID depuis le body JSON.
 * Lance RouteParseError si présent mais invalide.
 */
export function parseBodyId(value: unknown): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RouteParseError(`ID invalide dans le body : "${value}"`);
  }
  const str = String(value).trim();
  if (!str) return null;
  return parseId(str);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Parse une date ISO. Lance RouteParseError si invalide. */
export function parseDate(value: unknown): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RouteParseError(`Date invalide : "${value}"`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new RouteParseError(`Date invalide : "${value}"`);
  }
  return d;
}

/** Variante nullable. */
export function parseDateOpt(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  return parseDate(value);
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Valide qu'une valeur appartient à un ensemble d'enums autorisés.
 * @example parseEnum(body.type, ['INCOME', 'EXPENSE'] as const)
 */
export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label = 'valeur'
): T {
  if (!allowed.includes(value as T)) {
    throw new RouteParseError(
      `${label} invalide. Valeurs acceptées : ${allowed.join(', ')}. Reçu : "${value}"`
    );
  }
  return value as T;
}

/** Variante nullable. */
export function parseEnumOpt<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label = 'valeur'
): T | null {
  if (value === null || value === undefined || value === '') return null;
  return parseEnum(value, allowed, label);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Extrait un string trimé depuis le body. Retourne null si absent/vide. */
export function parseStr(value: unknown, maxLength?: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (maxLength && trimmed.length > maxLength) {
    throw new RouteParseError(`Champ trop long (max ${maxLength} caractères).`);
  }
  return trimmed;
}

/** Extrait un nombre entier. Retourne null si absent. */
export function parseIntOpt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

/** Extrait un booléen. */
export function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

// ---------------------------------------------------------------------------
// IDs array (pour bulk operations)
// ---------------------------------------------------------------------------

/** Parse un tableau d'IDs BigInt depuis le body. */
export function parseIdArray(value: unknown): bigint[] {
  if (!Array.isArray(value)) throw new RouteParseError('Un tableau d\'IDs est attendu.');
  return value.map((v, i) => {
    try {
      return parseId(String(v));
    } catch {
      throw new RouteParseError(`ID invalide à l'index ${i} : "${v}"`);
    }
  });
}
