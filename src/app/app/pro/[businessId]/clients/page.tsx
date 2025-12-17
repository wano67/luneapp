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

type Client = {
  id: string;
  businessId: string;
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

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

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

      setClients(res.data.items);
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
  }, [businessId]);

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadClients();
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);

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
      setCreateOpen(false);
      await loadClients();
    } catch (err) {
      console.error(err);
      setCreateError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Clients
            </p>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Base clients</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Liste des clients, contacts et notes rapides.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Ajouter un client</Button>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            label="Recherche"
            placeholder="Nom, email…"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" className="md:ml-2 md:w-auto">
            Filtrer
          </Button>
        </form>
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
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Ajouter un client
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <div
                key={client.id}
                className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <Link
                    href={`/app/pro/${businessId}/clients/${client.id}`}
                    className="font-semibold text-[var(--text-primary)] hover:underline"
                  >
                    {client.name}
                  </Link>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Créé le {formatDate(client.createdAt)}
                  </p>
                  {client.notes ? (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {client.notes}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{client.email || 'Email ?'}</Badge>
                  {client.phone ? (
                    <Badge variant="neutral">{client.phone}</Badge>
                  ) : (
                    <Badge variant="neutral">Phone ?</Badge>
                  )}
                </div>
              </div>
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
