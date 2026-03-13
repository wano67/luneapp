"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, ChevronUp, Play, Square, Clock, DollarSign, Paperclip, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { cn } from '@/lib/cn';
import { InitialsAvatar, getStatusBadgeClasses, formatTaskStatus } from '@/components/pro/projects/workspace-ui';
import { TASK_STATUS_OPTIONS } from '@/lib/taskStatusUi';
import { fetchJson } from '@/lib/apiClient';
import type { TaskItem, MemberItem, OrganizationUnitItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

const PHASE_OPTIONS = [
  { value: '', label: 'Sans phase' },
  { value: 'CADRAGE', label: 'Cadrage' },
  { value: 'UX', label: 'UX' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'DEV', label: 'Développement' },
  { value: 'SEO', label: 'SEO' },
  { value: 'LAUNCH', label: 'Lancement' },
  { value: 'FOLLOW_UP', label: 'Suivi' },
];

type ServiceOption = { id: string; name: string };

type TimeEntryItem = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  startedAt: string;
  stoppedAt: string | null;
  durationMin: number | null;
  description: string | null;
  billable: boolean;
};

type TaskDocItem = { id: string; title: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string };

type TaskSidePanelProps = {
  task: TaskItem | null;
  open: boolean;
  onClose: () => void;
  members: MemberItem[];
  isAdmin: boolean;
  currentUserId?: string | null;
  businessId: string;
  projectId?: string | null;
  onUpdate: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  services?: ServiceOption[];
  organizationUnits?: OrganizationUnitItem[];
};

export function TaskSidePanel({
  task,
  open,
  onClose,
  members,
  isAdmin,
  currentUserId,
  businessId,
  projectId,
  onUpdate,
  onDelete,
  services,
  organizationUnits,
}: TaskSidePanelProps) {
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Documents state
  const [taskDocs, setTaskDocs] = useState<TaskDocItem[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Time tracking state
  const [timeEntries, setTimeEntries] = useState<TimeEntryItem[]>([]);
  const [runningEntry, setRunningEntry] = useState<TimeEntryItem | null>(null);
  const [showTimeEntries, setShowTimeEntries] = useState(false);

  const isAssignedToMe = Boolean(
    task && currentUserId && (
      task.assigneeUserId === currentUserId ||
      task.assignees?.some((a) => a.userId === currentUserId)
    )
  );
  const canEdit = isAdmin || isAssignedToMe;
  const canDelete = isAdmin;

  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Load time entries when task changes
  useEffect(() => {
    if (!task || !open) {
      setTimeEntries([]);
      setRunningEntry(null);
      return;
    }
    const url = `/api/pro/businesses/${businessId}/tasks/${task.id}/time-entries`;
    void fetchJson<{ items: TimeEntryItem[] }>(url).then((res) => {
      if (res.ok && res.data) {
        setTimeEntries(res.data.items);
        const running = res.data.items.find((e) => !e.stoppedAt);
        setRunningEntry(running ?? null);
      }
    });
  }, [task?.id, open, businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = useCallback(async () => {
    if (!task) return;
    const url = `/api/pro/businesses/${businessId}/tasks/${task.id}/time-entries`;
    const res = await fetchJson<{ item: TimeEntryItem }>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok && res.data) {
      setRunningEntry(res.data.item);
      setTimeEntries((prev) => [res.data!.item, ...prev]);
    }
  }, [task, businessId]);

  const stopTimer = useCallback(async () => {
    if (!task || !runningEntry) return;
    const url = `/api/pro/businesses/${businessId}/tasks/${task.id}/time-entries/${runningEntry.id}`;
    const res = await fetchJson<{ item: TimeEntryItem }>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' }),
    });
    if (res.ok && res.data) {
      setRunningEntry(null);
      setTimeEntries((prev) =>
        prev.map((e) => (e.id === res.data!.item.id ? res.data!.item : e))
      );
    }
  }, [task, businessId, runningEntry]);

  const toggleBillable = useCallback(async (entryId: string, billable: boolean) => {
    if (!task) return;
    const url = `/api/pro/businesses/${businessId}/tasks/${task.id}/time-entries/${entryId}`;
    const res = await fetchJson<{ item: TimeEntryItem }>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billable }),
    });
    if (res.ok && res.data) {
      setTimeEntries((prev) =>
        prev.map((e) => (e.id === res.data!.item.id ? res.data!.item : e))
      );
    }
  }, [task, businessId]);

  const deleteTimeEntry = useCallback(async (entryId: string) => {
    if (!task) return;
    const url = `/api/pro/businesses/${businessId}/tasks/${task.id}/time-entries/${entryId}`;
    const res = await fetchJson(url, { method: 'DELETE' });
    if (res.ok) {
      if (runningEntry?.id === entryId) setRunningEntry(null);
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    }
  }, [task, businessId, runningEntry]);

  const totalTrackedMin = timeEntries.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);

  // ─── Task documents ────────────────────────────────────────────────────────
  const loadTaskDocs = useCallback(async () => {
    if (!task || !projectId) return;
    const url = `/api/pro/businesses/${businessId}/projects/${projectId}/documents?taskId=${task.id}`;
    const res = await fetchJson<{ items: TaskDocItem[] }>(url);
    if (res.ok && res.data) setTaskDocs(res.data.items);
  }, [task?.id, businessId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (task && open && projectId) void loadTaskDocs();
    else setTaskDocs([]);
  }, [task?.id, open, projectId, loadTaskDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task || !projectId) return;
    setDocUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('taskId', task.id);
      const res = await fetch(`/api/pro/businesses/${businessId}/projects/${projectId}/documents`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) await loadTaskDocs();
    } finally {
      setDocUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [task, businessId, projectId, loadTaskDocs]);

  const handleDocDelete = useCallback(async (docId: string) => {
    if (!projectId) return;
    const res = await fetchJson(`/api/pro/businesses/${businessId}/projects/${projectId}/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) setTaskDocs((prev) => prev.filter((d) => d.id !== docId));
  }, [businessId, projectId]);

  const patchField = useCallback(
    (field: string, value: unknown) => {
      if (!task || !canEdit) return;
      void onUpdate(task.id, { [field]: value });
    },
    [task, canEdit, onUpdate]
  );

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim();
    if (!task || !trimmed || trimmed === task.title) return;
    patchField('title', trimmed);
  }, [title, task, patchField]);

  const handleDelete = useCallback(async () => {
    if (!task || !canDelete) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }, [task, canDelete, onDelete, onClose]);

  const handleAssigneeToggle = useCallback(
    (userId: string) => {
      if (!task || !isAdmin) return;
      const current = task.assignees ?? [];
      const isSelected = current.some((a) => a.userId === userId);
      const newIds = isSelected
        ? current.filter((a) => a.userId !== userId).map((a) => a.userId)
        : [...current.map((a) => a.userId), userId];
      void onUpdate(task.id, {
        assigneeUserIds: newIds,
        assigneeUserId: newIds[0] ?? null,
      });
    },
    [task, isAdmin, onUpdate]
  );

  const assigneeIds = useMemo(
    () => new Set(task?.assignees?.map((a) => a.userId) ?? []),
    [task?.assignees]
  );

  const availableMemberItems = useMemo(
    () => members.filter((m) => !assigneeIds.has(m.userId)).map((m) => ({ code: m.userId, label: m.name ?? m.email })),
    [members, assigneeIds]
  );

  if (!open || !task) return null;

  const panel = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl sm:w-[420px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                getStatusBadgeClasses(task.status)
              )}
            >
              {formatTaskStatus(task.status)}
            </span>
            {task.isBlocked ? (
              <span className="inline-flex items-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--danger)]">
                Bloqué
              </span>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            disabled={!isAdmin}
            className="w-full bg-transparent text-lg font-semibold text-[var(--text-primary)] outline-none"
          />

          {/* ═══ Essential: Status + Dates ═══ */}
          <div className="grid grid-cols-3 gap-2">
            <Select
              label="Statut"
              value={task.status}
              onChange={(e) => patchField('status', e.target.value)}
              disabled={!canEdit}
            >
              {TASK_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <Input
              label="Début"
              type="date"
              value={task.startDate ? task.startDate.slice(0, 10) : ''}
              onChange={(e) => patchField('startDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              disabled={!canEdit}
            />
            <Input
              label="Échéance"
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) => patchField('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              disabled={!canEdit}
            />
          </div>

          {/* ═══ Assignees (multi-select) ═══ */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Assignés</label>
            {/* Current assignees as chips */}
            {task.assignees && task.assignees.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {task.assignees.map((a) => (
                  <span
                    key={a.userId}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
                  >
                    <InitialsAvatar name={a.name} email={a.email} size={16} />
                    {a.name ?? a.email}
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleAssigneeToggle(a.userId)}
                        className="ml-0.5 text-[var(--text-faint)] hover:text-[var(--danger)]"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-faint)]">Aucun assigné</p>
            )}
            {/* Add assignee dropdown */}
            {isAdmin ? (
              <SearchSelect
                label="Ajouter un membre"
                placeholder="Rechercher…"
                items={availableMemberItems}
                value=""
                onChange={(code) => { if (code) handleAssigneeToggle(code); }}
              />
            ) : null}
          </div>

          {/* ═══ Pôle ═══ */}
          {organizationUnits && organizationUnits.length > 0 ? (
            <Select
              label="Pôle"
              value={task.organizationUnitId ?? ''}
              onChange={(e) => patchField('organizationUnitId', e.target.value || null)}
              disabled={!isAdmin}
            >
              <option value="">Aucun pôle</option>
              {organizationUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          ) : null}

          {/* ═══ Progress ═══ */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Progression : {task.progress ?? 0}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.progress ?? 0}
              onChange={(e) => patchField('progress', Number(e.target.value))}
              disabled={!canEdit}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* ═══ Durée estimée ═══ */}
          <DurationPicker
            minutes={task.estimatedMinutes ?? null}
            onChange={(m) => patchField('estimatedMinutes', m)}
            disabled={!canEdit}
          />

          {/* ═══ Time Tracking ═══ */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Suivi du temps</label>
            <LiveTimer
              runningEntry={runningEntry}
              totalTrackedMin={totalTrackedMin}
              canEdit={canEdit}
              onStart={() => void startTimer()}
              onStop={() => void stopTimer()}
            />
            {/* Total + toggle entries */}
            {timeEntries.length > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">
                  {totalTrackedMin > 0 ? `Total : ${formatDurationMin(totalTrackedMin)}` : ''}
                  {task?.estimatedMinutes ? ` / ${formatDurationMin(task.estimatedMinutes)} estimé` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTimeEntries(!showTimeEntries)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {showTimeEntries ? 'Masquer' : `${timeEntries.length} entrée${timeEntries.length > 1 ? 's' : ''}`}
                </button>
              </div>
            ) : null}
            {/* Entries list */}
            {showTimeEntries ? (
              <TimeEntriesList
                entries={timeEntries}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onToggleBillable={toggleBillable}
                onDelete={deleteTimeEntry}
              />
            ) : null}
          </div>

          {/* ═══ Documents ═══ */}
          {projectId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Documents</label>
                {canEdit ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => void handleDocUpload(e)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={docUploading}
                      className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
                    >
                      <Paperclip size={12} />
                      {docUploading ? 'Upload...' : 'Ajouter'}
                    </button>
                  </>
                ) : null}
              </div>
              {taskDocs.length > 0 ? (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {taskDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                    >
                      <FileText size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{doc.title}</span>
                      <span className="shrink-0 text-[var(--text-faint)]">
                        {doc.sizeBytes < 1024 ? `${doc.sizeBytes} o` : `${Math.round(doc.sizeBytes / 1024)} Ko`}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void handleDocDelete(doc.id)}
                          className="text-[var(--text-faint)] hover:text-[var(--danger)]"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-faint)]">Aucun document attaché.</p>
              )}
            </div>
          ) : null}

          {/* ═══ Details (collapsible) ═══ */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex w-full items-center justify-between rounded-xl bg-[var(--surface-2)]/60 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)]"
          >
            Détails
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDetails ? (
            <div className="space-y-3 rounded-xl border border-[var(--border)]/50 p-3">
              {/* Phase */}
              <Select
                label="Phase"
                value={task.phase ?? ''}
                onChange={(e) => patchField('phase', e.target.value || null)}
                disabled={!isAdmin}
              >
                {PHASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>

              {/* Service */}
              {services && services.length > 0 ? (
                <Select
                  label="Service lié"
                  value={task.projectServiceId ?? ''}
                  onChange={(e) => patchField('projectServiceId', e.target.value || null)}
                  disabled={!isAdmin}
                >
                  <option value="">Aucun</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              ) : null}

              {/* Tâche bloquée */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={task.isBlocked ?? false}
                    onChange={(e) => {
                      patchField('isBlocked', e.target.checked);
                      if (!e.target.checked) patchField('blockedReason', null);
                    }}
                    disabled={!canEdit}
                    className="accent-[var(--danger)]"
                  />
                  Tâche bloquée
                </label>
                {task.isBlocked ? (
                  <textarea
                    value={task.blockedReason ?? ''}
                    onChange={(e) => patchField('blockedReason', e.target.value || null)}
                    disabled={!canEdit}
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/30"
                    placeholder="Raison du blocage…"
                  />
                ) : null}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Notes</label>
                <textarea
                  value={task.notes ?? ''}
                  onChange={(e) => patchField('notes', e.target.value || null)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
                  placeholder="Notes…"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {canDelete ? (
          <div className="border-t border-[var(--border)] px-4 py-3">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 size={14} />
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        ) : null}
      </aside>
    </>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatDurationMin(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/* ═══ Duration Picker (hours:minutes) ═══ */

function DurationPicker({ minutes, onChange, disabled }: {
  minutes: number | null;
  onChange: (m: number | null) => void;
  disabled: boolean;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Track a local "editing" override; null means use the prop value
  const [draft, setDraft] = useState<{ h: string; m: string } | null>(null);

  const displayH = draft ? draft.h : (minutes != null ? String(Math.floor(minutes / 60)) : '');
  const displayM = draft ? draft.m : (minutes != null ? String(minutes % 60) : '');

  const commit = useCallback((hStr: string, mStr: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const hNum = parseInt(hStr) || 0;
      const mNum = parseInt(mStr) || 0;
      if (hStr === '' && mStr === '') {
        onChange(null);
      } else {
        onChange(hNum * 60 + mNum);
      }
      setDraft(null); // sync back to prop
    }, 600);
  }, [onChange]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--text-secondary)]">Durée estimée</label>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={999}
            value={displayH}
            onChange={(e) => {
              const v = e.target.value;
              const next = { h: v, m: draft?.m ?? displayM };
              setDraft(next);
              commit(next.h, next.m);
            }}
            disabled={disabled}
            placeholder="0"
            className="w-14 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
          />
          <span className="text-xs text-[var(--text-secondary)]">h</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={59}
            value={displayM}
            onChange={(e) => {
              const v = e.target.value;
              const next = { h: draft?.h ?? displayH, m: v };
              setDraft(next);
              commit(next.h, next.m);
            }}
            disabled={disabled}
            placeholder="00"
            className="w-14 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50"
          />
          <span className="text-xs text-[var(--text-secondary)]">min</span>
        </div>
      </div>
      {minutes != null && minutes > 0 ? (
        <p className="text-[11px] text-[var(--text-faint)]">
          = {formatDurationMin(minutes)} ({minutes} min)
        </p>
      ) : null}
    </div>
  );
}

/* ═══ Live Timer (isolated to avoid full panel re-renders) ═══ */

type LiveTimerEntry = { startedAt: string } | null;

function computeElapsed(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function useElapsed(startedAt: string | null): number {
  const [elapsed, setElapsedVal] = useState(() => computeElapsed(startedAt));
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!startedAt) return;
    intervalRef.current = setInterval(() => {
      setElapsedVal(computeElapsed(startedAt));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startedAt]);

  return startedAt ? elapsed : 0;
}

const LiveTimer = memo(function LiveTimer({ runningEntry, totalTrackedMin, canEdit, onStart, onStop }: {
  runningEntry: LiveTimerEntry;
  totalTrackedMin: number;
  canEdit: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const elapsed = useElapsed(runningEntry?.startedAt ?? null);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2">
      <Clock size={16} className="shrink-0 text-[var(--text-secondary)]" />
      {runningEntry ? (
        <>
          <span className="flex-1 font-mono text-sm font-semibold text-[var(--accent)]">
            {formatElapsed(elapsed)}
          </span>
          <Button size="sm" variant="danger" onClick={onStop} className="gap-1.5">
            <Square size={12} />
            Stop
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-[var(--text-secondary)]">
            {totalTrackedMin > 0 ? formatDurationMin(totalTrackedMin) : 'Aucun temps suivi'}
          </span>
          {canEdit ? (
            <Button size="sm" onClick={onStart} className="gap-1.5">
              <Play size={12} />
              Démarrer
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
});

/* ═══ Time Entries List (isolated) ═══ */

type TimeEntryDisplay = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  stoppedAt: string | null;
  durationMin: number | null;
  billable: boolean;
};

const TimeEntriesList = memo(function TimeEntriesList({ entries, isAdmin, currentUserId, onToggleBillable, onDelete }: {
  entries: TimeEntryDisplay[];
  isAdmin: boolean;
  currentUserId?: string | null;
  onToggleBillable: (id: string, billable: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)]/50 bg-[var(--surface)] px-2.5 py-1.5 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
            {entry.userName ?? entry.userEmail}
          </span>
          <span className="font-mono text-[var(--text-secondary)]">
            {entry.stoppedAt
              ? formatDurationMin(entry.durationMin ?? 0)
              : '...'}
          </span>
          <button
            type="button"
            onClick={() => void onToggleBillable(entry.id, !entry.billable)}
            title={entry.billable ? 'Facturable' : 'Non facturable'}
            className={cn(
              'rounded p-0.5 transition',
              entry.billable
                ? 'text-[var(--success)] hover:text-[var(--success)]'
                : 'text-[var(--text-faint)] hover:text-[var(--text-secondary)]',
            )}
          >
            <DollarSign size={12} />
          </button>
          {(isAdmin || entry.userId === currentUserId) ? (
            <button
              type="button"
              onClick={() => void onDelete(entry.id)}
              className="text-[var(--text-faint)] hover:text-[var(--danger)]"
            >
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
});
