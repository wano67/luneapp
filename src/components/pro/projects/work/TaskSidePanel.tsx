"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { cn } from '@/lib/cn';
import { InitialsAvatar, getStatusBadgeClasses, formatTaskStatus } from '@/components/pro/projects/workspace-ui';
import { TASK_STATUS_OPTIONS } from '@/lib/taskStatusUi';
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

type TaskSidePanelProps = {
  task: TaskItem | null;
  open: boolean;
  onClose: () => void;
  members: MemberItem[];
  isAdmin: boolean;
  currentUserId?: string | null;
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
  onUpdate,
  onDelete,
  services,
  organizationUnits,
}: TaskSidePanelProps) {
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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

              {/* Temps estimé */}
              <Input
                label="Temps estimé (min)"
                type="number"
                min={0}
                max={99999}
                value={task.estimatedMinutes ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  patchField('estimatedMinutes', v === '' ? null : Number(v));
                }}
                disabled={!canEdit}
                placeholder="Ex: 120"
              />

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
