'use client';

import type { ReactNode } from 'react';
import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayKey, startOfMonth, addMonths, startOfWeek, addDays } from '@/lib/date';
import {
  buildMonthGrid,
  groupEventsByDay,
  EVENT_COLORS,
  type CalendarEvent,
} from '@/lib/calendar';

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

type CalendarGridProps = {
  events: CalendarEvent[];
  loading?: boolean;
  filters?: ReactNode;
  onDayClick?: (date: string, events: CalendarEvent[]) => void;
  /** Called when the visible month changes — parent should refetch events. */
  onMonthChange?: (year: number, month: number) => void;
};

export function CalendarGrid({ events, loading, filters, onDayClick, onMonthChange }: CalendarGridProps) {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const [mobileSelected, setMobileSelected] = useState(() => dayKey(new Date()));

  const year = current.getFullYear();
  const month = current.getMonth();
  const todayKey = dayKey(new Date());

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  const navigate = useCallback((offset: number) => {
    const next = addMonths(current, offset);
    setCurrent(startOfMonth(next));
    onMonthChange?.(next.getFullYear(), next.getMonth());
  }, [current, onMonthChange]);

  const goToday = useCallback(() => {
    const now = new Date();
    setCurrent(startOfMonth(now));
    setMobileSelected(dayKey(now));
    onMonthChange?.(now.getFullYear(), now.getMonth());
  }, [onMonthChange]);

  // Mobile: current week strip
  const mobileWeekStart = useMemo(() => {
    const sel = new Date(mobileSelected + 'T00:00:00');
    return startOfWeek(sel);
  }, [mobileSelected]);
  const mobileWeek = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(mobileWeekStart, i));
    return days;
  }, [mobileWeekStart]);

  const mobileEvents = useMemo(() => grouped.get(mobileSelected) ?? [], [grouped, mobileSelected]);

  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text)' }} />
          </button>
          <h2 className="text-base font-semibold min-w-[160px] text-center" style={{ color: 'var(--text)' }}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex items-center justify-center rounded-lg hover:opacity-70 transition-opacity"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            <ChevronRight size={16} style={{ color: 'var(--text)' }} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            Aujourd&apos;hui
          </button>
        </div>
        {filters}
      </div>

      {/* Desktop: month grid */}
      <div className="hidden md:block">
        {loading ? (
          <SkeletonGrid />
        ) : (
          <div
            className="grid grid-cols-7 rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {/* Day name headers */}
            {DAY_NAMES.map((name) => (
              <div
                key={name}
                className="text-center text-[11px] font-semibold uppercase tracking-wider py-2"
                style={{ color: 'var(--text-faint)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}
              >
                {name}
              </div>
            ))}
            {/* Day cells */}
            {grid.map((date) => {
              const key = dayKey(date);
              const isCurrentMonth = date.getMonth() === month;
              const isToday = key === todayKey;
              const dayEvents = grouped.get(key) ?? [];

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onDayClick?.(key, dayEvents)}
                  className="text-left transition-colors hover:bg-[var(--surface-hover)]"
                  style={{
                    minHeight: 80,
                    padding: '4px 6px',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    background: isToday ? 'var(--info-bg)' : undefined,
                  }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{
                      color: isToday ? 'var(--info)' : isCurrentMonth ? 'var(--text)' : 'var(--text-faint)',
                      fontWeight: isToday ? 700 : 500,
                    }}
                  >
                    {date.getDate()}
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <EventPill key={ev.id} event={ev} />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] font-medium pl-1" style={{ color: 'var(--text-faint)' }}>
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile: week strip + day list */}
      <div className="md:hidden space-y-3">
        {/* Week strip */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMobileSelected(dayKey(addDays(new Date(mobileSelected + 'T00:00:00'), -7)))}
            className="p-1 rounded hover:opacity-70"
          >
            <ChevronLeft size={14} style={{ color: 'var(--text-faint)' }} />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {mobileWeek.map((date) => {
              const key = dayKey(date);
              const isSelected = key === mobileSelected;
              const isToday = key === todayKey;
              const hasEvents = (grouped.get(key)?.length ?? 0) > 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileSelected(key)}
                  className="flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors"
                  style={{
                    background: isSelected ? 'var(--shell-accent)' : isToday ? 'var(--info-bg)' : undefined,
                  }}
                >
                  <span className="text-[10px]" style={{ color: isSelected ? 'white' : 'var(--text-faint)' }}>
                    {DAY_NAMES[mobileWeek.indexOf(date)]}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isSelected ? 'white' : isToday ? 'var(--info)' : 'var(--text)' }}
                  >
                    {date.getDate()}
                  </span>
                  {hasEvents && (
                    <div
                      className="h-1 w-1 rounded-full"
                      style={{ background: isSelected ? 'white' : 'var(--shell-accent)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setMobileSelected(dayKey(addDays(new Date(mobileSelected + 'T00:00:00'), 7)))}
            className="p-1 rounded hover:opacity-70"
          >
            <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />
          </button>
        </div>

        {/* Day events list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-skeleton-pulse" style={{ background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : mobileEvents.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-faint)' }}>
            Aucun événement
          </p>
        ) : (
          <div className="space-y-2">
            {mobileEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onDayClick?.(mobileSelected, mobileEvents)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: EVENT_COLORS[ev.type].text }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{ev.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    {EVENT_COLORS[ev.type] ? ev.type.charAt(0).toUpperCase() + ev.type.slice(1) : ev.type}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventPill({ event }: { event: CalendarEvent }) {
  const colors = EVENT_COLORS[event.type];
  return (
    <div
      className="rounded px-1.5 py-0.5 text-[10px] font-medium truncate leading-tight"
      style={{ background: colors.bg, color: colors.text }}
    >
      {event.title}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {DAY_NAMES.map((name) => (
        <div key={name} className="text-center text-[11px] py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ color: 'var(--text-faint)' }}>{name}</span>
        </div>
      ))}
      {Array.from({ length: 42 }).map((_, i) => (
        <div
          key={i}
          className="animate-skeleton-pulse"
          style={{ minHeight: 80, background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
        />
      ))}
    </div>
  );
}
