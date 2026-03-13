"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Select from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type ClientOption = { id: string; name: string };
type ReferenceOption = { id: string; name: string; type: string };
type Props = { businessId: string };

export default function NewProjectForm({ businessId }: Props) {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryReferenceId, setCategoryReferenceId] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [categories, setCategories] = useState<ReferenceOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Warn on navigation with unsaved changes
  const isDirty = !!(name || clientId || startDate || endDate || categoryReferenceId);
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchJson<{ items: ClientOption[] }>(
        `/api/pro/businesses/${businessId}/clients`,
        {},
        controller.signal,
      ),
      fetchJson<{ items: ReferenceOption[] }>(
        `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
        {},
        controller.signal,
      ),
    ])
      .then(([clientsRes, refsRes]) => {
        if (clientsRes.ok && clientsRes.data?.items) setClients(clientsRes.data.items);
        if (refsRes.ok && refsRes.data?.items) setCategories(refsRes.data.items);
      })
      .finally(() => setLoadingData(false));
    return () => controller.abort();
  }, [businessId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Le nom du projet est requis.'); return; }
    if (!clientId) { setError('Sélectionne un client.'); return; }
    if (startDate && endDate && startDate > endDate) { setError('La date de fin doit être après la date de début.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetchJson<{ item: { id: string } }>(`/api/pro/businesses/${businessId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          clientId,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(categoryReferenceId ? { categoryReferenceId } : {}),
        }),
      });
      if (!res.ok || !res.data?.item?.id) {
        throw new Error(res.error ?? 'Création du projet impossible.');
      }
      router.replace(`/app/pro/${businessId}/projects/${res.data.item.id}?setup=1`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err) || 'Erreur réseau.');
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
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Essentials */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Informations</div>

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-[var(--text-primary)]">
                Nom du projet
              </label>
              <input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none ring-0 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                placeholder="Ex: Refonte site web client"
                autoFocus
              />
            </div>

            <Select
              label="Client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={loadingData}
            >
              <option value="">{loadingData ? 'Chargement…' : 'Sélectionner un client'}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>

            {categories.length > 0 && (
              <Select
                label="Catégorie"
                value={categoryReferenceId}
                onChange={(e) => setCategoryReferenceId(e.target.value)}
              >
                <option value="">Aucune catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </div>

          {/* Dates */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Planning</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="startDate" className="block text-xs font-medium text-[var(--text-secondary)]">
                  Date de début
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="endDate" className="block text-xs font-medium text-[var(--text-secondary)]">
                  Date de fin prévue
                </label>
                <input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading || loadingData}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Créer le projet
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
