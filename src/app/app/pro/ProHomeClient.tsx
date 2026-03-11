// src/app/app/pro/ProHomeClient.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MoreVertical, ChevronRight, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { CreateBusinessWizard, defaultDraft, type CreateBusinessDraft } from './components/CreateBusinessWizard';
import { Modal } from '@/components/ui/modal';
import SwitchBusinessModal from './SwitchBusinessModal';
import { useToast } from '@/components/ui/toast';

/* ===================== TYPES ===================== */

type BusinessSummary = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  websiteUrl?: string | null;
};

type AuthMeResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    isActive: boolean;
  };
};

type BusinessesResponse = {
  items: {
    business: BusinessSummary;
    role: string;
  }[];
};

type DashboardResponse = {
  kpis?: { openTasksCount?: number; projectsActiveCount?: number };
  treasury?: { balanceCents?: string | number };
};

type BusinessKpis = {
  openTasksCount?: number;
  balanceCents?: string;
  projectsActiveCount?: number;
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

/* ===================== COMPONENT ===================== */

export default function ProHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<BusinessesResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const loadController = useRef<AbortController | null>(null);

  /* ---------- CREATE MODAL ---------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateBusinessDraft>(defaultDraft);

  /* ---------- JOIN MODAL ---------- */
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [businessKpis, setBusinessKpis] = useState<Record<string, BusinessKpis>>({});

  /* ---------- DATA ---------- */
  const items = useMemo(() => businesses?.items ?? [], [businesses]);

  const createValidation = useMemo(() => {
    const issues: string[] = [];
    if (!draft.name.trim()) issues.push("Le nom de l'entreprise est obligatoire.");
    if (!draft.countryCode.trim()) issues.push('Pays requis.');
    if (!draft.legalForm) issues.push('Forme juridique requise.');
    return { ok: issues.length === 0, issues };
  }, [draft]);

  /* ===================== OPEN MODALS FROM QUERY ===================== */
  const searchParamsKey = searchParams?.toString() ?? '';

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const create = params.get('create');
    const join = params.get('join');
    const tokenParam = params.get('token');

    if (create === '1') {
      setCreateOpen(true);
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

  /* ===================== AUTO-REDIRECT ===================== */
  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    if (params.get('create') === '1' || params.get('join') === '1') return;
    try {
      const stored = localStorage.getItem('activeProBusinessId');
      if (stored) {
        setRedirecting(true);
        router.replace(`/app/pro/${stored}`);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const message = bizRes.error || meRes.error || overviewRes.error || "Impossible de charger l'espace PRO.";
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
    const targets = businesses.items.filter((item) => !businessKpis[item.business.id]);
    if (!targets.length) return undefined;

    async function loadKpis() {
      await Promise.all(
        targets.map(async (item) => {
          const businessId = item.business.id;
          try {
            const res = await fetchJson<DashboardResponse>(
              `/api/pro/businesses/${businessId}/dashboard?days=30`,
              {},
              controller.signal
            );
            if (res.ok && res.data) {
              setBusinessKpis((prev) => ({
                ...prev,
                [businessId]: {
                  openTasksCount: res.data?.kpis?.openTasksCount ?? 0,
                  projectsActiveCount: res.data?.kpis?.projectsActiveCount ?? 0,
                  balanceCents: String(res.data?.treasury?.balanceCents ?? '0'),
                },
              }));
            }
          } catch { /* ignore */ }
        })
      );
    }

    void loadKpis();
    return () => controller.abort();
  }, [businessKpis, businesses]);

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

      const capitalCents = draft.capital ? Math.round(parseFloat(draft.capital) * 100) : undefined;

      const res = await fetchJson<BusinessInviteAcceptResponse>(
        '/api/pro/businesses',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.name.trim(),
            legalForm: draft.legalForm,
            activityType: draft.activityType,
            countryCode: draft.countryCode || 'FR',
            currency: draft.currency || 'EUR',
            taxRegime: draft.taxRegime || undefined,
            vatEnabled: draft.vatEnabled,
            vatRatePercent: Number(draft.vatRate) || 20,
            invoicePrefix: draft.invoicePrefix,
            quotePrefix: draft.quotePrefix,
            websiteUrl: draft.websiteUrl.trim() || undefined,
            legalName: draft.legalName.trim() || undefined,
            nafCode: draft.nafCode.trim() || undefined,
            nafLabel: draft.nafLabel.trim() || undefined,
            siret: draft.siret.trim() || undefined,
            vatNumber: draft.vatNumber.trim() || undefined,
            addressLine1: draft.addressLine1.trim() || undefined,
            addressLine2: draft.addressLine2.trim() || undefined,
            postalCode: draft.postalCode.trim() || undefined,
            city: draft.city.trim() || undefined,
            capital: capitalCents && capitalCents > 0 ? capitalCents : undefined,
          }),
        }
      );

      if (!res.ok || !res.data) {
        const ref = res.requestId;
        const msg = res.error ?? 'Erreur lors de la creation.';
        setCreationError(ref ? `${msg} (Ref: ${ref})` : msg);
        return;
      }

      await refreshBusinesses();

      toast.celebrate({ title: 'Entreprise créée !', subtitle: draft.name.trim() });
      setCreateOpen(false);
      setDraft(defaultDraft);
      rememberAndGo(res.data.business.id, `/app/pro/${res.data.business.id}`);
    } catch (err) {
      console.error(err);
      setCreationError('Erreur lors de la creation.');
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
    const businessCount = overview?.totals?.businessesCount ?? items.length;
    const projectsFromKpis = Object.values(businessKpis).reduce(
      (acc, curr) => acc + (typeof curr.projectsActiveCount === 'number' ? curr.projectsActiveCount : 0),
      0
    );
    const projectsFallback = overview?.totals?.projectsActiveCount ?? 0;
    const projectsActive = projectsFromKpis || projectsFallback;

    const totalNet = overview?.totals?.totalNetCents ?? '0';
    const solde = totalNet ? formatCurrency(totalNet) : '0 €';

    return { businessCount, projectsActive, solde };
  }, [overview, businessKpis, items.length]);

  /* ===================== UI ===================== */

  if (redirecting) {
    return (
      <PageContainer className="gap-5">
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement{'…'}</p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="gap-5">
      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        </Card>
      ) : error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">Espace PRO</p>
          <p className="text-sm text-[var(--danger)]/90">{error}</p>
        </Card>
      ) : (
        <>
          <PageHeader
            title="Entreprises"
            actions={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setJoinOpen(true)}>Rejoindre</Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <span className="hidden sm:inline">Creer un business</span>
                  <span className="sm:hidden">Creer</span>
                </Button>
              </div>
            }
          />

          {/* KPIs */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <KpiCard label="Entreprise" value={String(kpis.businessCount)} loading={false} delay={0} />
            <KpiCard label="Projets actifs" value={String(kpis.projectsActive)} loading={false} delay={50} />
            <KpiCard label="Solde" value={kpis.solde} loading={false} delay={100} />
          </div>

          {/* Business list */}
          <SectionHeader
            title="Entreprise"
          />

          {filteredItems.length === 0 ? (
            <EmptyState
              title="Aucune entreprise pour l'instant"
              description="Commencez par creer votre premiere entreprise ou rejoignez-en une."
              action={
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCreateOpen(true)}>Creer une entreprise</Button>
                  <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>Rejoindre</Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filteredItems.map(({ business }, index) => {
                const kpiData = businessKpis[business.id] ?? {};

                return (
                  <div
                    key={business.id}
                    className="flex flex-col justify-between rounded-xl p-3 animate-fade-in-up transition hover:-translate-y-1 hover:shadow-lg"
                    style={{
                      height: 200,
                      background: 'var(--shell-accent)',
                      animationDelay: `${150 + index * 80}ms`,
                      animationFillMode: 'backwards',
                    }}
                  >
                    {/* Top row: logo + name + menu */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <LogoAvatar name={business.name} websiteUrl={business.websiteUrl} size={32} className="!bg-black/30 !rounded-lg" />
                        <span className="text-sm font-medium text-white">{business.name}</span>
                      </div>
                      <BusinessCardMenu businessId={business.id} />
                    </div>

                    {/* KPIs + Ouvrir */}
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">Tâches</span>
                          <span className="text-xs font-extrabold text-white">
                            {typeof kpiData.openTasksCount === 'number' ? kpiData.openTasksCount : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">Trésorerie</span>
                          <span className="text-xs font-extrabold text-white">
                            {kpiData.balanceCents ? formatCurrency(kpiData.balanceCents) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">Projets actifs</span>
                          <span className="text-xs font-extrabold text-white">
                            {typeof kpiData.projectsActiveCount === 'number' ? kpiData.projectsActiveCount : '—'}
                          </span>
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-fit !bg-white !text-black !border-0"
                      >
                        <Link href={`/app/pro/${business.id}`}>
                          <span style={{ fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, fontSize: 16 }}>
                            Ouvrir
                          </span>
                          <ChevronRight size={14} />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* "+" card: create or join */}
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--border)] p-3 animate-fade-in-up transition hover:-translate-y-1 hover:shadow-lg"
                style={{
                  height: 200,
                  animationDelay: `${150 + filteredItems.length * 80}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <Plus size={32} className="text-[var(--text-secondary)]" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    Créer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setJoinOpen(true)}>
                    Rejoindre
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CREATE MODAL */}
      <CreateBusinessWizard
        open={createOpen}
        loading={creating}
        error={creationError}
        draft={draft}
        onChangeDraft={setDraft}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
        }}
        onSubmit={handleCreateBusiness}
      />

      {/* JOIN MODAL */}
      <Modal
        open={joinOpen}
        onCloseAction={() => (joining ? null : setJoinOpen(false))}
        title="Rejoindre une entreprise"
        description="Colle ici le token d'invitation recu par email."
      >
        <form onSubmit={handleJoinBusiness} className="space-y-4">
          <Input
            label="Token d'invitation"
            value={joinToken}
            onChange={(e) => setJoinToken(e.target.value)}
            error={joinError ?? undefined}
            placeholder="eyJhbGciOi..."
          />

          {joinSuccess ? <p className="text-xs text-[var(--success)]">{joinSuccess}</p> : null}

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
              {joining ? 'Verification…' : 'Rejoindre'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
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

/* ═══ Business Card Menu ═══ */

function BusinessCardMenu({ businessId }: { businessId: string }) {
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

  const menuItems = [
    { label: 'Projets', href: `/app/pro/${businessId}/projects` },
    { label: 'Clients', href: `/app/pro/${businessId}/clients` },
    { label: 'Finances', href: `/app/pro/${businessId}/finances` },
    { label: 'Membres', href: `/app/pro/${businessId}/team` },
    { label: 'Parametres', href: `/app/pro/${businessId}/settings` },
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
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-white transition hover:opacity-80"
      >
        <MoreVertical size={14} className="text-black" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-md"
        >
          {menuItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              role="menuitem"
              className="block cursor-pointer px-3 py-2 text-xs text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
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
