// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import SwitchBusinessModal from './SwitchBusinessModal';
import { PageHeader } from '../components/PageHeader';
import { ArrowRight } from 'lucide-react';
import { LogoAvatar } from '@/components/pro/LogoAvatar';

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

type ProjectsResponse = {
  items?: Array<{ id: string; status: string }>;
};

type MembersResponse = {
  items?: Array<{ userId: string }>;
};

type ClientsResponse = {
  items?: Array<{ id: string }>;
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
  activityType: 'service' | 'product' | 'mixte';
  country: string;
};

/* ===================== COMPONENT ===================== */

export default function ProHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const loadController = useRef<AbortController | null>(null);

  /* ---------- CREATE MODAL ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const [draft, setDraft] = useState<CreateBusinessDraft>({
    name: '',
    websiteUrl: '',
    activityType: 'service',
    country: '',
  });

  /* ---------- JOIN MODAL ---------- */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [businessStats, setBusinessStats] = useState<
    Record<string, { projectsTotal?: number; projectsInProgress?: number; members?: number; clients?: number }>
  >({});

  /* ---------- DATA ---------- */
  const items = useMemo(() => businesses?.items ?? [], [businesses]);

  const createValidation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.name.trim()) issues.push("Le nom de l'entreprise est obligatoire.");
    if (!draft.country.trim()) issues.push('Pays requis.');
  return { ok: issues.length === 0, issues };
  }, [draft]);

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

  useEffect(() => {
    if (!businesses?.items?.length) return;
    const controller = new AbortController();
    const targets = businesses.items.filter((item) => !businessStats[item.business.id]);
    if (!targets.length) return undefined;

    async function loadStats() {
      await Promise.all(
        targets.map(async (item) => {
          const businessId = item.business.id;
          const next: {
            projectsTotal?: number;
            projectsInProgress?: number;
            members?: number;
            clients?: number;
          } = {};
          try {
            const res = await fetchJson<ProjectsResponse>(
              `/api/pro/businesses/${businessId}/projects?archived=false`,
              {},
              controller.signal
            );
            if (res.ok && res.data?.items) {
              next.projectsTotal = res.data.items.length;
              next.projectsInProgress = res.data.items.filter((p) => p.status === 'IN_PROGRESS').length;
            }
          } catch {
            // ignore
          }

          try {
            const res = await fetchJson<MembersResponse>(
              `/api/pro/businesses/${businessId}/members`,
              {},
              controller.signal
            );
            if (res.ok && res.data?.items) {
              next.members = res.data.items.length;
            }
          } catch {
            // ignore (non admin or network)
          }

          try {
            const res = await fetchJson<ClientsResponse>(
              `/api/pro/businesses/${businessId}/clients`,
              {},
              controller.signal
            );
            if (res.ok && res.data?.items) {
              next.clients = res.data.items.length;
            }
          } catch {
            // ignore
          }

          setBusinessStats((prev) => ({ ...prev, [businessId]: { ...prev[businessId], ...next } }));
        })
      );
    }

    void loadStats();
    return () => controller.abort();
  }, [businessStats, businesses]);

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
        activityType: 'service',
        country: '',
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

  const formatCurrency = (cents: string | number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
      Number(cents) / 100
    );

  const filteredItems = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(b.business.createdAt).getTime() - new Date(a.business.createdAt).getTime()
    );
  }, [items]);

  const kpis = useMemo(() => {
    const entries: Array<{ label: string; value: string }> = [];
    if (typeof overview?.totals?.businessesCount === 'number') {
      entries.push({ label: 'Entreprises', value: String(overview.totals.businessesCount) });
    }
    const projectsFromStats = Object.values(businessStats).reduce(
      (acc, curr) => acc + (typeof curr.projectsInProgress === 'number' ? curr.projectsInProgress : 0),
      0
    );
    const projectsFallback =
      typeof overview?.totals?.projectsActiveCount === 'number' ? overview.totals.projectsActiveCount : 0;
    entries.push({ label: 'Projets', value: String(projectsFromStats || projectsFallback) });

    // TODO: connecter au solde réel si/ quand dispo via API finances
    const totalNet =
      typeof overview?.totals?.totalNetCents === 'number'
        ? overview.totals.totalNetCents
        : overview?.totals?.totalNetCents || 0;
    entries.push({ label: 'Solde', value: totalNet ? formatCurrency(totalNet) : '0 €' });
    return entries;
  }, [overview, businessStats]);

  const businessBuckets = useMemo(() => {
    const keywords = ['shop', 'store', 'boutique', 'commerce', 'market', 'vente'];
    function inferBucket(business: BusinessSummary): 'product' | 'service' {
      const haystack = `${business.name} ${business.websiteUrl ?? ''}`.toLowerCase();
      return keywords.some((k) => haystack.includes(k)) ? 'product' : 'service';
    }
    return filteredItems.map(({ business, role }) => {
      const bucket: 'product' | 'service' = inferBucket(business);
      const domain = business.websiteUrl?.replace(/^https?:\/\//, '') ?? '';
      return {
        business,
        role,
        bucket,
        domain,
      };
    });
  }, [filteredItems]);

  const serviceBusinesses = businessBuckets.filter((b) => b.bucket === 'service');
  const productBusinesses = businessBuckets.filter((b) => b.bucket === 'product');

  const tabKind = useMemo(() => {
    const urlKind = searchParams?.get('kind');
    if (urlKind === 'product') return 'product';
    return 'service';
  }, [searchParams]);

  function setTab(kind: 'service' | 'product') {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('kind', kind);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function renderBusinessGrid(
    list: Array<{ business: BusinessSummary; role: string; bucket: 'service' | 'product' }>
  ) {
    if (!list.length) {
      return (
        <Card className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Aucune entreprise pour l’instant.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)} className="cursor-pointer">
              Créer une entreprise
            </Button>
            <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)} className="cursor-pointer">
              Rejoindre
            </Button>
          </div>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map(({ business, role }) => {
          const stats = businessStats[business.id] ?? {};
          const projectsTotal = typeof stats.projectsTotal === 'number' ? stats.projectsTotal : 0;
          const projectsInProgress = typeof stats.projectsInProgress === 'number' ? stats.projectsInProgress : 0;
          const members = typeof stats.members === 'number' ? stats.members : 0;
          const clients = typeof stats.clients === 'number' ? stats.clients : 0;

          return (
          <Link
            key={business.id}
            href={`/app/pro/${business.id}`}
            className="group relative card-interactive flex min-h-[160px] flex-col gap-3 rounded-3xl border border-[var(--border)]/50 bg-[var(--surface)] p-4 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label={`Entrer dans ${business.name}`}
          >
            <div className="flex items-start gap-3">
              <LogoAvatar name={business.name} websiteUrl={business.websiteUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                  {business.name}
                </p>
                {role ? (
                  <span className="mt-1 inline-flex items-center rounded-full bg-[var(--surface-hover)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    {role}
                  </span>
                ) : null}
              </div>
              <ActionMenu businessId={business.id} />
            </div>

            <div className="space-y-1 text-[12px] text-[var(--text-secondary)]">
              <div className="grid grid-cols-2 gap-x-6 rounded-xl px-2 py-1">
                <div className="flex items-center justify-between">
                  <span>Projets</span>
                  <span className="font-semibold text-[var(--text-primary)]">{projectsTotal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>En cours</span>
                  <span className="font-semibold text-[var(--text-primary)]">{projectsInProgress}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 rounded-xl px-2 py-1">
                <div className="flex items-center justify-between">
                  <span>Membres</span>
                  <span className="font-semibold text-[var(--text-primary)]">{members}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Clients</span>
                  <span className="font-semibold text-[var(--text-primary)]">{clients}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto flex justify-end">
              <span className="flex h-9 w-9 cursor-pointer items-center justify-center text-sm font-semibold text-[var(--text-primary)] transition group-hover:translate-x-1 group-hover:text-[var(--text-primary)]">
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </div>
          </Link>
        );
        })}
      </div>
    );
  }

  /* ===================== UI ===================== */

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
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
            title="Studio"
            subtitle="Vos entreprises et leur activité."
            primaryAction={{ label: 'Créer un business', onClick: () => setCreateOpen(true) }}
            secondaryAction={{ label: 'Rejoindre', onClick: () => setJoinOpen(true), variant: 'ghost' }}
          />

          {kpis.length ? (
            <div className="rounded-3xl bg-[var(--surface)]/70 p-5">
              <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-3">
                {kpis.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-[126px] w-[126px] flex-col items-center justify-center rounded-full bg-[var(--surface)]/90 text-center shadow-[0_0_0_1px_var(--border)] sm:h-[136px] sm:w-[136px]"
                  >
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{item.value}</span>
                    <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${tabKind === 'service' ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                onClick={() => setTab('service')}
                aria-pressed={tabKind === 'service'}
              >
                Services
              </button>
              <button
                type="button"
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${tabKind === 'product' ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}
                onClick={() => setTab('product')}
                aria-pressed={tabKind === 'product'}
              >
                Produits
              </button>
            </div>

            {tabKind === 'service' ? renderBusinessGrid(serviceBusinesses) : renderBusinessGrid(productBusinesses)}
          </section>

      {/* CREATE MODAL */}
      <Modal
        open={createOpen}
        onCloseAction={() => (creating ? null : setCreateOpen(false))}
        title="Créer une entreprise"
        description="Formulaire minimal pour démarrer immédiatement."
      >
        <form onSubmit={handleCreateBusiness} className="space-y-4">
          <Input
            label="Nom de l’entreprise *"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            error={creationError ?? undefined}
            placeholder="Ex: StudioFief"
          />
          <label className="space-y-1 text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Type d’activité *</span>
            <select
              value={draft.activityType}
              onChange={(e) =>
                setDraft((d) => ({ ...d, activityType: e.target.value as CreateBusinessDraft['activityType'] }))
              }
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              required
            >
              <option value="service">Service</option>
              <option value="product">Produit</option>
              <option value="mixte">Mixte</option>
            </select>
          </label>
          <Input
            label="Pays *"
            value={draft.country}
            onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
            placeholder="France"
            required
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

type ActionMenuProps = { businessId: string };

function ActionMenu({ businessId }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const items = [
    { label: 'Projets', href: `/app/pro/${businessId}/projects` },
    { label: 'Clients', href: `/app/pro/${businessId}/clients` },
    { label: 'Finances', href: `/app/pro/${businessId}/finances` },
    { label: 'Membres', href: `/app/pro/${businessId}/settings/team` },
    { label: 'Paramètres', href: `/app/pro/${businessId}/settings` },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-[var(--text-secondary)] opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        ⋮
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md"
        >
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              role="menuitem"
              className="block cursor-pointer px-3 py-2 text-xs text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
