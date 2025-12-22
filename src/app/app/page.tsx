'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCents } from '@/lib/money';
import { PageHeader } from './components/PageHeader';
import { ActionTile } from './components/ActionTile';
import { Wallet2, Building2, User, FileCode, Rocket } from 'lucide-react';

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
        // no-op
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

  const primaryCta = useMemo(() => {
    if (lastBusiness) {
      return { label: 'Aller au Studio', href: `/app/pro/${lastBusiness.id}` };
    }
    if (summary?.accountsCount) {
      return { label: 'Aller au Wallet', href: '/app/personal' };
    }
    return { label: 'Créer ou rejoindre une entreprise', href: '/app/pro' };
  }, [lastBusiness, summary]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-4">
      <PageHeader
        title="Accueil"
        subtitle={greeting}
        primaryAction={{ label: primaryCta.label, href: primaryCta.href }}
      />

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
          <ActionTile
            icon={<Wallet2 size={18} />}
            title="Espace personnel"
            description="Wallet, transactions, budgets."
            href="/app/personal"
            badge={summary ? formatCents(summary.totalBalanceCents, 'EUR') : undefined}
            helper={summary ? `Net 30j : ${formatCents(summary.monthNetCents, 'EUR')}` : undefined}
          />
          <ActionTile
            icon={<Building2 size={18} />}
            title="Studio (Pro)"
            description="Clients, projets, tâches, finances."
            href="/app/pro"
            badge={
              loadingBusinesses
                ? '—'
                : `${businesses.length} entreprise${businesses.length > 1 ? 's' : ''}`
            }
            helper={lastBusiness ? `Dernier : ${lastBusiness.name}` : undefined}
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Actions rapides
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">Sélectionne une destination.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionTile
            icon={<Wallet2 size={18} />}
            title="Importer un CSV"
            description="Alimente tes transactions"
            href="/app/personal/transactions?import=1"
          />
          <ActionTile
            icon={<Rocket size={18} />}
            title="Créer une entreprise"
            description="Démarre un nouveau workspace"
            href="/app/pro?create=1"
          />
          <ActionTile
            icon={<Building2 size={18} />}
            title="Rejoindre une entreprise"
            description="Via une invitation"
            href="/app/pro?join=1"
          />
          <ActionTile
            icon={<User size={18} />}
            title="Profil & Préférences"
            description="Compte et sécurité"
            href="/app/account"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Prochaines étapes
          </h2>
          <span className="text-xs text-[var(--text-secondary)]">Guides rapides</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {businesses.length === 0 ? (
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Pas encore de business</p>
              <p className="text-xs text-[var(--text-secondary)]">Crée ou rejoins pour débloquer le Studio.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/app/pro?create=1">Créer une entreprise</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/pro?join=1">Rejoindre</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Pour {lastBusiness?.name ?? 'le Studio'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href={`/app/pro/${lastBusiness?.id ?? businesses[0].id}`}>Ouvrir le dashboard</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${lastBusiness?.id ?? businesses[0].id}/clients`}>Créer un client</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${lastBusiness?.id ?? businesses[0].id}/projects`}>Créer un devis/facture</Link>
                </Button>
              </div>
            </Card>
          )}
          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Documentation & API</p>
            <p className="text-xs text-[var(--text-secondary)]">Consulte les endpoints publics et tests rapides.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/openapi.yaml">OpenAPI</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/api-docs.html">Swagger UI</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/app/docs">
                  <div className="flex items-center gap-1">
                    <FileCode size={14} /> Docs produit
                  </div>
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
