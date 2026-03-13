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

/**
 * Format a date string as a human-readable relative time.
 * Long form: "À l'instant", "Il y a 5 min", "Hier", "Il y a 3j", "12 mars"
 * Short form: "maintenant", "5min", "3j", "12 mars"
 */
export function formatRelativeDate(dateStr: string, short = false): string {
  try {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return short ? 'maintenant' : 'À l\'instant';
    if (diffMin < 60) return short ? `${diffMin}min` : `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return short ? `${diffH}h` : `Il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return short ? '1j' : 'Hier';
    if (diffD < 7) return short ? `${diffD}j` : `Il y a ${diffD}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/** Format a date string as time (e.g. "14:30") */
export function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
