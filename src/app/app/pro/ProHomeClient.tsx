// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import SwitchBusinessModal from './SwitchBusinessModal';
import { PageHeader } from '../components/PageHeader';
import { FaviconAvatar } from '../components/FaviconAvatar';

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
  websiteUrl?: string | null;
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

type OverviewResponse = {
  totals: {
    businessesCount: number;
    projectsActiveCount: number;
    totalNetCents: string;
  };
  upcomingTasks: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    businessId: string;
    businessName: string | null;
    websiteUrl: string | null;
  }>;
};

type CreateBusinessDraft = {
  name: string;
  websiteUrl: string;
};

/* ===================== COMPONENT ===================== */

export default function ProHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ---------- CREATE MODAL ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateBusinessDraft>({
    name: '',
    websiteUrl: '',
  });
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  /* ---------- JOIN MODAL ---------- */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);

  /* ---------- DATA ---------- */
  const items = useMemo(() => businesses?.items ?? [], [businesses]);
  const defaultBusinessId = useMemo(() => activeId ?? items[0]?.business.id ?? null, [activeId, items]);

  const createValidation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.name.trim()) issues.push("Le nom de l'entreprise est obligatoire.");
    return { ok: issues.length === 0, issues };
  }, [draft]);

  useEffect(() => {
    // hydrate once on mount
    if (typeof window === 'undefined') return;
    try {
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

        const [meRes, bizRes, overviewRes] = await Promise.all([
          fetchJson<AuthMeResponse>('/api/auth/me', {}, controller.signal),
          fetchJson<BusinessesResponse>('/api/pro/businesses', {}, controller.signal),
          fetchJson<OverviewResponse>('/api/pro/overview', {}, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        if (meRes.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!meRes.ok || !bizRes.ok || !overviewRes.ok || !meRes.data || !bizRes.data || !overviewRes.data) {
          const ref = meRes.requestId ?? bizRes.requestId ?? overviewRes.requestId;
          const message = bizRes.error || meRes.error || overviewRes.error || 'Impossible de charger l’espace PRO.';
          setError(ref ? `${message} (Ref: ${ref})` : message);
          return;
        }

        setMe(meRes.data);
        setBusinesses(bizRes.data);
        setOverview(overviewRes.data);
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
        localStorage.setItem('activeProBusinessId', businessId);
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
          body: JSON.stringify({
            name: draft.name.trim(),
            websiteUrl: draft.websiteUrl.trim() || undefined,
          }),
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
        websiteUrl: '',
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

  async function triggerDevSeed() {
    setSeedMessage(null);
    setSeedError(null);
    setSeeding(true);
    const res = await fetchJson<{ ok: boolean; result: { businessId: string } }>('/api/dev/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    setSeeding(false);
    if (!res.ok) {
      const msg = res.error ?? 'Seed dev indisponible.';
      setSeedError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setSeedMessage('Compte admin dev prêt. Identifiants: admin@local.test / admintest');
    if (res.data?.result?.businessId) {
      await refreshBusinesses();
    }
  }

  const upcomingTasks = useMemo(() => overview?.upcomingTasks ?? [], [overview]);
  const groupedTasks = useMemo(() => {
    const buckets: Record<string, typeof upcomingTasks> = {};
    for (const task of upcomingTasks) {
      const due = task.dueDate ? new Date(task.dueDate) : null;
      const key = due ? due.toISOString().slice(0, 10) : 'Aucune date';
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(task);
    }
    return Object.entries(buckets)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, tasks]) => ({ date, tasks }));
  }, [upcomingTasks]);

  const formatCurrency = (cents: string | number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
      Number(cents) / 100
    );

  /* ===================== UI ===================== */

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-4">
      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        </Card>
      ) : error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-rose-500">Espace PRO</p>
          <p className="text-sm text-rose-500/90">{error}</p>
        </Card>
      ) : (
        <>
          <PageHeader
            title="Espace PRO"
            subtitle="Gère tes entreprises, prospects, projets et clients."
            primaryAction={{ label: 'Créer une entreprise', onClick: () => setCreateOpen(true) }}
            secondaryAction={{ label: 'Rejoindre via invitation', onClick: () => setJoinOpen(true), variant: 'outline' }}
          />
          {me?.user ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Connecté en tant que <span className="font-semibold text-[var(--text-primary)]">{me.user.name ?? me.user.email}</span>
            </p>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Aperçu global
            </h3>

            <div className="grid gap-3 md:grid-cols-3">
              <Card className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Solde net (finances)</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">
                  {overview ? formatCurrency(overview.totals.totalNetCents) : '—'}
                </p>
              </Card>
              <Card className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Projets actifs</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">
                  {overview?.totals.projectsActiveCount ?? '—'}
                </p>
              </Card>
              <Card className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Entreprises</p>
                <p className="text-2xl font-semibold text-[var(--text-primary)]">
                  {overview?.totals.businessesCount ?? items.length}
                </p>
              </Card>
            </div>

            <Card className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Tâches à venir (7 jours)</h4>
                <Badge variant="neutral" className="text-[11px]">
                  {upcomingTasks.length} tâche{upcomingTasks.length > 1 ? 's' : ''}
                </Badge>
              </div>
              {groupedTasks.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-secondary)]">Aucune tâche planifiée sur les 7 prochains jours.</p>
                  {defaultBusinessId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rememberAndGo(defaultBusinessId, `/app/pro/${defaultBusinessId}/tasks`)}
                    >
                      Créer une tâche
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedTasks.map(({ date, tasks }) => {
                    const label =
                      date === 'Aucune date'
                        ? 'Sans date'
                        : new Date(date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                          });
                    return (
                      <div key={date} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          {label}
                        </p>
                        <div className="space-y-2">
                          {tasks.map((task) => {
                            const taskHref =
                              task.businessId && task.id
                                ? `/app/pro/${task.businessId}/tasks/${task.id}`
                                : task.businessId
                                  ? `/app/pro/${task.businessId}`
                                  : null;
                            const content = (
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]">
                                <div className="flex min-w-0 items-center gap-3">
                                  <FaviconAvatar
                                    name={task.businessName ?? 'Entreprise'}
                                    websiteUrl={task.websiteUrl ?? null}
                                    size={28}
                                  />
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="truncate font-medium text-[var(--text-primary)]">{task.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                      <span className="truncate">{task.businessName ?? 'Entreprise'}</span>
                                      <Badge variant="neutral" className="shrink-0">
                                        {task.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                                {task.dueDate ? (
                                  <Badge variant="neutral" className="shrink-0">
                                    {new Date(task.dueDate).toLocaleDateString('fr-FR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                    })}
                                  </Badge>
                                ) : null}
                              </div>
                            );
                            return taskHref ? (
                              <Link key={task.id} href={taskHref} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
                                {content}
                              </Link>
                            ) : (
                              <div key={task.id}>{content}</div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Mes entreprises
          </h3>
          <Badge variant="neutral" className="text-[11px]">
            {items.length} entreprise{items.length > 1 ? 's' : ''}
          </Badge>
        </div>
        {items.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map(({ business, role }) => {
              return (
                <Card
                  key={business.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => rememberAndGo(business.id, `/app/pro/${business.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      rememberAndGo(business.id, `/app/pro/${business.id}`);
                    }
                  }}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4 transition hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <FaviconAvatar name={business.name} websiteUrl={business.websiteUrl} size={38} />
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-semibold text-[var(--text-primary)]">{business.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral" className="shrink-0">
                        {role}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          rememberAndGo(business.id, `/app/pro/${business.id}/settings`);
                        }}
                      >
                        Gérer
                      </Button>
                    </div>
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
      </section>

      {process.env.NODE_ENV !== 'production' ? (
        <Card className="mt-6 flex flex-col gap-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Mode dev</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Crée un compte admin local + business demo (admin@local.test / admintest).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={triggerDevSeed} disabled={seeding}>
              {seeding ? 'Seed en cours…' : 'Créer un compte admin de test'}
            </Button>
          </div>
          {seedMessage ? <p className="text-xs text-emerald-500">{seedMessage}</p> : null}
          {seedError ? <p className="text-xs text-rose-500">{seedError}</p> : null}
        </Card>
      ) : null}

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
          <Input
            label="Site web"
            value={draft.websiteUrl}
            onChange={(e) => setDraft((d) => ({ ...d, websiteUrl: e.target.value }))}
            placeholder="https://exemple.com"
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
        </>
      )}
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
