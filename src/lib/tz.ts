/**
 * Timezone-aware date helpers for calendar API routes.
 *
 * The server runs in UTC (or whatever TZ the host uses). These helpers use
 * `Intl.DateTimeFormat` to project a UTC Date into the **user's** timezone
 * before extracting day-key or formatted time.
 */

const dayFmtCache = new Map<string, Intl.DateTimeFormat>();
const timeFmtCache = new Map<string, Intl.DateTimeFormat>();

function getDayFmt(tz: string): Intl.DateTimeFormat {
  let fmt = dayFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFmtCache.set(tz, fmt);
  }
  return fmt;
}

function getTimeFmt(tz: string): Intl.DateTimeFormat {
  let fmt = timeFmtCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    timeFmtCache.set(tz, fmt);
  }
  return fmt;
}

/** Returns "YYYY-MM-DD" in the given timezone. */
export function tzDayKey(date: Date, tz: string): string {
  return getDayFmt(tz).format(date); // en-CA locale → "YYYY-MM-DD"
}

/** Returns "HH:MM" (24h, fr-FR) in the given timezone. */
export function tzTimeStr(date: Date, tz: string): string {
  return getTimeFmt(tz).format(date);
}

/** Validate a timezone string. Returns the string if valid, 'UTC' otherwise. */
export function safeTz(raw: string | null | undefined): string {
  if (!raw) return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: raw });
    return raw;
  } catch {
    return 'UTC';
  }
}
