// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PublicUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
};

type BusinessSummary = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type AuthMeResponse = {
  user: PublicUser;
  memberships: {
    business: BusinessSummary;
    role: string;
  }[];
};

type BusinessesResponse = {
  items: {
    business: BusinessSummary;
    role: string;
  }[];
};

type BusinessInviteAcceptResponse = {
  business: BusinessSummary;
  role: string; // BusinessRole (OWNER / ADMIN / MEMBER / VIEWER)
};

export default function ProHomeClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);

  const [creating, setCreating] = useState(false);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [creationError, setCreationError] = useState<string | null>(null);

  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [meRes, businessesRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/pro/businesses', { credentials: 'include' }),
        ]);

        // Non authentifié → redirection login
        if (meRes.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login?from=/app/pro';
          }
          return;
        }

        if (!meRes.ok) {
          throw new Error("Impossible de charger les informations utilisateur.");
        }

        if (!businessesRes.ok) {
          throw new Error("Impossible de charger les entreprises.");
        }

        const meJson = (await meRes.json()) as AuthMeResponse;
        const businessesJson = (await businessesRes.json()) as BusinessesResponse;

        if (!isMounted) return;

        setMe(meJson);
        setBusinesses(businessesJson);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Une erreur est survenue lors du chargement de l'espace pro."
        );
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshBusinesses() {
    try {
      const businessesRes = await fetch('/api/pro/businesses', {
        credentials: 'include',
      });
      if (businessesRes.ok) {
        const businessesJson = (await businessesRes.json()) as BusinessesResponse;
        setBusinesses(businessesJson);
      }
    } catch (err) {
      console.error('Erreur lors du rafraîchissement des entreprises', err);
    }
  }

  async function handleCreateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreationError(null);

    const name = newBusinessName.trim();
    if (!name) {
      setCreationError("Merci d'indiquer un nom d'entreprise.");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch('/api/pro/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setCreationError(
          typeof (json as any).error === 'string'
            ? (json as any).error
            : "Impossible de créer l'entreprise."
        );
        return;
      }

      await refreshBusinesses();

      setNewBusinessName('');
      setCreationError(null);
    } catch (err) {
      console.error(err);
      setCreationError('Une erreur est survenue pendant la création.');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    const token = joinToken.trim();
    if (!token) {
      setJoinError("Merci de coller le token d'invitation reçu par email.");
      return;
    }

    try {
      setJoining(true);

      const res = await fetch('/api/pro/businesses/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setJoinError(
          typeof (json as any).error === 'string'
            ? (json as any).error
            : "Impossible de rejoindre l'entreprise avec ce token."
        );
        return;
      }

      const data = json as BusinessInviteAcceptResponse;

      setJoinSuccess(
        `Tu as rejoint « ${data.business.name} » en tant que ${data.role}.`
      );
      setJoinError(null);
      setJoinToken('');

      await refreshBusinesses();
    } catch (err) {
      console.error(err);
      setJoinError('Une erreur est survenue pendant la tentative de rejoindre.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">
          Chargement de ton espace pro…
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="space-y-2 border border-rose-400/40 bg-rose-500/5 p-5">
        <p className="text-sm font-semibold text-rose-200">Espace PRO</p>
        <p className="text-sm text-rose-300">{error}</p>
        <p className="text-xs text-[var(--text-secondary)]">
          Tu peux essayer de recharger la page ou de te reconnecter.
        </p>
      </Card>
    );
  }

  const items = businesses?.items ?? [];
  const userName = me?.user.name || me?.user.email;

  // Cas 1 : aucune entreprise
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-[var(--text-secondary)]">
            Bienvenue {userName}. Tu n&apos;as pas encore d&apos;entreprise configurée.
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Crée ton espace PRO ou rejoins une entreprise via une invitation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Créer une entreprise */}
          <Card className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">Créer une entreprise</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Crée l&apos;espace PRO de ton activité. Tu pourras ensuite inviter des
              collaborateurs et configurer tes clients, projets et finances.
            </p>
            <form onSubmit={handleCreateBusiness} className="space-y-3">
              <Input
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Nom de l’entreprise"
                label="Nom de l’entreprise"
                error={creationError}
              />
              <Button type="submit" disabled={creating} className="w-full md:w-auto">
                {creating ? 'Création…' : 'Créer mon entreprise'}
              </Button>
            </form>
          </Card>

          {/* Rejoindre une entreprise */}
          <Card className="space-y-3 p-5">
            <h2 className="text-lg font-semibold">Rejoindre une entreprise</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Si quelqu&apos;un t&apos;a invité, tu as reçu un lien ou un token
              d&apos;invitation. Colle-le ici pour rejoindre l&apos;entreprise.
            </p>
            <form onSubmit={handleJoinBusiness} className="space-y-3">
              <Input
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                placeholder="Token d’invitation"
                label="Token"
                error={joinError}
              />
              <Button type="submit" disabled={joining} className="w-full md:w-auto">
                {joining ? 'Vérification…' : "Rejoindre l'entreprise"}
              </Button>
              {joinSuccess && (
                <p className="text-xs text-emerald-500">{joinSuccess}</p>
              )}
            </form>
            <p className="text-xs text-[var(--text-secondary)]">
              Ce token correspond à l&apos;endpoint{' '}
              <code className="font-mono text-[11px]">
                POST /api/pro/businesses/invites/accept
              </code>{' '}
              de ton API.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Cas 2 : au moins une entreprise
  return (
    <div className="space-y-6">
      {/* Header + création d’entreprise */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              App · PRO
            </p>
            <h2 className="text-lg font-semibold">
              Espace PRO de {userName}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Choisis une entreprise à piloter, crée-en une nouvelle ou rejoins
              une équipe via un token.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:w-80">
            <form
              onSubmit={handleCreateBusiness}
              className="flex flex-col gap-2"
            >
              <Input
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Nom de la nouvelle entreprise"
                label="Nouvelle entreprise"
                error={creationError || undefined}
              />
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? 'Création…' : 'Nouvelle entreprise'}
              </Button>
            </form>

            <form onSubmit={handleJoinBusiness} className="flex flex-col gap-2">
              <Input
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                placeholder="Token d’invitation"
                label="Rejoindre une entreprise"
                error={joinError || undefined}
              />
              <Button type="submit" disabled={joining} variant="outline" className="w-full">
                {joining ? 'Vérification…' : "Rejoindre avec un token"}
              </Button>
              {joinSuccess && (
                <p className="text-xs text-emerald-500">{joinSuccess}</p>
              )}
            </form>
          </div>
        </div>
      </Card>

      {/* Liste des entreprises */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ business, role }) => (
          <Card
            key={business.id}
            className="flex h-full flex-col justify-between p-5"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">
                  {business.name}
                </h3>
                <Badge variant="neutral" className="text-[11px]">
                  {role}
                </Badge>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Créée le{' '}
                {new Date(business.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Link
                href={`/app/pro/${business.id}`}
                className="text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Entrer dans l&apos;espace →
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
