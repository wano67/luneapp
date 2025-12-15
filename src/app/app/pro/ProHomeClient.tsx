// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

/* ===================== TYPES ===================== */

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
};

type BusinessesResponse = {
  items: {
    business: BusinessSummary;
    role: string;
  }[];
};

type BusinessInviteAcceptResponse = {
  business: BusinessSummary;
  role: string;
};

type CreateBusinessDraft = {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  city: string;
  address: string;
  vatNumber: string;
};

/* ===================== UTILS ===================== */

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

type ApiErrorShape = { error: string };

function isApiErrorShape(x: unknown): x is ApiErrorShape {
  return (
    !!x &&
    typeof x === 'object' &&
    'error' in x &&
    typeof (x as { error?: unknown }).error === 'string'
  );
}

/* ===================== COMPONENT ===================== */

export default function ProHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);

  /* ---------- CREATE MODAL ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateBusinessDraft>({
    name: '',
    legalName: '',
    email: '',
    phone: '',
    website: '',
    country: 'France',
    city: '',
    address: '',
    vatNumber: '',
  });

  /* ---------- JOIN MODAL ---------- */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  /* ---------- DATA ---------- */
  const items = businesses?.items ?? [];
  const userName = me?.user.name || me?.user.email || 'toi';

  const createValidation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.name.trim()) issues.push("Le nom de l'entreprise est obligatoire.");
    if (draft.email && !isEmail(draft.email)) issues.push('Email invalide.');
    return { ok: issues.length === 0, issues };
  }, [draft]);

  /* ===================== OPEN MODALS FROM QUERY ===================== */
  useEffect(() => {
    // Only for /app/pro route (this component is mounted there anyway)
    const create = searchParams?.get('create');
    const join = searchParams?.get('join');

    if (create === '1') {
      setCreateOpen(true);
      // clean URL (no history pollution)
      router.replace('/app/pro');
      return;
    }

    if (join === '1') {
      setJoinOpen(true);
      router.replace('/app/pro');
      return;
    }
  }, [searchParams, router]);

  /* ===================== LOAD ===================== */

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [meRes, bizRes] = await Promise.all([
          fetch('/api/auth/me', { credentials: 'include' }),
          fetch('/api/pro/businesses', { credentials: 'include' }),
        ]);

        if (meRes.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!meRes.ok || !bizRes.ok) throw new Error('Chargement impossible.');

        const meJson = (await meRes.json()) as AuthMeResponse;
        const bizJson = (await bizRes.json()) as BusinessesResponse;

        if (!mounted) return;
        setMe(meJson);
        setBusinesses(bizJson);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError("Impossible de charger l’espace PRO.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function refreshBusinesses() {
    try {
      const res = await fetch('/api/pro/businesses', { credentials: 'include' });
      if (!res.ok) return;
      const json = await safeJson(res);
      if (json && typeof json === 'object' && 'items' in json) {
        setBusinesses(json as BusinessesResponse);
      }
    } catch (err) {
      console.error('refreshBusinesses failed', err);
    }
  }

  /* ===================== ACTIONS ===================== */

  async function handleCreateBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreationError(null);

    if (!createValidation.ok) {
      setCreationError(createValidation.issues[0] ?? 'Formulaire invalide.');
      return;
    }

    try {
      setCreating(true);

      const res = await fetch('/api/pro/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: draft.name.trim() }),
      });

      const json = await safeJson(res);

      if (!res.ok) {
        const msg = isApiErrorShape(json) ? json.error : 'Création impossible.';
        setCreationError(msg);
        return;
      }

      await refreshBusinesses();

      setCreateOpen(false);
      setDraft({
        name: '',
        legalName: '',
        email: '',
        phone: '',
        website: '',
        country: 'France',
        city: '',
        address: '',
        vatNumber: '',
      });
    } catch (err) {
      console.error(err);
      setCreationError('Création impossible.');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setJoinError(null);
    setJoinSuccess(null);

    const token = joinToken.trim();
    if (!token) {
      setJoinError('Token requis.');
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

      const json = await safeJson(res);

      if (!res.ok) {
        const msg = isApiErrorShape(json) ? json.error : 'Token invalide.';
        setJoinError(msg);
        return;
      }

      const data = (json ?? {}) as BusinessInviteAcceptResponse;
      setJoinSuccess(`Tu as rejoint « ${data.business?.name ?? 'l’entreprise'} ».`);
      setJoinToken('');
      await refreshBusinesses();
      setJoinOpen(false);
    } catch (err) {
      console.error(err);
      setJoinError('Erreur de connexion.');
    } finally {
      setJoining(false);
    }
  }

  /* ===================== UI ===================== */

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-rose-500">Espace PRO</p>
        <p className="text-sm text-rose-500/90">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              App · PRO
            </p>
            <h2 className="text-lg font-semibold">Espace PRO de {userName}</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Crée une entreprise ou rejoins une équipe via invitation.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>Créer une entreprise</Button>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              Rejoindre une entreprise
            </Button>
          </div>
        </div>
      </Card>

      {/* EMPTY STATE */}
      {items.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Aucune entreprise pour le moment. Crée-en une ou rejoins-en une.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>Créer une entreprise</Button>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              Rejoindre une entreprise
            </Button>
          </div>
        </Card>
      ) : null}

      {/* LIST */}
      {items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ business, role }) => (
            <Card key={business.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{business.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Créée le {new Date(business.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <Badge variant="neutral" className="shrink-0">
                  {role}
                </Badge>
              </div>

              <Link
                href={`/app/pro/${business.id}`}
                className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                Entrer →
              </Link>
            </Card>
          ))}
        </div>
      ) : null}

      {/* CREATE MODAL */}
      <Modal
        open={createOpen}
        onClose={() => (creating ? null : setCreateOpen(false))}
        title="Créer une entreprise"
        description="Formulaire complet (pour l’instant, l’API n’exige que le nom)."
      >
        <form onSubmit={handleCreateBusiness} className="space-y-4">
          <Input
            label="Nom de l’entreprise *"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            error={creationError ?? undefined}
            placeholder="Ex: StudioFief"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* JOIN MODAL */}
      <Modal
        open={joinOpen}
        onClose={() => (joining ? null : setJoinOpen(false))}
        title="Rejoindre une entreprise"
        description="Colle ici le token d’invitation reçu par email."
      >
        <form onSubmit={handleJoinBusiness} className="space-y-4">
          <Input
            label="Token d’invitation"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            error={joinError ?? undefined}
            placeholder="eyJhbGciOi..."
          />

          {joinSuccess ? <p className="text-xs text-emerald-500">{joinSuccess}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => setJoinOpen(false)}
              disabled={joining}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={joining}>
              {joining ? 'Vérification…' : 'Rejoindre'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
