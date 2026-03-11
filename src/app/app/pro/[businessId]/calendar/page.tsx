'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Plus, CalendarPlus, Bell, ListChecks, RefreshCw, Trash2 } from 'lucide-react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { CalendarGrid } from '@/components/ui/calendar/CalendarGrid';
import { DayDetailPanel } from '@/components/ui/calendar/DayDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { CalendarSyncPanel } from '@/components/ui/calendar/CalendarSyncPanel';
import { useToast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/apiClient';
import { dayKey, startOfMonth, addMonths, addDays } from '@/lib/date';
import { EVENT_TYPE_LABELS, type CalendarEvent, type CalendarEventType } from '@/lib/calendar';
import { revalidate, useRevalidationKey } from '@/lib/revalidate';

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

// ─── Shared event form ──────────────────────────────────────────────────────

type EventFormProps = {
  kind: 'APPOINTMENT' | 'REMINDER';
  title: string; onTitleChange: (v: string) => void;
  date: string; onDateChange: (v: string) => void;
  timeStart: string; onTimeStartChange: (v: string) => void;
  timeEnd: string; onTimeEndChange: (v: string) => void;
  location: string; onLocationChange: (v: string) => void;
  description: string; onDescriptionChange: (v: string) => void;
  projectId: string; onProjectIdChange: (v: string) => void;
  clientId: string; onClientIdChange: (v: string) => void;
  projects: ProjectOption[];
  clients: ClientOption[];
};

function EventForm({ kind, title, onTitleChange, date, onDateChange, timeStart, onTimeStartChange, timeEnd, onTimeEndChange, location, onLocationChange, description, onDescriptionChange, projectId, onProjectIdChange, clientId, onClientIdChange, projects, clients }: EventFormProps) {
  return (
    <>
      <Input
        label="Titre"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={200}
        autoFocus
        placeholder={kind === 'APPOINTMENT' ? 'Ex : RDV client…' : 'Ex : Rappeler fournisseur…'}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Date" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
        <Input label="Heure début" type="time" value={timeStart} onChange={(e) => onTimeStartChange(e.target.value)} />
      </div>

      {kind === 'APPOINTMENT' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Heure fin" type="time" value={timeEnd} onChange={(e) => onTimeEndChange(e.target.value)} />
            <Input label="Lieu" value={location} onChange={(e) => onLocationChange(e.target.value)} placeholder="Adresse ou lien visio" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Client" value={clientId} onChange={(e) => onClientIdChange(e.target.value)}>
              <option value="">Aucun client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Projet" value={projectId} onChange={(e) => onProjectIdChange(e.target.value)}>
              <option value="">Aucun projet</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </>
      )}

      <Input
        label="Description"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="Notes supplémentaires…"
      />
    </>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function ProCalendarPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const toast = useToast();
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

  // Edit modal
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editKind, setEditKind] = useState<'APPOINTMENT' | 'REMINDER'>('APPOINTMENT');
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTimeStart, setEditTimeStart] = useState('');
  const [editTimeEnd, setEditTimeEnd] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Dropdown data
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  const [fetchVersion, setFetchVersion] = useState(0);
  const calendarRv = useRevalidationKey(['pro:calendar', 'pro:tasks']);

  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    const from = addDays(startOfMonth(currentMonth), -7);
    const to = addDays(startOfMonth(addMonths(currentMonth, 1)), 7);
    fetchJson<{ items: CalendarEvent[] }>(
      `/api/pro/businesses/${businessId}/calendar/events?from=${dayKey(from)}&to=${dayKey(to)}`,
      {},
      controller.signal,
    ).then(res => {
      if (controller.signal.aborted) return;
      if (res.ok && res.data) setEvents(res.data.items);
      setLoading(false);
    });
    return () => controller.abort();
  }, [businessId, currentMonth, fetchVersion, calendarRv]);

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

  // ─── Create ─────────────────────────────────────────────────────────────────

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
    setFetchVersion(v => v + 1);
    revalidate('pro:calendar');
    if (createKind === 'TASK') revalidate('pro:tasks');
    toast.success('Événement créé');
  }, [businessId, createKind, createTitle, createDate, createTimeStart, createTimeEnd, createLocation, createDescription, createProjectId, createClientId, toast]);

  // ─── Edit ───────────────────────────────────────────────────────────────────

  const openEdit = useCallback((event: CalendarEvent) => {
    const m = event.meta ?? {};
    setEditEvent(event);
    setEditKind((m.kind as 'APPOINTMENT' | 'REMINDER') || 'APPOINTMENT');
    setEditTitle(event.title);
    setEditDate(event.date);
    setEditTimeStart(m.startTime ? String(m.startTime) : '');
    setEditTimeEnd(m.endTime ? String(m.endTime) : '');
    setEditLocation(m.location ? String(m.location) : '');
    setEditDescription(m.description ? String(m.description) : '');
    setEditProjectId(m.projectId ? String(m.projectId) : '');
    setEditClientId(m.clientId ? String(m.clientId) : '');
    setConfirmDelete(false);
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editEvent) return;
    const eventId = editEvent.meta?.eventId;
    if (!eventId) return;

    const title = editTitle.trim();
    if (!title || !editDate) return;
    setSaving(true);

    const startAt = new Date(editDate + (editTimeStart ? `T${editTimeStart}` : 'T00:00:00')).toISOString();
    const payload: Record<string, unknown> = {
      kind: editKind,
      title,
      startAt,
      allDay: !editTimeStart,
    };
    if (editTimeEnd) {
      payload.endAt = new Date(editDate + `T${editTimeEnd}`).toISOString();
    } else {
      payload.endAt = null;
    }
    payload.location = editLocation || null;
    payload.description = editDescription || null;
    payload.projectId = editProjectId || null;
    payload.clientId = editClientId || null;

    const res = await fetchJson(`/api/pro/businesses/${businessId}/calendar/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.ok) {
      setEditEvent(null);
      setFetchVersion(v => v + 1);
      revalidate('pro:calendar');
      toast.success('Événement modifié');
    } else {
      toast.error('Erreur lors de la modification');
    }
  }, [businessId, editEvent, editKind, editTitle, editDate, editTimeStart, editTimeEnd, editLocation, editDescription, editProjectId, editClientId, toast]);

  const handleDelete = useCallback(async () => {
    if (!editEvent) return;
    const eventId = editEvent.meta?.eventId;
    if (!eventId) return;

    setDeleting(true);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/calendar/events/${eventId}`, {
      method: 'DELETE',
    });
    setDeleting(false);

    if (res.ok) {
      setEditEvent(null);
      setFetchVersion(v => v + 1);
      revalidate('pro:calendar');
      toast.success('Événement supprimé');
    } else {
      toast.error('Erreur lors de la suppression');
    }
  }, [businessId, editEvent, toast]);

  // ─── Filters ────────────────────────────────────────────────────────────────

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
            onEditEvent={openEdit}
          />
        )}
      </div>

      {/* ── Create modal ─────────────────────────────────────────────────────── */}
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
        ) : createKind === 'TASK' ? (
          <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-3">
            <Input
              label="Titre"
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="Ex : Préparer la présentation…"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Date" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
              <Input label="Heure début" type="time" value={createTimeStart} onChange={(e) => setCreateTimeStart(e.target.value)} />
            </div>
            <Select label="Projet" value={createProjectId} onChange={(e) => setCreateProjectId(e.target.value)}>
              <option value="">Aucun projet</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setCreateKind(null)} className="text-xs font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>
                ← Changer le type
              </button>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
                <Button type="submit" disabled={creating || !createTitle.trim() || !createDate}>{creating ? 'Création…' : 'Créer'}</Button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-3">
            <EventForm
              kind={createKind}
              title={createTitle} onTitleChange={setCreateTitle}
              date={createDate} onDateChange={setCreateDate}
              timeStart={createTimeStart} onTimeStartChange={setCreateTimeStart}
              timeEnd={createTimeEnd} onTimeEndChange={setCreateTimeEnd}
              location={createLocation} onLocationChange={setCreateLocation}
              description={createDescription} onDescriptionChange={setCreateDescription}
              projectId={createProjectId} onProjectIdChange={setCreateProjectId}
              clientId={createClientId} onClientIdChange={setCreateClientId}
              projects={projects}
              clients={clients}
            />
            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setCreateKind(null)} className="text-xs font-medium hover:underline" style={{ color: 'var(--text-secondary)' }}>
                ← Changer le type
              </button>
              <div className="flex gap-2">
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>Annuler</Button>
                <Button type="submit" disabled={creating || !createTitle.trim() || !createDate}>{creating ? 'Création…' : 'Créer'}</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Edit modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={!!editEvent}
        onCloseAction={() => { if (!saving && !deleting) setEditEvent(null); }}
        title={editKind === 'APPOINTMENT' ? 'Modifier le rendez-vous' : 'Modifier le rappel'}
      >
        {editEvent && (
          <form onSubmit={(e) => { e.preventDefault(); void handleUpdate(); }} className="space-y-3">
            {/* Kind toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setEditKind('APPOINTMENT')}
                className="flex-1 text-sm font-medium py-2 transition-colors"
                style={{
                  background: editKind === 'APPOINTMENT' ? 'var(--shell-accent)' : 'var(--surface)',
                  color: editKind === 'APPOINTMENT' ? 'white' : 'var(--text-secondary)',
                }}
              >
                RDV
              </button>
              <button
                type="button"
                onClick={() => setEditKind('REMINDER')}
                className="flex-1 text-sm font-medium py-2 transition-colors"
                style={{
                  background: editKind === 'REMINDER' ? 'var(--shell-accent)' : 'var(--surface)',
                  color: editKind === 'REMINDER' ? 'white' : 'var(--text-secondary)',
                }}
              >
                Rappel
              </button>
            </div>

            <EventForm
              kind={editKind}
              title={editTitle} onTitleChange={setEditTitle}
              date={editDate} onDateChange={setEditDate}
              timeStart={editTimeStart} onTimeStartChange={setEditTimeStart}
              timeEnd={editTimeEnd} onTimeEndChange={setEditTimeEnd}
              location={editLocation} onLocationChange={setEditLocation}
              description={editDescription} onDescriptionChange={setEditDescription}
              projectId={editProjectId} onProjectIdChange={setEditProjectId}
              clientId={editClientId} onClientIdChange={setEditClientId}
              projects={projects}
              clients={clients}
            />

            {/* Delete section */}
            <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs font-medium hover:underline"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash2 size={13} />
                  Supprimer cet événement
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--danger)' }}>Confirmer la suppression ?</span>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Non
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--danger)', color: 'white' }}
                  >
                    {deleting ? 'Suppression…' : 'Oui, supprimer'}
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" type="button" onClick={() => setEditEvent(null)} disabled={saving || deleting}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || deleting || !editTitle.trim() || !editDate}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Sync modal ───────────────────────────────────────────────────────── */}
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
