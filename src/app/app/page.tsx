'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { Wallet2, Building2, UserPlus, Upload, FolderPlus, Users } from 'lucide-react';

type AccountMini = { id: string; name: string; balanceCents: string; currency: string };

type SummaryData = {
  totalBalanceCents: string;
  monthNetCents: string;
  accountsCount: number;
  latestCount: number;
  accounts: AccountMini[];
};

type MeData = { user?: { name?: string } };
type SummaryResponse = {
  kpis?: { totalBalanceCents?: string; monthNetCents?: string };
  accounts?: Array<{ id?: string; name?: string; balanceCents?: string; currency?: string }>;
  latestTransactions?: unknown[];
};
type BusinessResponse = {
  items?: Array<{ business?: { id?: string; name?: string } }>;
};
type BusinessItem = { id: string; name: string };

export default function AppHomePage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [lastBusinessId, setLastBusinessId] = useState<string | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);

  const [errorPersonal, setErrorPersonal] = useState<string | null>(null);
  const [errorPro, setErrorPro] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('lastProBusinessId');
      if (stored) setLastBusinessId(stored);
    } catch {
      // ignore storage issues
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadMe() {
      setLoadingAuth(true);
      const res = await fetchJson<MeData>('/api/auth/me', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data?.user?.name) {
        const parts = res.data.user.name.trim().split(/\s+/);
        setUserName(parts[0] || ' ');
      }
      setLoadingAuth(false);
    }

    void loadMe();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadSummary() {
      setErrorPersonal(null);
      const res = await fetchJson<SummaryResponse>('/api/personal/summary', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setErrorPersonal(res.error ?? 'Impossible de charger le portefeuille.');
        return;
      }
      const d = res.data;
      if (!d?.kpis) {
        setErrorPersonal('Réponse inattendue.');
        return;
      }

      const accounts = Array.isArray(d.accounts) ? d.accounts : [];
      const latest = Array.isArray(d.latestTransactions) ? d.latestTransactions : [];

      const parsedAccounts: AccountMini[] = accounts
        .filter(
          (a): a is { id: string; name: string; balanceCents: string; currency: string } =>
            typeof a?.id === 'string' &&
            typeof a?.name === 'string' &&
            typeof a?.balanceCents === 'string' &&
            typeof a?.currency === 'string'
        );

      setSummary({
        totalBalanceCents: d.kpis.totalBalanceCents ?? '0',
        monthNetCents: d.kpis.monthNetCents ?? '0',
        accountsCount: accounts.length,
        latestCount: latest.length,
        accounts: parsedAccounts,
      });
    }

    void loadSummary();
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadBusinesses() {
      setLoadingBusinesses(true);
      setErrorPro(null);
      const res = await fetchJson<BusinessResponse>('/api/pro/businesses', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setErrorPro(res.error ?? 'Impossible de charger les entreprises.');
        setLoadingBusinesses(false);
        return;
      }
      const items = res.data?.items ?? [];
      const mapped: BusinessItem[] = items
        .filter(
          (it): it is { business: { id: string; name: string } } =>
            typeof it?.business?.id === 'string' && typeof it?.business?.name === 'string'
        )
        .map((it) => ({ id: it.business.id, name: it.business.name }));
      setBusinesses(mapped);
      setLoadingBusinesses(false);
    }

    void loadBusinesses();
    return () => ctrl.abort();
  }, []);

  const greeting = useMemo(() => {
    if (loadingAuth) return 'Chargement…';
    if (userName) return `Bonjour ${userName}`;
    return 'Bonjour';
  }, [loadingAuth, userName]);

  const lastBusiness = useMemo(() => {
    if (!businesses.length) return null;
    if (!lastBusinessId) return businesses[0];
    return businesses.find((b) => b.id === lastBusinessId) ?? businesses[0];
  }, [businesses, lastBusinessId]);

  const recentAccount = useMemo(() => {
    if (!summary?.accounts?.length) return null;
    return summary.accounts[0];
  }, [summary]);

  const disablePro = !lastBusiness;

  const monthNet = summary ? BigInt(summary.monthNetCents) : 0n;

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          title={greeting}
          subtitle="Tableau de bord personnel"
          actions={
            !lastBusiness ? (
              <Button asChild variant="outline">
                <Link href="/app/pro">Créer ou rejoindre une entreprise</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/app/pro/${lastBusiness.id}`}>Aller au Studio</Link>
              </Button>
            )
          }
        />

        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Solde total"
            value={summary ? formatCents(summary.totalBalanceCents, 'EUR') : '—'}
            hint="Tous comptes"
          />
          <KpiCard
            label="Net ce mois"
            value={summary ? formatCents(summary.monthNetCents, 'EUR') : '—'}
            trend={monthNet > 0n ? 'up' : monthNet < 0n ? 'down' : 'neutral'}
          />
          <KpiCard
            label="Comptes"
            value={summary?.accountsCount ?? '—'}
            hint="Comptes personnels"
          />
          <KpiCard
            label="Entreprises"
            value={loadingBusinesses ? '…' : businesses.length}
            hint="Espace Pro"
          />
        </div>

        {errorPersonal ? (
          <p className="text-sm text-[var(--danger)]">{errorPersonal}</p>
        ) : null}
        {errorPro ? (
          <p className="text-sm text-[var(--danger)]">{errorPro}</p>
        ) : null}

        {/* Espaces */}
        <section className="space-y-4">
          <SectionHeader title="Tes espaces" description="Accède rapidement à tes environnements." />
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="flex flex-col justify-between gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Wallet2 size={18} />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Wallet</span>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">Finances personnelles</p>
                <p className="text-xs text-[var(--text-secondary)]">Comptes, transactions, budgets, épargne.</p>
              </div>
              <Button asChild>
                <Link href="/app/personal">Ouvrir le Wallet</Link>
              </Button>
            </Card>

            <Card className="flex flex-col justify-between gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <Building2 size={18} />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Studio</span>
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">Pilotage entreprise</p>
                <p className="text-xs text-[var(--text-secondary)]">Clients, projets, tâches, finances.</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {loadingBusinesses
                    ? 'Chargement…'
                    : `${businesses.length} entreprise${businesses.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <Button asChild variant={lastBusiness ? 'primary' : 'outline'}>
                <Link href={lastBusiness ? `/app/pro/${lastBusiness.id}` : '/app/pro'}>
                  {lastBusiness ? 'Ouvrir le Studio' : 'Créer ou rejoindre'}
                </Link>
              </Button>
            </Card>
          </div>
        </section>

        {/* Actions rapides */}
        <section className="space-y-4">
          <SectionHeader title="Actions rapides" description="Accès immédiats" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              icon={<Upload size={16} />}
              title="Importer un CSV"
              href="/app/personal/transactions?import=1"
              helper="Transactions"
            />
            <QuickAction
              icon={<UserPlus size={16} />}
              title="Créer ou rejoindre"
              href="/app/pro"
              helper="Workspace"
            />
            <QuickAction
              icon={<FolderPlus size={16} />}
              title="Ajouter un produit"
              href={lastBusiness ? `/app/pro/${lastBusiness.id}/stock` : '#'}
              helper={disablePro ? 'Crée une entreprise' : 'Stock'}
              disabled={disablePro}
            />
            <QuickAction
              icon={<Users size={16} />}
              title="Ajouter un client"
              href={lastBusiness ? `/app/pro/${lastBusiness.id}/clients` : '#'}
              helper={disablePro ? 'Crée une entreprise' : 'Clients'}
              disabled={disablePro}
            />
          </div>
        </section>

        {/* Reprendre */}
        <section className="space-y-4">
          <SectionHeader title="Reprendre" description="Continue ce que tu as commencé" />
          <div className="grid gap-4 md:grid-cols-2">
            {lastBusiness ? (
              <Card className="flex h-full flex-col justify-between gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Pro
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)]">{lastBusiness.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">Dashboard et opérations.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/app/pro/${lastBusiness.id}`}>Dashboard</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/pro/${lastBusiness.id}/projects`}>Projets</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/pro/${lastBusiness.id}/services`}>Catalogue</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="border-dashed border-[var(--border)] bg-transparent p-5">
                <p className="text-sm font-semibold text-[var(--text)]">Aucune entreprise encore</p>
                <p className="text-xs text-[var(--text-secondary)]">Crée ou rejoins une entreprise pour débloquer le Studio.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/app/pro">Créer une entreprise</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/app/pro?join=1">Rejoindre</Link>
                  </Button>
                </div>
              </Card>
            )}

            {recentAccount ? (
              <Card className="flex h-full flex-col justify-between gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Perso
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)]">{recentAccount.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Solde : {formatCents(recentAccount.balanceCents, recentAccount.currency)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/personal/comptes/${recentAccount.id}`}>Vue compte</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href={`/app/personal/transactions?accountId=${recentAccount.id}`}>Transactions</Link>
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="border-dashed border-[var(--border)] bg-transparent p-5">
                <p className="text-sm font-semibold text-[var(--text)]">Aucun compte encore</p>
                <p className="text-xs text-[var(--text-secondary)]">Ajoute un compte pour suivre tes finances.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/app/personal/comptes?new=1">Ajouter un compte</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/app/personal/transactions?import=1">Importer un CSV</Link>
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

function QuickAction({
  icon,
  title,
  href,
  helper,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  href: string;
  helper?: string;
  disabled?: boolean;
}) {
  return (
    <Card
      className={`flex items-center justify-between gap-2 border-[var(--border)] ${
        disabled ? 'border-dashed opacity-70' : ''
      } bg-[var(--surface)] p-3`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-secondary)]">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
          {helper ? <p className="text-xs text-[var(--text-secondary)]">{helper}</p> : null}
        </div>
      </div>
      <Button asChild size="sm" variant={disabled ? 'outline' : 'primary'} disabled={disabled}>
        <Link href={href}>{disabled ? 'Indisponible' : 'Ouvrir'}</Link>
      </Button>
    </Card>
  );
}
