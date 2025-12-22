// src/app/app/pro/[businessId]/clients/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import RoleBanner from '@/components/RoleBanner';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { ReferencePicker } from '../references/ReferencePicker';
import { useRowSelection } from '../../../components/selection/useRowSelection';
import { BulkActionBar } from '../../../components/selection/BulkActionBar';

type Client = {
  id: string;
  businessId: string;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: { id: string; name: string }[];
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientListResponse = {
  items: Client[];
};

export default function ClientsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const { selectedCount, toggle, toggleAll, clear, isSelected } = useRowSelection();

  const fetchController = useRef<AbortController | null>(null);

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
    } catch {
      return value;
    }
  }

  async function loadClients(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);

      const query = new URLSearchParams();
      if (search.trim()) query.set('search', search.trim());
      if (categoryFilter) query.set('categoryReferenceId', categoryFilter);
      if (tagFilter) query.set('tagReferenceId', tagFilter);

      const res = await fetchJson<ClientListResponse>(
        `/api/pro/businesses/${businessId}/clients${query.toString() ? `?${query.toString()}` : ''}`,
        {},
        effectiveSignal
      );

      if (effectiveSignal?.aborted) return;

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        setError(res.requestId ? `${res.error ?? 'Erreur de chargement.'} (Ref: ${res.requestId})` : res.error ?? 'Erreur de chargement.');
        setClients([]);
        return;
      }

      const normalized = res.data.items.map((item) => ({
        ...item,
        categoryReferenceId: item.categoryReferenceId ?? null,
        categoryReferenceName: item.categoryReferenceName ?? null,
        tagReferences: item.tagReferences ?? [],
      }));
      setClients(normalized);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadClients();
    return () => fetchController.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, categoryFilter, tagFilter]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRefs() {
      setReferenceError(null);
      setReferenceRequestId(null);
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
          {},
          controller.signal
        ),
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`,
          {},
          controller.signal
        ),
      ]);
      if (controller.signal.aborted) return;
      setReferenceRequestId(catRes.requestId || tagRes.requestId || null);
      if (!catRes.ok || !tagRes.ok || !catRes.data || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setReferenceError(catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg);
        return;
      }
      setCategoryOptions(catRes.data.items);
      setTagOptions(tagRes.data.items);
    }
    void loadRefs();
    return () => controller.abort();
  }, [businessId]);

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadClients();
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    if (!isAdmin) {
      setCreateError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError('Nom requis.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetchJson<Client>(`/api/pro/businesses/${businessId}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
          categoryReferenceId: categoryReferenceId || null,
          tagReferenceIds,
        }),
      });

      if (!res.ok || !res.data) {
        setCreateError(
          res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.'
        );
        return;
      }

      setName('');
      setEmail('');
      setPhone('');
      setNotes('');
      setCategoryReferenceId('');
      setTagReferenceIds([]);
      setCreateOpen(false);
      await loadClients();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function handleBulkUnavailable() {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setBulkError('Aucune action bulk disponible pour les clients (pas d’API de suppression/archivage).');
  }

  return (
    <div className="space-y-5">
      <RoleBanner role={role} />
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Clients
            </p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Base clients</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Centralise tes clients pour lier projets et facturation.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo(readOnlyMessage);
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={!isAdmin}
            >
              Ajouter un client
            </Button>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : demande un rôle admin.</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            label="Recherche"
            placeholder="Nom, email…"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" className="md:ml-2 md:w-auto">
            Filtrer
          </Button>
        </form>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Catégorie</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Tag</label>
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              {tagOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {referenceError ? (
            <p className="text-xs text-rose-500">
              {referenceError}
              {referenceRequestId ? ` (Ref: ${referenceRequestId})` : ''}
            </p>
          ) : referenceRequestId ? (
            <p className="text-[10px] text-[var(--text-secondary)]">Refs Req: {referenceRequestId}</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des clients…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => loadClients()}>
              Réessayer
            </Button>
          </div>
        ) : clients.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun client pour le moment. Ajoute-en un pour commencer.
            </p>
            <Button
              size="sm"
              onClick={() => {
                if (!isAdmin) {
                  setReadOnlyInfo(readOnlyMessage);
                  return;
                }
                setCreateOpen(true);
              }}
              disabled={!isAdmin}
            >
              Ajouter un client
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {bulkError ? <p className="text-xs font-semibold text-rose-500">{bulkError}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={clients.length > 0 && clients.every((c) => isSelected(c.id))}
                  onChange={() => toggleAll(clients.map((c) => c.id))}
                />
                Tout sélectionner
              </label>
              <BulkActionBar
                count={selectedCount}
                onClear={clear}
                actions={[
                  {
                    label: 'Actions bulk indisponibles',
                    onClick: handleBulkUnavailable,
                    variant: 'outline',
                  },
                ]}
              />
            </div>
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/app/pro/${businessId}/clients/${client.id}`}
                className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:flex-row sm:items-center sm:justify-between"
                >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    checked={isSelected(client.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggle(client.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Sélectionner"
                  />
                <div className="space-y-1">
                  <span className="font-semibold text-[var(--text-primary)]">{client.name}</span>
                  <p className="text-xs text-[var(--text-secondary)]">Créé le {formatDate(client.createdAt)}</p>
                  {client.notes ? (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{client.notes}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {client.categoryReferenceName ? (
                      <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                        {client.categoryReferenceName}
                      </Badge>
                    ) : null}
                    {client.tagReferences?.map((tag) => (
                      <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{client.email || 'Email ?'}</Badge>
                  {client.phone ? <Badge variant="neutral">{client.phone}</Badge> : <Badge variant="neutral">Phone ?</Badge>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={createOpen}
        onCloseAction={() => (!creating ? setCreateOpen(false) : null)}
        title="Nouveau client"
        description="Ajoute un client pour suivre les projets et finances."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nom *"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            error={createError ?? undefined}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="contact@entreprise.com"
            />
            <Input
              label="Téléphone"
              value={phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
              placeholder="+33…"
            />
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Notes</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observations, attentes, historique…"
            />
          </label>
          <ReferencePicker
            businessId={businessId}
            categoryId={categoryReferenceId || null}
            tagIds={tagReferenceIds}
            onCategoryChange={(id) => setCategoryReferenceId(id ?? '')}
            onTagsChange={(ids) => setTagReferenceIds(ids)}
            disabled={!isAdmin || creating}
            title="Références"
          />
          {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating || !isAdmin}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
