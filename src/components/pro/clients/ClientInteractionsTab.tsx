import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type Interaction = {
  id: string;
  type: string;
  content: string | null;
  happenedAt: string;
  createdByUserId: string | null;
};

type Props = {
  businessId: string;
  clientId: string;
  initialItems?: Interaction[];
  alreadyLoaded?: boolean;
  onChange?: (items: Interaction[]) => void;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export function ClientInteractionsTab({ businessId, clientId, initialItems, alreadyLoaded, onChange }: Props) {
  const [items, setItems] = useState<Interaction[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!(alreadyLoaded && initialItems));
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ content: string; happenedAt: string }>({
    content: '',
    happenedAt: '',
  });

  useEffect(() => {
    if (initialItems !== undefined) {
      setItems(initialItems);
      if (alreadyLoaded) setLoading(false);
    }
  }, [alreadyLoaded, initialItems]);

  useEffect(() => {
    if (alreadyLoaded && initialItems !== undefined) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<{ items?: Interaction[] }>(
          `/api/pro/businesses/${businessId}/interactions?clientId=${clientId}&limit=50`,
          { cache: 'no-store' },
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error ?? 'Interactions indisponibles');
          setItems([]);
          onChange?.([]);
          return;
        }
        const list = res.data?.items ?? [];
        setItems(list);
        onChange?.(list);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [alreadyLoaded, businessId, clientId, initialItems, onChange]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!form.content.trim()) {
      setFormError('Contenu requis');
      return;
    }
    try {
      setSaving(true);
      const res = await fetchJson<Interaction>(`/api/pro/businesses/${businessId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'NOTE',
          content: form.content.trim(),
          happenedAt: form.happenedAt || undefined,
          clientId,
        }),
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Création impossible');
        return;
      }
      setModalOpen(false);
      setForm({ content: '', happenedAt: '' });
      const reload = await fetchJson<{ items?: Interaction[] }>(
        `/api/pro/businesses/${businessId}/interactions?clientId=${clientId}&limit=50`,
        { cache: 'no-store' },
      );
      if (reload.ok && reload.data?.items) {
        setItems(reload.data.items);
        onChange?.(reload.data.items);
      }
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Interactions</p>
          <p className="text-xs text-[var(--text-secondary)]">Notes et échanges liés au client</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setModalOpen(true)}
        >
          Ajouter une interaction
        </Button>
      </div>

      <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-hover)]" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-hover)]/40 p-4 text-sm text-[var(--text-secondary)]">
            Aucune interaction enregistrée.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="flex flex-col gap-1 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-hover)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{i.type ?? 'Note'}</p>
                  <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">{i.content ?? '—'}</p>
                </div>
                <span className="text-[12px] text-[var(--text-secondary)]">{formatDate(i.happenedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onCloseAction={() => (!saving ? setModalOpen(false) : null)}
        title="Ajouter une interaction"
        description="Note ou échange lié au client."
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label="Date"
            type="date"
            value={form.happenedAt}
            onChange={(e) => setForm((prev) => ({ ...prev, happenedAt: e.target.value }))}
          />
          <label className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Contenu</span>
            <textarea
              rows={4}
              required
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </label>
          {formError ? <p className="text-xs text-[var(--danger)]">{formError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Ajout…' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
