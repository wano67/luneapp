// src/app/app/pro/[businessId]/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../ActiveBusinessProvider';

type Business = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function BusinessOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const active = useActiveBusiness({ optional: true });
  const setActiveBusiness = active?.setActiveBusiness;

  const businessId = (params?.businessId ?? '') as string;

  const [business, setBusiness] = useState<Business | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const detailRes = await fetchJson<Business>(
          `/api/pro/businesses/${businessId}`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (detailRes.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!detailRes.ok || !detailRes.data) {
          const msg = detailRes.error ?? 'Impossible de charger cette entreprise.';
          const ref = detailRes.requestId;
          setError(ref ? `${msg} (Ref: ${ref})` : msg);
          return;
        }

        setBusiness(detailRes.data);
        const roleFromContext = null;
        setRole(roleFromContext);
        setActiveBusiness?.({
          id: detailRes.data.id,
          name: detailRes.data.name,
          role: roleFromContext,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Chargement impossible.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId, setActiveBusiness]);

  const quickCards = useMemo(
    () => [
      {
        key: 'prospects',
        title: 'Prospects',
        description: 'Pipeline, relances et conversion.',
        href: `/app/pro/${businessId}/prospects`,
      },
      {
        key: 'clients',
        title: 'Clients',
        description: 'Base clients et historique.',
        href: `/app/pro/${businessId}/clients`,
      },
      {
        key: 'projects',
        title: 'Projets',
        description: 'Charge, échéances, delivery.',
        href: `/app/pro/${businessId}/projects`,
      },
      {
        key: 'finances',
        title: 'Finances',
        description: 'Factures, paiements et trésorerie.',
        href: `/app/pro/${businessId}/finances`,
      },
      {
        key: 'payments',
        title: 'Payments',
        description: 'Encaissements et retards.',
        href: `/app/pro/${businessId}/finances/payments`,
      },
      {
        key: 'settings',
        title: 'Settings',
        description: 'Paramètres entreprise, facturation, équipe.',
        href: `/app/pro/${businessId}/settings`,
      },
      {
        key: 'invites',
        title: 'Invitations',
        description: ADMIN_ROLES.has(role ?? '')
          ? 'Inviter des membres (ADMIN uniquement).'
          : 'Réservé aux admins/owners.',
        href: `/app/pro/${businessId}/invites`,
        disabled: !ADMIN_ROLES.has(role ?? ''),
      },
    ],
    [businessId, role]
  );

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
      </Card>
    );
  }

  if (error || !business) {
    return (
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">Espace PRO</p>
        <p className="text-sm text-rose-300">{error ?? 'Entreprise introuvable.'}</p>
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Recharger
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Vue d&apos;ensemble
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                {business.name}
              </h1>
              {role ? (
                <Badge variant="neutral" className="uppercase">
                  {role}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Accès rapide aux espaces pilotage : pipeline, clients, projets.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(`/app/pro/${businessId}/prospects`)}>
              Ouvrir le pipeline
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/app/pro/${businessId}/projects`)}
            >
              Voir les projets
            </Button>
            <Button variant="ghost" onClick={() => router.push(`/app/pro/${businessId}/finances`)}>
              Finances
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/app/pro/${businessId}/settings`)}
            >
              Paramètres
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Identité</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Créée le {formatDate(business.createdAt)}
              </p>
            </div>
            <Badge variant="neutral">Business #{business.id}</Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Rôle actuel : {role ?? '—'} · Owner #{business.ownerId}
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Actions rapides</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => router.push(`/app/pro/${businessId}/prospects?new=1`)}
            >
              Créer un prospect
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/app/pro/${businessId}/clients`)}
            >
              Ajouter un client
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/app/pro/${businessId}/projects`)}
            >
              Nouveau projet
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/app/pro/${businessId}/settings`)}
            >
              Paramètres
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/app/pro/${businessId}/finances/payments`)}
            >
              Paiements
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickCards.map((card) => (
          <Card
            key={card.key}
            className={`flex h-full flex-col justify-between p-4 ${
              card.disabled ? 'opacity-60' : ''
            }`}
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{card.title}</p>
              <p className="text-xs text-[var(--text-secondary)]">{card.description}</p>
            </div>
            <Button
              asChild
              variant="outline"
              className="mt-3 justify-start"
              aria-disabled={card.disabled}
              tabIndex={card.disabled ? -1 : 0}
            >
              <Link href={card.href}>{card.disabled ? 'Accès limité' : 'Ouvrir →'}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
