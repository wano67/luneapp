'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, CalendarPlus, Bell, RefreshCw } from 'lucide-react';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import { DayDetailPanel } from '@/components/ui/calendar/DayDetailPanel';
import { CalendarSyncPanel } from '@/components/ui/calendar/CalendarSyncPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';
import { dayKey, startOfMonth, addMonths, addDays } from '@/lib/date';
import { EVENT_TYPE_LABELS, type CalendarEvent, type CalendarEventType } from '@/lib/calendar';

type CreateKind = 'APPOINTMENT' | 'REMINDER' | null;

const FILTER_OPTIONS: { value: CalendarEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'event', label: EVENT_TYPE_LABELS.event },
  { value: 'subscription', label: EVENT_TYPE_LABELS.subscription },
  { value: 'finance', label: EVENT_TYPE_LABELS.finance },
  { value: 'savings', label: EVENT_TYPE_LABELS.savings },
];

export default function PersonalCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<CalendarEventType | 'all'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createDate, setCreateDate] = useState('');
  const [createTimeStart, setCreateTimeStart] = useState('');
  const [createTimeEnd, setCreateTimeEnd] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const [fetchVersion, setFetchVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const from = addDays(startOfMonth(currentMonth), -7);
    const to = addDays(startOfMonth(addMonths(currentMonth, 1)), 7);
    fetchJson<{ items: CalendarEvent[] }>(
      `/api/personal/calendar/events?from=${dayKey(from)}&to=${dayKey(to)}`,
      {},
      controller.signal,
    ).then(res => {
      if (controller.signal.aborted) return;
      if (res.ok && res.data) setEvents(res.data.items);
      setLoading(false);
    });
    return () => controller.abort();
  }, [currentMonth, fetchVersion]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    setCurrentMonth(new Date(year, month, 1));
  }, []);

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  const selectedEvents = useMemo(
    () => (selectedDay ? filteredEvents.filter((e) => e.date === selectedDay) : []),
    [selectedDay, filteredEvents],
  );

  // Create modal logic
  const openCreate = useCallback((prefillDate?: string) => {
    setCreateKind(null);
    setCreateTitle('');
    setCreateDate(prefillDate ?? '');
    setCreateTimeStart('');
    setCreateTimeEnd('');
    setCreateLocation('');
    setCreateDescription('');
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || !createDate) return;
    setCreating(true);

    const startAt = new Date(createDate + (createTimeStart ? `T${createTimeStart}` : 'T00:00:00')).toISOString();
    const payload: Record<string, unknown> = {
      kind: createKind,
      title,
      startAt,
      allDay: !createTimeStart,
    };
    if (createTimeEnd) {
      payload.endAt = new Date(createDate + `T${createTimeEnd}`).toISOString();
    }
    if (createLocation) payload.location = createLocation;
    if (createDescription) payload.description = createDescription;

    await fetchJson('/api/personal/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setCreating(false);
    setCreateOpen(false);
    setFetchVersion(v => v + 1);
  }, [createKind, createTitle, createDate, createTimeStart, createTimeEnd, createLocation, createDescription]);

  const filters = (
    <div className="flex items-center gap-1.5 flex-wrap">
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
        subtitle="Abonnements, revenus, objectifs et rendez-vous"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setSyncOpen(true)}>
              <RefreshCw size={14} className="mr-1" />
              Sync
            </Button>
            <Button onClick={() => openCreate(selectedDay ?? undefined)}>
              <Plus size={16} className="mr-1" />
              Ajouter
            </Button>
          </div>
        }
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
            onCreateEvent={() => openCreate(selectedDay)}
          />
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onCloseAction={() => { if (!creating) setCreateOpen(false); }}
        title={createKind ? (createKind === 'APPOINTMENT' ? 'Nouveau rendez-vous' : 'Nouveau rappel') : 'Ajouter au calendrier'}
        description={createKind ? undefined : 'Choisissez le type d\u2019événement à créer.'}
      >
        {!createKind ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCreateKind('APPOINTMENT')}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] p-4 hover:border-[var(--shell-accent)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <CalendarPlus size={24} style={{ color: 'var(--shell-accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>RDV</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateKind('REMINDER')}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] p-4 hover:border-[var(--shell-accent)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Bell size={24} style={{ color: 'var(--shell-accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Rappel</span>
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-3">
            <Input
              label="Titre"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder={createKind === 'APPOINTMENT' ? 'Ex : RDV médecin…' : 'Ex : Rappeler banque…'}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Date"
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
              <Input
                label="Heure début"
                type="time"
                value={createTimeStart}
                onChange={(e) => setCreateTimeStart(e.target.value)}
              />
            </div>

            {createKind === 'APPOINTMENT' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Heure fin"
                  type="time"
                  value={createTimeEnd}
                  onChange={(e) => setCreateTimeEnd(e.target.value)}
                />
                <Input
                  label="Lieu"
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="Adresse ou lien visio"
                />
              </div>
            ) : null}

            <Input
              label="Description"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Notes supplémentaires…"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setCreateKind(null)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                ← Changer le type
              </button>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Annuler
                </Button>
                <Button type="submit" disabled={creating || !createTitle.trim() || !createDate}>
                  {creating ? 'Création…' : 'Créer'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Sync modal */}
      <Modal
        open={syncOpen}
        onCloseAction={() => setSyncOpen(false)}
        title="Synchronisation calendrier"
        description="Synchronisez vos événements avec votre app calendrier."
      >
        <CalendarSyncPanel apiBase="/api/personal/calendar/sync" />
      </Modal>
    </PageContainer>
  );
}
