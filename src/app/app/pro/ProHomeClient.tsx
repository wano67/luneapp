// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import SwitchBusinessModal from './SwitchBusinessModal';
import { useActiveBusiness } from './ActiveBusinessProvider';

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
};

/* ===================== COMPONENT ===================== */

export default function ProHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCtx = useActiveBusiness({ optional: true });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const [lastVisitedId, setLastVisitedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ---------- CREATE MODAL ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateBusinessDraft>({
    name: '',
  });

  /* ---------- JOIN MODAL ---------- */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  /* ---------- DATA ---------- */
  const items = useMemo(() => businesses?.items ?? [], [businesses]);

  const createValidation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.name.trim()) issues.push("Le nom de l'entreprise est obligatoire.");
    return { ok: issues.length === 0, issues };
  }, [draft]);

  useEffect(() => {
    // hydrate once on mount
    if (typeof window === 'undefined') return;
    try {
      const storedLast = localStorage.getItem('lastProBusinessId');
      if (storedLast) setLastVisitedId(storedLast);
      const storedActive = localStorage.getItem('activeProBusinessId');
      if (storedActive) setActiveId(storedActive);
    } catch {
      // ignore
    }
  }, []);

  // auto-open disabled to avoid loops; handled explicitly elsewhere

  /* ===================== OPEN MODALS FROM QUERY ===================== */
  const searchParamsKey = searchParams?.toString() ?? '';

  useEffect(() => {
    // Only for /app/pro route (this component is mounted there anyway)
    const params = new URLSearchParams(searchParamsKey);
    const create = params.get('create');
    const join = params.get('join');
    const tokenParam = params.get('token');

    if (create === '1') {
      setCreateOpen(true);
      // clean URL (no history pollution)
      router.replace('/app/pro');
      return;
    }

    if (join === '1') {
      setJoinOpen(true);
      if (tokenParam) setJoinToken(tokenParam);
      router.replace('/app/pro');
      return;
    }
  }, [searchParamsKey, router]);

  /* ===================== LOAD ===================== */

  useEffect(() => {
    const controller = new AbortController();
    loadController.current?.abort();
    loadController.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [meRes, bizRes] = await Promise.all([
          fetchJson<AuthMeResponse>('/api/auth/me', {}, controller.signal),
          fetchJson<BusinessesResponse>('/api/pro/businesses', {}, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        if (meRes.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!meRes.ok || !bizRes.ok || !meRes.data || !bizRes.data) {
          const ref = meRes.requestId ?? bizRes.requestId;
          const message = bizRes.error || meRes.error || 'Impossible de charger l’espace PRO.';
          setError(ref ? `${message} (Ref: ${ref})` : message);
          return;
        }

        setMe(meRes.data);
        setBusinesses(bizRes.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  async function refreshBusinesses(signal?: AbortSignal) {
    try {
      const res = await fetchJson<BusinessesResponse>(
        '/api/pro/businesses',
        {},
        signal
      );
      if (!res.ok || !res.data || signal?.aborted) return;
      setBusinesses(res.data);
    } catch (err) {
      console.error('refreshBusinesses failed', err);
    }
  }

  function rememberAndGo(businessId: string, path: string) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('lastProBusinessId', businessId);
        localStorage.setItem('activeProBusinessId', businessId);
        setLastVisitedId(businessId);
        setActiveId(businessId);
      } catch {
        // ignore storage errors
      }
    }
    router.push(path);
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

      const res = await fetchJson<BusinessInviteAcceptResponse>(
        '/api/pro/businesses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: draft.name.trim() }),
        }
      );

      if (!res.ok || !res.data) {
        const ref = res.requestId;
        const msg = res.error ?? 'Création impossible.';
        setCreationError(ref ? `${msg} (Ref: ${ref})` : msg);
        return;
      }

      await refreshBusinesses();

      setCreateOpen(false);
      setDraft({
        name: '',
      });
      rememberAndGo(res.data.business.id, `/app/pro/${res.data.business.id}`);
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

      const res = await fetchJson<BusinessInviteAcceptResponse>(
        '/api/pro/businesses/invites/accept',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );

      if (!res.ok || !res.data) {
        const ref = res.requestId;
        const msg = res.error ?? 'Token invalide.';
        setJoinError(ref ? `${msg} (Ref: ${ref})` : msg);
        return;
      }

      const data = res.data;
      setJoinSuccess(`Tu as rejoint « ${data.business?.name ?? "l'entreprise"} ».`);
      setJoinToken('');
      await refreshBusinesses();
      setJoinOpen(false);
      rememberAndGo(data.business.id, `/app/pro/${data.business.id}`);
    } catch (err) {
      console.error(err);
      setJoinError('Erreur de connexion.');
    } finally {
      setJoining(false);
    }
  }

  const continueBusiness = useMemo(() => {
    if (items.length === 0) return null;
    if (lastVisitedId) {
      const match = items.find((b) => b.business.id === lastVisitedId);
      if (match) return match;
    }
    return items[0];
  }, [items, lastVisitedId]);

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
      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              App · PRO
            </p>
            <h2 className="text-xl font-semibold">Espace PRO</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Gère tes entreprises, prospects, projets et clients.
            </p>
            {me?.user ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Connecté en tant que <span className="font-semibold text-[var(--text-primary)]">{me.user.name ?? me.user.email}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>Créer une entreprise</Button>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              Rejoindre via invitation
            </Button>
          </div>
        </div>
      </Card>

      {activeId ? (
        <Card className="p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                Entreprise active
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {activeCtx?.activeBusiness?.name ?? activeId}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Définie depuis ta dernière navigation.
              </p>
            </div>
            <Button onClick={() => rememberAndGo(activeId, `/app/pro/${activeId}`)}>
              Ouvrir mon espace de travail
            </Button>
            <Button variant="outline" onClick={() => activeCtx?.openSwitchModal?.()}>
              Changer d’entreprise
            </Button>
          </div>
        </Card>
      ) : null}

      {/* CONTINUER */}
      {continueBusiness ? (
        <Card className="p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                Continuer
              </p>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{continueBusiness.business.name}</h3>
                <Badge variant="neutral">{continueBusiness.role}</Badge>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Dernière entreprise visitée ou première de ta liste.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  rememberAndGo(continueBusiness.business.id, `/app/pro/${continueBusiness.business.id}`)
                }
              >
                Ouvrir
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  rememberAndGo(
                    continueBusiness.business.id,
                    `/app/pro/${continueBusiness.business.id}/prospects`
                  )
                }
              >
                Prospects
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* LIST */}
      {items.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(({ business, role }) => {
            const isAdmin = role === 'ADMIN' || role === 'OWNER';
            return (
              <Card key={business.id} className="p-4 space-y-3">
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => rememberAndGo(business.id, `/app/pro/${business.id}`)}
                  >
                    Ouvrir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      rememberAndGo(business.id, `/app/pro/${business.id}/prospects`)
                    }
                  >
                    Prospects
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rememberAndGo(business.id, `/app/pro/${business.id}/projects`)}
                  >
                    Projets
                  </Button>
                  {isAdmin ? (
                    <Link
                      href={`/app/pro/${business.id}/invites`}
                      className="text-xs font-semibold text-[var(--accent)] underline underline-offset-4"
                      onClick={() => rememberAndGo(business.id, `/app/pro/${business.id}/invites`)}
                    >
                      Invitations
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Aucune entreprise pour le moment. Crée-en une ou rejoins-en une.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setCreateOpen(true)}>Créer une entreprise</Button>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              Rejoindre via invitation
            </Button>
          </div>
        </Card>
      )}

      {/* CREATE MODAL */}
      <Modal
        open={createOpen}
        onCloseAction={() => (creating ? null : setCreateOpen(false))}
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
        onCloseAction={() => (joining ? null : setJoinOpen(false))}
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
 
// include switch modal globally on /app/pro hub
export function ProHomeWithSwitch() {
  return (
    <>
      <ProHomeClient />
      <SwitchBusinessModal />
    </>
  );
}
