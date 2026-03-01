"use client";

import { useState } from 'react';
import { X, Send, CheckSquare, Square } from 'lucide-react';
import type { TaskItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

type TaskSubmitPickerProps = {
  open: boolean;
  tasks: TaskItem[];
  onClose: () => void;
  onSubmit: (content: string, taskId?: string, taskGroupIds?: string[]) => void;
};

export function TaskSubmitPicker({ open, tasks, onClose, onSubmit }: TaskSubmitPickerProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');

  if (!open) return null;

  const pendingTasks = tasks.filter((t) => t.status !== 'DONE');

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedTaskIds.size === 0) return;
    const ids = [...selectedTaskIds];
    if (ids.length === 1) {
      onSubmit(comment || `Tâche soumise`, ids[0], undefined);
    } else {
      onSubmit(comment || `${ids.length} tâches soumises`, undefined, ids);
    }
    setSelectedTaskIds(new Set());
    setComment('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Soumettre des tâches
          </h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {/* Task list */}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {pendingTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
                Aucune tâche en cours.
              </p>
            ) : (
              pendingTasks.map((task) => {
                const isSelected = selectedTaskIds.has(task.id);
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare size={16} className="shrink-0 text-[var(--primary)]" />
                    ) : (
                      <Square size={16} className="shrink-0 text-[var(--text-secondary)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--text-primary)]">{task.title}</p>
                      {task.assigneeName && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          {task.assigneeName}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      task.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {task.status === 'IN_PROGRESS' ? 'En cours' : 'À faire'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Comment */}
          {selectedTaskIds.size > 0 && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajouter un commentaire (optionnel)..."
              rows={2}
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4">
          <span className="text-xs text-[var(--text-secondary)]">
            {selectedTaskIds.size} tâche{selectedTaskIds.size > 1 ? 's' : ''} sélectionnée{selectedTaskIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedTaskIds.size === 0}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              <Send size={14} />
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
