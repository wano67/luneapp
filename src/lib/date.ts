/** Add N months to a date (simple version — no day-of-month clamping). */
export function addMonths(date: Date, count: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

/** Return midnight of the first day of the given date's month. */
export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a date as "YYYY-MM". */
export function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Format a date as "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Return the Monday of the given date's ISO week. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Format a date's ISO week start as "YYYY-WNN". */
export function weekKey(date: Date): string {
  const monday = startOfWeek(date);
  return `W-${dayKey(monday)}`;
}

/** Add N days to a date. */
export function addDays(date: Date, count: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + count);
  return d;
}
