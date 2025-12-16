'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
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

type SummaryData = {
  totalBalanceCents: string;
  monthNetCents: string;
  accountsCount: number;
  latestCount: number;
};

type BusinessItem = { id: string; name: string };

export default function AppHomePage() {
  const router = useRouter();

  const [userName, setUserName] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [prospectCount, setProspectCount] = useState<number | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingProspects, setLoadingProspects] = useState(false);

  const [errorPersonal, setErrorPersonal] = useState<string | null>(null);
  const [errorPro, setErrorPro] = useState<string | null>(null);

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

        setSummary({
          totalBalanceCents,
          monthNetCents,
          accountsCount: accounts.length,
          latestCount: latest.length,
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

  useEffect(() => {
    if (!businesses.length) return;
    const ctrl = new AbortController();
    async function loadProspects() {
      setLoadingProspects(true);
      try {
        const firstBiz = businesses[0];
        const res = await fetch(
          `/api/pro/businesses/${encodeURIComponent(firstBiz.id)}/prospects`,
          { credentials: 'include', signal: ctrl.signal }
        );
        if (!res.ok) {
          const json = await safeJson(res);
          if (res.status === 401) router.push(`/login?from=${encodeURIComponent('/app')}`);
          else console.warn('prospects error', json);
          return;
        }
        const json = await safeJson(res);
        const items =
          isRecord(json) && Array.isArray((json as { items?: unknown }).items)
            ? (json as { items: unknown[] }).items
            : [];
        setProspectCount(items.length);
      } catch (e) {
        if (!ctrl.signal.aborted) console.warn('loadProspects', e);
      } finally {
        if (!ctrl.signal.aborted) setLoadingProspects(false);
      }
    }
    loadProspects();
    return () => ctrl.abort();
  }, [businesses, router]);

  const greeting = useMemo(() => {
    if (loadingAuth) return 'Chargement…';
    if (userName) return `Bonjour ${userName}`;
    return 'Bonjour';
  }, [loadingAuth, userName]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{greeting}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Accède rapidement aux espaces Perso et Pro.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Personnel
          </h2>
          {errorPersonal ? (
            <span className="text-xs text-rose-400">{errorPersonal}</span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <DashboardCard
            title="Portefeuille"
            href="/app/personal"
            loading={loadingSummary}
            stat={
              summary
                ? formatCents(summary.totalBalanceCents, 'EUR')
                : undefined
            }
            helper={
              summary
                ? `Variation 30 j : ${formatCents(summary.monthNetCents, 'EUR')}`
                : undefined
            }
            actionLabel="Voir Wallet"
          />
          <DashboardCard
            title="Comptes"
            href="/app/personal/comptes"
            loading={loadingSummary}
            stat={summary ? `${summary.accountsCount} compte(s)` : undefined}
            helper="Gère tes comptes et soldes."
            actionLabel="Ouvrir"
          />
          <DashboardCard
            title="Transactions"
            href="/app/personal/transactions"
            loading={loadingSummary}
            stat={
              summary
                ? `${summary.latestCount} transaction(s) récentes`
                : undefined
            }
            helper="Historique et ajouts rapides."
            actionLabel="Consulter"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Pro
          </h2>
          {errorPro ? <span className="text-xs text-rose-400">{errorPro}</span> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <DashboardCard
            title="Entreprises"
            href="/app/pro"
            loading={loadingBusinesses}
            stat={
              loadingBusinesses
                ? undefined
                : `${businesses.length} entreprise${businesses.length > 1 ? 's' : ''}`
            }
            helper="Espace Studio (Pro)."
            actionLabel="Ouvrir Studio"
          />
          {businesses[0] ? (
            <DashboardCard
              title="Prospects"
              href={`/app/pro/${businesses[0].id}/prospects`}
              loading={loadingProspects}
              stat={
                prospectCount != null
                  ? `${prospectCount} prospect${prospectCount > 1 ? 's' : ''}`
                  : undefined
              }
              helper="Suivi commercial."
              actionLabel="Voir prospects"
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
          Raccourcis
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <DashboardCard
            title="Importer un CSV"
            href="/app/personal/comptes"
            helper="Import des transactions."
            actionLabel="Ouvrir les comptes"
            compact
          />
          <DashboardCard
            title="Créer une transaction"
            href="/app/personal/transactions?create=1"
            helper="Ajout rapide."
            actionLabel="Ajouter"
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
