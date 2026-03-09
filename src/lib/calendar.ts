import { dayKey, addDays, addMonths } from './date';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CalendarEventType = 'task' | 'interaction' | 'subscription' | 'finance' | 'savings';

export type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: CalendarEventType;
  meta?: Record<string, unknown>;
};

export const EVENT_COLORS: Record<CalendarEventType, { bg: string; text: string }> = {
  task:         { bg: 'var(--info-bg)',    text: 'var(--info)' },
  interaction:  { bg: 'var(--warning-bg)', text: 'var(--warning)' },
  subscription: { bg: 'var(--danger-bg)',  text: 'var(--danger)' },
  finance:      { bg: 'var(--success-bg)', text: 'var(--success)' },
  savings:      { bg: 'var(--accent)',     text: 'white' },
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  task: 'Tâche',
  interaction: 'Interaction',
  subscription: 'Abonnement',
  finance: 'Revenu',
  savings: 'Épargne',
};

// ─── Grid builder ────────────────────────────────────────────────────────────

/** Build a 42-cell (6 weeks) grid for the given month, starting from Monday. */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun … 6=Sat
  const offset = dow === 0 ? 6 : dow - 1; // days before first Monday
  const start = new Date(year, month, 1 - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

// ─── Event grouping ──────────────────────────────────────────────────────────

/** Group events by their date key for O(1) lookup per cell. */
export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.date);
    if (list) {
      list.push(ev);
    } else {
      map.set(ev.date, [ev]);
    }
  }
  return map;
}

// ─── Recurring projection ────────────────────────────────────────────────────

type ProjectOpts = {
  startDate: Date;
  endDate: Date | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth?: number; // override for MONTHLY (e.g. FinanceRecurringRule.dayOfMonth)
  rangeFrom: Date;
  rangeTo: Date;
};

/** Project recurring occurrences into a [rangeFrom, rangeTo] window. */
export function projectRecurring(opts: ProjectOpts): Date[] {
  const { startDate, endDate, frequency, dayOfMonth, rangeFrom, rangeTo } = opts;
  const dates: Date[] = [];

  let cursor = new Date(startDate);
  // For MONTHLY with explicit dayOfMonth, align to that day
  if ((frequency === 'MONTHLY' || frequency === 'QUARTERLY' || frequency === 'YEARLY') && dayOfMonth != null) {
    cursor.setDate(Math.min(dayOfMonth, daysInMonth(cursor.getFullYear(), cursor.getMonth())));
  }

  const maxIterations = 500; // safety cap
  let i = 0;
  while (i++ < maxIterations) {
    if (endDate && cursor > endDate) break;
    if (cursor > rangeTo) break;

    if (cursor >= rangeFrom) {
      dates.push(new Date(cursor));
    }

    // Advance cursor
    switch (frequency) {
      case 'WEEKLY':
        cursor = addDays(cursor, 7);
        break;
      case 'MONTHLY':
        cursor = advanceMonth(cursor, 1, dayOfMonth);
        break;
      case 'QUARTERLY':
        cursor = advanceMonth(cursor, 3, dayOfMonth);
        break;
      case 'YEARLY':
        cursor = advanceMonth(cursor, 12, dayOfMonth);
        break;
    }
  }

  return dates;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function advanceMonth(date: Date, months: number, dayOfMonth?: number): Date {
  const next = addMonths(date, months);
  if (dayOfMonth != null) {
    const maxDay = daysInMonth(next.getFullYear(), next.getMonth());
    next.setDate(Math.min(dayOfMonth, maxDay));
  }
  return next;
}
