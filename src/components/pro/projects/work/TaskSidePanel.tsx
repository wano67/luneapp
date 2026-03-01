"use client";

import { useCallback, useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { InitialsAvatar, getStatusBadgeClasses, formatTaskStatus } from '@/components/pro/projects/workspace-ui';
import type { TaskItem, MemberItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

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

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminée' },
];

type ServiceOption = { id: string; name: string };

type TaskSidePanelProps = {
  task: TaskItem | null;
  open: boolean;
  onClose: () => void;
  members: MemberItem[];
  isAdmin: boolean;
  onUpdate: (taskId: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  services?: ServiceOption[];
};

export function TaskSidePanel({
  task,
  open,
  onClose,
  members,
  isAdmin,
  onUpdate,
  onDelete,
  services,
}: TaskSidePanelProps) {
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState(false);

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
      if (!task || !isAdmin) return;
      void onUpdate(task.id, { [field]: value });
    },
    [task, isAdmin, onUpdate]
  );

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim();
    if (!task || !trimmed || trimmed === task.title) return;
    patchField('title', trimmed);
  }, [title, task, patchField]);

  const handleDelete = useCallback(async () => {
    if (!task || !isAdmin) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }, [task, isAdmin, onDelete, onClose]);

  if (!open || !task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl sm:w-96">
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

          {/* Status + Phase */}
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Statut"
              value={task.status}
              onChange={(e) => patchField('status', e.target.value)}
              disabled={!isAdmin}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
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
          </div>

          {/* Assignee */}
          <Select
            label="Assigné à"
            value={task.assigneeUserId ?? ''}
            onChange={(e) => patchField('assigneeUserId', e.target.value || null)}
            disabled={!isAdmin}
          >
            <option value="">Non assigné</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>

          {/* Service lié */}
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

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date début"
              type="date"
              value={task.startDate ? task.startDate.slice(0, 10) : ''}
              onChange={(e) => patchField('startDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              disabled={!isAdmin}
            />
            <Input
              label="Échéance"
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
              onChange={(e) => patchField('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
              disabled={!isAdmin}
            />
          </div>

          {/* Progress */}
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
              disabled={!isAdmin}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Notes</label>
            <textarea
              value={task.notes ?? ''}
              onChange={(e) => patchField('notes', e.target.value || null)}
              disabled={!isAdmin}
              rows={4}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
              placeholder="Notes…"
            />
          </div>

          {/* Assignee preview */}
          {task.assigneeName || task.assigneeEmail ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2">
              <InitialsAvatar name={task.assigneeName} email={task.assigneeEmail} size={24} />
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text-primary)]">{task.assigneeName ?? task.assigneeEmail}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {isAdmin ? (
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
}
