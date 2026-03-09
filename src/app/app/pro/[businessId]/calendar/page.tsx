'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Plus, CalendarPlus, Bell, ListChecks, RefreshCw } from 'lucide-react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import { DayDetailPanel } from '@/components/ui/calendar/DayDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { CalendarSyncPanel } from '@/components/ui/calendar/CalendarSyncPanel';
import { fetchJson } from '@/lib/apiClient';
import { dayKey, startOfMonth, addMonths, addDays } from '@/lib/date';
import { EVENT_TYPE_LABELS, type CalendarEvent, type CalendarEventType } from '@/lib/calendar';

type CreateKind = 'APPOINTMENT' | 'REMINDER' | 'TASK' | null;
type ProjectOption = { id: string; name: string };
type ClientOption = { id: string; name: string };

const FILTER_OPTIONS: { value: CalendarEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'task', label: EVENT_TYPE_LABELS.task },
  { value: 'interaction', label: EVENT_TYPE_LABELS.interaction },
  { value: 'event', label: EVENT_TYPE_LABELS.event },
  { value: 'finance', label: EVENT_TYPE_LABELS.finance },
];

export default function ProCalendarPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
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
  const [createProjectId, setCreateProjectId] = useState('');
  const [createClientId, setCreateClientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  // Dropdown data
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const loadEvents = useCallback(async (month: Date, signal?: AbortSignal) => {
    if (!businessId) return;
    setLoading(true);
    const from = addDays(startOfMonth(month), -7);
    const to = addDays(startOfMonth(addMonths(month, 1)), 7);
    const res = await fetchJson<{ items: CalendarEvent[] }>(
      `/api/pro/businesses/${businessId}/calendar/events?from=${dayKey(from)}&to=${dayKey(to)}`,
      {},
      signal,
    );
    if (signal?.aborted) return;
    if (res.ok && res.data) setEvents(res.data.items);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadEvents(new Date(), controller.signal);
    return () => controller.abort();
  }, [loadEvents]);

  // Load projects + clients for modal
  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    fetchJson<{ items: ProjectOption[] }>(
      `/api/pro/businesses/${businessId}/projects?scope=ACTIVE`,
      {},
      controller.signal,
    ).then((res) => { if (res.ok && res.data) setProjects(res.data.items); });
    fetchJson<{ items: ClientOption[] }>(
      `/api/pro/businesses/${businessId}/clients?status=ACTIVE`,
      {},
      controller.signal,
    ).then((res) => { if (res.ok && res.data) setClients(res.data.items); });
    return () => controller.abort();
  }, [businessId]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    const m = new Date(year, month, 1);
    setCurrentMonth(m);
    const controller = new AbortController();
    void loadEvents(m, controller.signal);
  }, [loadEvents]);

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
    setCreateProjectId('');
    setCreateClientId('');
    setCreateOpen(true);
  }, []);

  const handleCreate = useCallback(async () => {
    const title = createTitle.trim();
    if (!title || !createDate) return;
    setCreating(true);

    if (createKind === 'TASK') {
      // Create as task
      const payload: Record<string, unknown> = {
        title,
        assignToSelf: true,
        dueDate: new Date(createDate + (createTimeStart ? `T${createTimeStart}` : 'T00:00:00')).toISOString(),
      };
      if (createProjectId) payload.projectId = createProjectId;
      await fetchJson(`/api/pro/businesses/${businessId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      // Create as CalendarEvent (APPOINTMENT or REMINDER)
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
      if (createProjectId) payload.projectId = createProjectId;
      if (createClientId) payload.clientId = createClientId;
      await fetchJson(`/api/pro/businesses/${businessId}/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setCreating(false);
    setCreateOpen(false);
    await loadEvents(currentMonth);
  }, [businessId, createKind, createTitle, createDate, createTimeStart, createTimeEnd, createLocation, createDescription, createProjectId, createClientId, currentMonth, loadEvents]);

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
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Calendrier"
      subtitle="Tâches, rendez-vous et charges récurrentes"
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
    >
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
            businessId={businessId}
            onCreateEvent={() => openCreate(selectedDay)}
          />
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        onCloseAction={() => { if (!creating) setCreateOpen(false); }}
        title={createKind ? (createKind === 'APPOINTMENT' ? 'Nouveau rendez-vous' : createKind === 'REMINDER' ? 'Nouveau rappel' : 'Nouvelle tâche') : 'Ajouter au calendrier'}
        description={createKind ? undefined : 'Choisissez le type d\u2019événement à créer.'}
      >
        {!createKind ? (
          <div className="grid grid-cols-3 gap-3">
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
            <button
              type="button"
              onClick={() => setCreateKind('TASK')}
              className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] p-4 hover:border-[var(--shell-accent)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <ListChecks size={24} style={{ color: 'var(--shell-accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Tâche</span>
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
              placeholder={createKind === 'APPOINTMENT' ? 'Ex : RDV client…' : createKind === 'REMINDER' ? 'Ex : Rappeler fournisseur…' : 'Ex : Préparer la présentation…'}
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
              <>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="Client"
                    value={createClientId}
                    onChange={(e) => setCreateClientId(e.target.value)}
                  >
                    <option value="">Aucun client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                  <Select
                    label="Projet"
                    value={createProjectId}
                    onChange={(e) => setCreateProjectId(e.target.value)}
                  >
                    <option value="">Aucun projet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            ) : createKind === 'TASK' ? (
              <Select
                label="Projet"
                value={createProjectId}
                onChange={(e) => setCreateProjectId(e.target.value)}
              >
                <option value="">Aucun projet</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            ) : null}

            {createKind !== 'TASK' ? (
              <Input
                label="Description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Notes supplémentaires…"
              />
            ) : null}

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
        <CalendarSyncPanel apiBase={`/api/pro/businesses/${businessId}/calendar/sync`} />
      </Modal>
    </ProPageShell>
  );
}
