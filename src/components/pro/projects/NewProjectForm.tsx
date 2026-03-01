"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type Props = { businessId: string };

export default function NewProjectForm({ businessId }: Props) {
  const [formState, setFormState] = useState({ name: '', error: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = formState.name.trim();
    if (!name) {
      setFormState((s) => ({ ...s, error: 'Le nom du projet est requis.' }));
      return;
    }
    setLoading(true);
    setFormState((s) => ({ ...s, error: '' }));
    try {
      const res = await fetchJson<{ item: { id: string } }>(`/api/pro/businesses/${businessId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok || !res.data?.item?.id) {
        throw new Error(res.error ?? 'Création du projet impossible.');
      }
      router.replace(`/app/pro/${businessId}/projects/${res.data.item.id}?setup=1`);
      router.refresh();
    } catch (err) {
      setFormState((s) => ({ ...s, error: getErrorMessage(err) || 'Erreur réseau.' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href={`/app/pro/${businessId}/projects`} aria-label="Retour aux projets">
            <ArrowLeft size={16} />
            Retour
          </Link>
        </Button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Nouveau projet</h1>
      </div>

      <Card className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-[var(--text-primary)]">
              Nom du projet
            </label>
            <input
              id="name"
              name="name"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none ring-0 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              placeholder="Ex: Refonte site web client"
              autoFocus
            />
          </div>

          {formState.error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {formState.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Créer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
