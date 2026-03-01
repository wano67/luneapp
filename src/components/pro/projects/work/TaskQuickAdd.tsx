"use client";

import { useCallback, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

type TaskQuickAddProps = {
  onAdd: (title: string) => Promise<void>;
  disabled?: boolean;
};

export function TaskQuickAdd({ onAdd, disabled }: TaskQuickAddProps) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed);
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  }, [title, submitting, onAdd]);

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 px-3 py-2">
      {submitting ? (
        <Loader2 size={16} className="shrink-0 animate-spin text-[var(--text-secondary)]" />
      ) : (
        <Plus size={16} className="shrink-0 text-[var(--text-secondary)]" />
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder="Ajouter une tâche…"
        disabled={disabled || submitting}
        className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
      />
    </div>
  );
}
