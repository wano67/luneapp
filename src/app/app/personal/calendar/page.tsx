'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import { DayDetailPanel } from '@/components/ui/calendar/DayDetailPanel';
import { fetchJson } from '@/lib/apiClient';
import { dayKey, startOfMonth, addMonths, addDays } from '@/lib/date';
import { EVENT_TYPE_LABELS, type CalendarEvent, type CalendarEventType } from '@/lib/calendar';

const FILTER_OPTIONS: { value: CalendarEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'subscription', label: EVENT_TYPE_LABELS.subscription },
  { value: 'finance', label: EVENT_TYPE_LABELS.finance },
  { value: 'savings', label: EVENT_TYPE_LABELS.savings },
];

export default function PersonalCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<CalendarEventType | 'all'>('all');

  const loadEvents = useCallback(async (month: Date, signal?: AbortSignal) => {
    setLoading(true);
    const from = addDays(startOfMonth(month), -7);
    const to = addDays(startOfMonth(addMonths(month, 1)), 7);
    const res = await fetchJson<{ items: CalendarEvent[] }>(
      `/api/personal/calendar/events?from=${dayKey(from)}&to=${dayKey(to)}`,
      {},
      signal,
    );
    if (signal?.aborted) return;
    if (res.ok && res.data) setEvents(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadEvents(new Date(), controller.signal);
    return () => controller.abort();
  }, [loadEvents]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    const controller = new AbortController();
    void loadEvents(new Date(year, month, 1), controller.signal);
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  const selectedEvents = useMemo(
    () => (selectedDay ? filteredEvents.filter((e) => e.date === selectedDay) : []),
    [selectedDay, filteredEvents],
  );

  const filters = (
    <div className="flex items-center gap-1.5">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setFilterType(opt.value)}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            background: filterType === opt.value ? 'var(--shell-accent)' : 'var(--surface-2)',
            color: filterType === opt.value ? 'white' : 'var(--text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageContainer className="gap-5">
      <PageHeader
        title="Calendrier"
        subtitle="Abonnements, revenus et objectifs d'épargne"
      />
      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          <CalendarGrid
            events={filteredEvents}
            loading={loading}
            filters={filters}
            onDayClick={(date) => setSelectedDay(date)}
            onMonthChange={handleMonthChange}
          />
        </div>
        {selectedDay && (
          <DayDetailPanel
            date={selectedDay}
            events={selectedEvents}
            open
            onClose={() => setSelectedDay(null)}
          />
        )}
      </div>
    </PageContainer>
  );
}
