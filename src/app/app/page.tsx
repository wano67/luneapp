'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';

type ApiErrorShape = { error: string };

function isApiErrorShape(v: unknown): v is ApiErrorShape {
  return !!v && typeof v === 'object' && 'error' in v && typeof (v as { error?: unknown }).error === 'string';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur';
}

type AccountMini = { id: string; name: string; balanceCents: string; currency: string };

type SummaryData = {
  totalBalanceCents: string;
  monthNetCents: string;
  accountsCount: number;
  latestCount: number;
  accounts: AccountMini[];
};

type BusinessItem = { id: string; name: string };

export default function AppHomePage() {
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [lastBusinessId, setLastBusinessId] = useState<string | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
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
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', signal: ctrl.signal });
        if (res.status === 401) {
          router.push(`/login?from=${encodeURIComponent('/app')}`);
          return;
        }
        const json = await safeJson(res);
        if (res.ok && isRecord(json) && isRecord(json.user) && typeof json.user.name === 'string') {
          const parts = json.user.name.trim().split(/\s+/);
          setUserName(parts[0] || ' ');
        }
      } catch (e) {
        if (!ctrl.signal.aborted) console.error('loadMe', e);
      } finally {
        if (!ctrl.signal.aborted) setLoadingAuth(false);
      }
    }

    loadMe();
    return () => ctrl.abort();
  }, [router]);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadSummary() {
      setLoadingSummary(true);
      setErrorPersonal(null);
      try {
        const res = await fetch('/api/personal/summary', { credentials: 'include', signal: ctrl.signal });
        if (res.status === 401) {
          router.push(`/login?from=${encodeURIComponent('/app')}`);
          return;
        }
        const json = await safeJson(res);
        if (!res.ok) {
          setErrorPersonal(isApiErrorShape(json) ? json.error : 'Impossible de charger le portefeuille.');
          return;
        }
        if (!isRecord(json) || !isRecord(json.kpis)) {
          setErrorPersonal('Réponse inattendue.');
          return;
        }
        const kpis = json.kpis as Record<string, unknown>;
        const accounts = Array.isArray(json.accounts) ? json.accounts : [];
        const latest = Array.isArray(json.latestTransactions) ? json.latestTransactions : [];

        const totalBalanceCents =
          typeof kpis.totalBalanceCents === 'string' ? kpis.totalBalanceCents : '0';
        const monthNetCents = typeof kpis.monthNetCents === 'string' ? kpis.monthNetCents : '0';

        const parsedAccounts: AccountMini[] = accounts
          .map((a) => {
            if (!isRecord(a)) return null;
            if (
              typeof a.id !== 'string' ||
              typeof a.name !== 'string' ||
              typeof a.balanceCents !== 'string' ||
              typeof a.currency !== 'string'
            ) {
              return null;
            }
            return {
              id: a.id,
              name: a.name,
              balanceCents: a.balanceCents,
              currency: a.currency,
            };
          })
          .filter(Boolean) as AccountMini[];

        setSummary({
          totalBalanceCents,
          monthNetCents,
          accountsCount: accounts.length,
          latestCount: latest.length,
          accounts: parsedAccounts,
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setErrorPersonal(getErrorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoadingSummary(false);
      }
    }

    loadSummary();
    return () => ctrl.abort();
  }, [router]);

  useEffect(() => {
    const ctrl = new AbortController();

    async function loadBusinesses() {
      setLoadingBusinesses(true);
      setErrorPro(null);
      try {
        const res = await fetch('/api/pro/businesses', { credentials: 'include', signal: ctrl.signal });
        if (res.status === 401) {
          router.push(`/login?from=${encodeURIComponent('/app')}`);
          return;
        }
        const json = await safeJson(res);
        if (!res.ok) {
          setErrorPro(isApiErrorShape(json) ? json.error : 'Impossible de charger les entreprises.');
          return;
        }
        const items = isRecord(json) && Array.isArray((json as { items?: unknown }).items)
          ? (json as { items: unknown[] }).items
          : [];
        const mapped: BusinessItem[] = items
          .map((it) => {
            if (!isRecord(it) || !isRecord(it.business)) return null;
            const b = it.business;
            if (typeof b.id !== 'string' || typeof b.name !== 'string') return null;
            return { id: b.id, name: b.name };
          })
          .filter(Boolean) as BusinessItem[];
        setBusinesses(mapped);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setErrorPro(getErrorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoadingBusinesses(false);
      }
    }

    loadBusinesses();
    return () => ctrl.abort();
  }, [router]);

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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{greeting}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Choisis ton espace et reprends là où tu t’es arrêté.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Choisir ton espace
          </h2>
          <div className="flex gap-3">
            {errorPersonal ? <span className="text-xs text-rose-400">{errorPersonal}</span> : null}
            {errorPro ? <span className="text-xs text-rose-400">{errorPro}</span> : null}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DashboardCard
            title="Espace personnel"
            href="/app/personal"
            loading={loadingSummary}
            stat={summary ? formatCents(summary.totalBalanceCents, 'EUR') : undefined}
            helper={
              summary ? `Net 30j : ${formatCents(summary.monthNetCents, 'EUR')}` : 'Wallet et transactions'
            }
            actionLabel="Ouvrir le Wallet"
          />
          <DashboardCard
            title="Studio (Pro)"
            href="/app/pro"
            loading={loadingBusinesses}
            stat={
              loadingBusinesses
                ? undefined
                : `${businesses.length} entreprise${businesses.length > 1 ? 's' : ''}`
            }
            helper="Clients, projets, tâches, finances."
            actionLabel="Ouvrir le Studio"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Reprendre
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">Derniers contextes visités.</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {lastBusiness ? (
            <Card className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Pro
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{lastBusiness.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">Dashboard et opérations.</p>
              </div>
              <Button asChild className="mt-3">
                <Link href={`/app/pro/${lastBusiness.id}`}>Ouvrir le dashboard</Link>
              </Button>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-dashed border-[var(--border)] bg-transparent p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Aucune entreprise récente</p>
              <p className="text-xs text-[var(--text-secondary)]">Crée ou rejoins une entreprise pour commencer.</p>
            </Card>
          )}

          {recentAccount ? (
            <Card className="flex h-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Perso
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{recentAccount.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Solde : {formatCents(recentAccount.balanceCents, recentAccount.currency)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/personal/comptes/${recentAccount.id}`}>Vue compte</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/app/personal/transactions?accountId=${recentAccount.id}`}>
                    Transactions
                  </Link>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-dashed border-[var(--border)] bg-transparent p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Aucun compte encore</p>
              <p className="text-xs text-[var(--text-secondary)]">Ajoute un compte pour suivre tes finances.</p>
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Actions rapides
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <DashboardCard
            title="Importer un CSV"
            href="/app/personal/transactions?import=1"
            helper="Alimente tes transactions."
            actionLabel="Lancer l’import"
            compact
          />
          <DashboardCard
            title="Créer une entreprise"
            href="/app/pro?create=1"
            helper="En quelques clics."
            actionLabel="Créer"
            compact
          />
          <DashboardCard
            title="Rejoindre une entreprise"
            href="/app/pro?join=1"
            helper="Utilise un lien d’invitation."
            actionLabel="Rejoindre"
            compact
          />
        </div>
      </section>
    </div>
  );
}

type DashboardCardProps = {
  title: string;
  href: string;
  stat?: string;
  helper?: string;
  actionLabel: string;
  loading?: boolean;
  compact?: boolean;
};

function DashboardCard({ title, href, stat, helper, actionLabel, loading, compact }: DashboardCardProps) {
  return (
    <Link
      href={href}
      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
    >
      <Card
        className={[
          'h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 text-[var(--text-primary)] shadow-sm transition',
          'hover:border-[var(--border)] hover:bg-[var(--surface-hover)]/70 hover:shadow-lg hover:shadow-black/10',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            {helper ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{helper}</p> : null}
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] transition group-hover:border-[var(--accent)] group-hover:text-[var(--text-primary)]">
            {actionLabel}
          </span>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="h-6 w-24 animate-pulse rounded-full bg-[var(--background-alt)]" />
          ) : stat ? (
            <p className={compact ? 'text-lg font-semibold' : 'text-xl font-semibold'}>{stat}</p>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">—</p>
          )}
        </div>
      </Card>
    </Link>
  );
}
