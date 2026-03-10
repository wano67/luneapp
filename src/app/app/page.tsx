'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, UserPlus } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import {
  IconPerso,
  IconEntreprise,
  IconTransaction,
  IconBankAccount,
  IconOperation,
  IconFinance,
} from '@/components/pivot-icons';
import { fmtKpi } from '@/lib/format';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

/* ═══ Types ═══ */

type AccountMini = { id: string; name: string; balanceCents: string; currency: string };

type SummaryResponse = {
  kpis?: {
    totalBalanceCents?: string;
    monthNetCents?: string;
    monthIncomeCents?: string;
    monthExpenseCents?: string;
    savingsCapacityCents?: string;
    fixedChargesMonthlyCents?: string;
  };
  accounts?: Array<{ id?: string; name?: string; balanceCents?: string; currency?: string }>;
  latestTransactions?: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    label: string;
    account: { id: string; name: string };
  }>;
};

type BusinessResponse = {
  items?: Array<{ business?: { id?: string; name?: string } }>;
};
type BusinessItem = { id: string; name: string };

type BizDashboard = {
  kpis?: {
    projectsActiveCount?: number;
    openTasksCount?: number;
    mtdIncomeCents?: string;
  };
  treasury?: { balanceCents?: string };
  billing?: { pendingCollectionCents?: string };
  clientsCount?: number;
  projects?: { activeCount?: number; completedCount?: number };
};

type PendingInvite = {
  id: string;
  businessName: string;
  businessId: string;
  role: string;
  token: string;
};

const INVITE_ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};

/* ═══ Page ═══ */

export default function AppHomePage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalBalanceCents: string;
    monthNetCents: string;
    savingsCapacityCents: string;
    fixedChargesMonthlyCents: string;
    accountsCount: number;
    accounts: AccountMini[];
    transactions: SummaryResponse['latestTransactions'];
  } | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [bizDash, setBizDash] = useState<BizDashboard | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const lastBusiness = useMemo(() => {
    if (!businesses.length) return null;
    try {
      const stored = localStorage.getItem('lastProBusinessId');
      if (stored) {
        const found = businesses.find((b) => b.id === stored);
        if (found) return found;
      }
    } catch { /* ignore */ }
    return businesses[0];
  }, [businesses]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [meRes, sumRes, bizRes, invRes] = await Promise.all([
        fetchJson<{ user?: { name?: string } }>('/api/auth/me', {}, ctrl.signal),
        fetchJson<SummaryResponse>('/api/personal/summary', {}, ctrl.signal),
        fetchJson<BusinessResponse>('/api/pro/businesses', {}, ctrl.signal),
        fetchJson<{ items?: PendingInvite[] }>('/api/personal/pending-invites', {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;

      if (meRes.ok && meRes.data?.user?.name) {
        const parts = meRes.data.user.name.trim().split(/\s+/);
        setUserName(parts[0] || null);
      }

      if (sumRes.ok && sumRes.data?.kpis) {
        const d = sumRes.data;
        const kpis = d.kpis!;
        const accounts = (d.accounts ?? []).filter(
          (a): a is AccountMini =>
            typeof a?.id === 'string' && typeof a?.name === 'string' &&
            typeof a?.balanceCents === 'string' && typeof a?.currency === 'string'
        );
        setSummary({
          totalBalanceCents: kpis.totalBalanceCents ?? '0',
          monthNetCents: kpis.monthNetCents ?? '0',
          savingsCapacityCents: kpis.savingsCapacityCents ?? '0',
          fixedChargesMonthlyCents: kpis.fixedChargesMonthlyCents ?? '0',
          accountsCount: accounts.length,
          accounts,
          transactions: d.latestTransactions ?? [],
        });
      }

      let bizList: BusinessItem[] = [];
      if (bizRes.ok) {
        bizList = (bizRes.data?.items ?? [])
          .filter((it): it is { business: { id: string; name: string } } =>
            typeof it?.business?.id === 'string' && typeof it?.business?.name === 'string'
          )
          .map((it) => ({ id: it.business.id, name: it.business.name }));
        setBusinesses(bizList);
      }

      if (invRes.ok && invRes.data?.items) {
        setPendingInvites(invRes.data.items);
      }

      setLoading(false);

      // Fetch business dashboard (conditional, non-blocking)
      if (bizList.length > 0) {
        let targetId = bizList[0].id;
        try {
          const stored = localStorage.getItem('lastProBusinessId');
          if (stored && bizList.some((b) => b.id === stored)) targetId = stored;
        } catch { /* ignore */ }

        const dashRes = await fetchJson<BizDashboard>(
          `/api/pro/businesses/${targetId}/dashboard?days=0`, {}, ctrl.signal
        );
        if (!ctrl.signal.aborted && dashRes.ok && dashRes.data) {
          setBizDash(dashRes.data);
        }
      }
    })();
    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptInvite(token: string, inviteId: string) {
    setAcceptingId(inviteId);
    try {
      const res = await fetchJson<{ business?: { id: string | bigint } }>(
        '/api/pro/businesses/invites/accept',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) },
      );
      if (res.ok && res.data?.business?.id) {
        router.push(`/app/pro/${res.data.business.id}`);
      } else {
        setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch {
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } finally {
      setAcceptingId(null);
    }
  }

  const greeting = loading ? 'Chargement\u2026' : userName ? `Bonjour ${userName}` : 'Bonjour';
  const netCents = summary ? BigInt(summary.monthNetCents) : 0n;
  const netPositive = netCents >= 0n;

  return (
    <PageContainer className="gap-6">
      <PageHeader title={greeting} subtitle="Voici votre tableau de bord" />

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="space-y-2">
          {pendingInvites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-[var(--accent-strong)]/30 bg-[var(--accent-strong)]/5 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserPlus size={18} className="shrink-0" style={{ color: 'var(--accent-strong)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">
                    Invitation a rejoindre {inv.businessName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Role : {INVITE_ROLE_LABELS[inv.role] ?? inv.role}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => void acceptInvite(inv.token, inv.id)}
                disabled={acceptingId === inv.id}
              >
                {acceptingId === inv.id ? 'Acceptation\u2026' : 'Accepter'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards — clickable */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ClickableKpi
          href="/app/personal"
          label="Solde total"
          value={fmtKpi(summary?.totalBalanceCents)}
          sub={`${summary?.accountsCount ?? 0} compte${(summary?.accountsCount ?? 0) !== 1 ? 's' : ''}`}
          loading={loading}
          delay={0}
        />
        <ClickableKpi
          href="/app/personal/transactions"
          label="Net ce mois"
          value={fmtKpi(summary?.monthNetCents)}
          sub={netPositive ? 'En hausse' : 'En baisse'}
          trend={netPositive ? 'up' : 'down'}
          loading={loading}
          delay={50}
        />
        <ClickableKpi
          href="/app/personal/epargne"
          label="Capacite d'\u00e9pargne"
          value={summary ? `${fmtKpi(summary.savingsCapacityCents)}/mois` : '\u2014'}
          sub="Estimation mensuelle"
          loading={loading}
          delay={100}
        />
        <ClickableKpi
          href={lastBusiness ? `/app/pro/${lastBusiness.id}` : '/app/pro'}
          label="Entreprise"
          value={bizDash?.kpis?.openTasksCount != null ? `${bizDash.kpis.openTasksCount} taches` : `${businesses.length} biz`}
          sub={bizDash?.kpis?.projectsActiveCount != null ? `${bizDash.kpis.projectsActiveCount} projets actifs` : undefined}
          loading={loading}
          delay={150}
        />
      </div>

      {/* Space cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Wallet card — accent background */}
        <Link
          href="/app/personal"
          className="flex flex-col justify-between rounded-2xl p-5 transition hover:opacity-95 animate-fade-in-up"
          style={{
            minHeight: 180,
            background: 'var(--shell-accent)',
            animationDelay: '200ms',
            animationFillMode: 'backwards',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <IconPerso size={20} color="white" />
              </div>
              <span className="text-white font-semibold">Wallet</span>
            </div>
            <ChevronRight size={18} className="text-white/60" />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            {loading ? (
              <div className="h-8 w-32 rounded-lg animate-skeleton-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />
            ) : (
              <>
                <span className="text-white text-2xl font-extrabold">{fmtKpi(summary?.totalBalanceCents)}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/70 text-xs">
                  <span>Epargne : {fmtKpi(summary?.savingsCapacityCents)}/mois</span>
                  <span>Charges fixes : {fmtKpi(summary?.fixedChargesMonthlyCents)}/mois</span>
                </div>
              </>
            )}
          </div>
        </Link>

        {/* Business card — dark background */}
        <Link
          href={lastBusiness ? `/app/pro/${lastBusiness.id}` : '/app/pro'}
          className="flex flex-col justify-between rounded-2xl p-5 transition hover:opacity-95 animate-fade-in-up"
          style={{
            minHeight: 180,
            background: 'var(--shell-accent-dark)',
            animationDelay: '250ms',
            animationFillMode: 'backwards',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <IconEntreprise size={20} color="white" />
              </div>
              <span className="text-white font-semibold">{lastBusiness?.name ?? 'Mon entreprise'}</span>
            </div>
            <ChevronRight size={18} className="text-white/60" />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            {loading ? (
              <div className="h-8 w-32 rounded-lg animate-skeleton-pulse" style={{ background: 'rgba(255,255,255,0.15)' }} />
            ) : businesses.length === 0 ? (
              <span className="text-white/80 text-sm">Creez votre premiere entreprise</span>
            ) : bizDash ? (
              <>
                <span className="text-white text-2xl font-extrabold">
                  {fmtKpi(bizDash.treasury?.balanceCents ?? '0')}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-white/70 text-xs">
                  <span>{bizDash.kpis?.openTasksCount ?? 0} taches en cours</span>
                  <span>{bizDash.kpis?.projectsActiveCount ?? 0} projets actifs</span>
                  {bizDash.billing?.pendingCollectionCents && BigInt(bizDash.billing.pendingCollectionCents) > 0n && (
                    <span>{fmtKpi(bizDash.billing.pendingCollectionCents)} a encaisser</span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-white text-lg font-bold">
                {businesses.length} entreprise{businesses.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Acces rapide" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            href="/app/personal/transactions"
            icon={<IconTransaction size={20} color="var(--shell-accent)" />}
            label="Transactions"
            delay={300}
          />
          <QuickAction
            href="/app/personal/comptes"
            icon={<IconBankAccount size={20} color="var(--shell-accent)" />}
            label="Comptes"
            delay={350}
          />
          {lastBusiness && (
            <QuickAction
              href={`/app/pro/${lastBusiness.id}/tasks`}
              icon={<IconOperation size={20} color="var(--shell-accent)" />}
              label="Taches"
              delay={400}
            />
          )}
          {lastBusiness && (
            <QuickAction
              href={`/app/pro/${lastBusiness.id}/finances`}
              icon={<IconFinance size={20} color="var(--shell-accent)" />}
              label="Facturation"
              delay={450}
            />
          )}
        </div>
      </div>

      {/* Latest transactions */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Dernieres transactions"
          actions={
            <Link href="/app/personal/transactions" className="text-xs font-semibold hover:underline" style={{ color: 'var(--shell-accent)' }}>
              Tout voir
            </Link>
          }
        />

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {loading ? (
            <EmptyState title="Chargement\u2026" />
          ) : !summary?.transactions?.length ? (
            <EmptyState title="Aucune transaction" />
          ) : (
            summary.transactions.slice(0, 6).map((tx, i) => {
              const amt = BigInt(tx.amountCents);
              const isPositive = amt >= 0n;
              return (
                <div
                  key={tx.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                  style={{
                    background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{tx.label || '\u2014'}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {tx.account.name} · {new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span
                    className="text-sm font-semibold shrink-0"
                    style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {isPositive ? '+' : ''}{fmtKpi(tx.amountCents)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/* ═══ ClickableKpi — KPI card that navigates ═══ */

function ClickableKpi({
  href,
  label,
  value,
  sub,
  trend,
  loading,
  delay = 0,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down';
  loading?: boolean;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col justify-between rounded-xl p-4 transition hover:shadow-md animate-fade-in-up"
      style={{
        minHeight: 120,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-faint)]">{label}</span>
        <ChevronRight size={14} className="text-[var(--text-faint)]" />
      </div>
      {loading ? (
        <div className="h-7 w-24 rounded-lg animate-skeleton-pulse mt-2" style={{ background: 'var(--surface-2)' }} />
      ) : (
        <div className="flex flex-col gap-0.5 mt-2">
          <span className="text-lg font-extrabold text-[var(--text)] leading-tight">{value}</span>
          {sub && (
            <span className="text-[11px] font-medium" style={{
              color: trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--text-faint)',
            }}>
              {trend === 'up' ? '\u25B2 ' : trend === 'down' ? '\u25BC ' : ''}{sub}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

/* ═══ QuickAction — shortcut button ═══ */

function QuickAction({
  href,
  icon,
  label,
  delay = 0,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl p-3 transition hover:shadow-sm animate-fade-in-up"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div
        className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--shell-accent)', opacity: 0.15 }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium text-[var(--text)]">{label}</span>
    </Link>
  );
}
