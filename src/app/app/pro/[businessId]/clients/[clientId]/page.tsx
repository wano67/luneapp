// src/app/app/pro/[businessId]/clients/[clientId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

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

type ClientDetailResponse = {
  item: Client;
};

export default function ClientDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const clientId = (params?.clientId ?? '') as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
    } catch {
      return value;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchJson<ClientDetailResponse>(
          `/api/pro/businesses/${businessId}/clients/${clientId}`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!res.ok || !res.data) {
          const msg = res.error ?? 'Chargement impossible.';
          setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
          setClient(null);
          return;
        }

        setClient(res.data.item);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Impossible de charger ce client.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId, clientId]);

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du client…</p>
      </Card>
    );
  }

  if (!client) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Client introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/clients`}>Retour à la liste</Link>
        </Button>
        <p className="text-[10px] text-[var(--text-secondary)]">
          TODO: GET /api/pro/businesses/{businessId}/clients/{clientId} pour une récupération directe.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Client · Centre de pilotage
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">{client.name}</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Cockpit client — données live, blocs finances/projets à venir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Statut: stub</Badge>
            <Badge variant="neutral">ID {client.id}</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">LTV (stub)</p>
            <p className="text-sm text-[var(--text-secondary)]">
              TODO: connecter revenu cumulé quand l’API finances sera prête.
            </p>
          </Card>
          <Card className="space-y-1 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Créé le</p>
            <p className="text-sm text-[var(--text-secondary)]">{formatDate(client.createdAt)}</p>
          </Card>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Infos générales</p>
          <Badge variant="neutral">Contact</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Email</p>
            <p className="text-sm text-[var(--text-primary)]">{client.email ?? 'Non renseigné'}</p>
          </Card>
          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Téléphone</p>
            <p className="text-sm text-[var(--text-primary)]">{client.phone ?? 'Non renseigné'}</p>
          </Card>
        </div>
        <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)]">Notes</p>
          <p className="text-sm text-[var(--text-primary)]">{client.notes ?? '—'}</p>
        </Card>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Projets du client — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: GET /api/pro/businesses/{businessId}/clients/{clientId}/projects pour lier les projets.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Finances — stub</p>
          <Badge variant="neutral">À venir</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          TODO: endpoints finances (factures, paiements, dépenses) pour calculer LTV et santé client.
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Notes & upsell — stub</p>
          <Badge variant="neutral">Bientôt</Badge>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Prévoir un bloc notes interne et opportunités d’upsell.
        </p>
      </Card>
    </div>
  );
}
