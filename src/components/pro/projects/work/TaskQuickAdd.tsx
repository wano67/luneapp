"use client";

import { useCallback, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

type ServiceOption = { id: string; name: string };

type TaskQuickAddProps = {
  onAdd: (title: string, projectServiceId?: string) => Promise<void>;
  services?: ServiceOption[];
  disabled?: boolean;
};

export function TaskQuickAdd({ onAdd, services, disabled }: TaskQuickAddProps) {
  const [title, setTitle] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(trimmed, serviceId || undefined);
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  }, [title, serviceId, submitting, onAdd]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 px-3 py-2">
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
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
      />
      {services && services.length > 0 ? (
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          disabled={disabled || submitting}
          className="min-w-0 max-w-[160px] shrink-0 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-secondary)] outline-none"
        >
          <option value="">Sans service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
