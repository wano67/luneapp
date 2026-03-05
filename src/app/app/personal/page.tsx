'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChartNoAxesColumnIncreasing, ChartNoAxesColumnDecreasing, Landmark, ArrowRight } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { onWalletRefresh } from '@/lib/personalEvents';
import { fmtKpi } from '@/lib/format';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { BANK_MAP } from '@/config/banks';
import { FaviconAvatar } from '@/app/app/components/FaviconAvatar';
import { PageContainer } from '@/components/layouts/PageContainer';
import { Alert } from '@/components/ui/alert';

/* ═══ Types ═══ */

type SummaryResponse = {
  kpis: {
    totalBalanceCents: string;
    monthIncomeCents: string;
    monthExpenseCents: string;
    monthNetCents: string;
    prevIncomeCents: string;
    prevExpenseCents: string;
    savingsCapacityCents: string;
    fixedChargesMonthlyCents: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    institution: string | null;
    bankCode: string | null;
    balanceCents: string;
  }>;
  latestTransactions: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    currency: string;
    label: string;
    note?: string | null;
    account: { id: string; name: string };
    category: { id: string; name: string } | null;
  }>;
};

type Budget = {
  id: string;
  name: string;
  period: 'MONTHLY' | 'YEARLY';
  limitCents: string;
  spentCents: string;
  category: { id: string; name: string } | null;
};

/* ═══ Constants ═══ */

const PERIODS = [
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: '1 an', days: 365 },
] as const;

/* ═══ Helpers ═══ */

/** Liquidity order: most accessible → least accessible */
const ACCOUNT_TYPE_ORDER: Record<string, number> = { CASH: 0, CURRENT: 1, SAVINGS: 2, INVEST: 3 };
const ACCOUNT_TYPE_LABEL: Record<string, string> = { CASH: 'Espèces', CURRENT: 'Courant', SAVINGS: 'Épargne', INVEST: 'Investissement' };

function absBigInt(v: bigint) {
  return v < 0n ? -v : v;
}

/* ═══ Page ═══ */

export default function WalletHomePage() {
  const { prefs } = useUserPreferences();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [periodOverride, setPeriodOverride] = useState<number | null>(null);
  const periodDays = periodOverride ?? prefs.dashboardPeriodDays;

  const load = useCallback(async (days: number) => {
    setLoading(true);
    const [summaryRes, budgetRes] = await Promise.all([
      fetchJson<SummaryResponse>(`/api/personal/summary?days=${days}`),
      fetchJson<{ items: Budget[] }>('/api/personal/budgets'),
    ]);
    if (summaryRes.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!summaryRes.ok || !summaryRes.data) {
      setError(summaryRes.error ?? 'Impossible de charger le Wallet.');
    } else {
      setData(summaryRes.data);
      setError(null);
    }
    if (budgetRes.ok && budgetRes.data) setBudgets(budgetRes.data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(periodDays); }, [load, periodDays]);
  useEffect(() => onWalletRefresh(() => { void load(periodDays); }), [load, periodDays]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(periodDays);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load, periodDays]);
  useEffect(() => {
    const fn = () => { if (document.visibilityState === 'visible') void load(periodDays); };
    window.addEventListener('focus', fn);
    document.addEventListener('visibilitychange', fn);
    return () => { window.removeEventListener('focus', fn); document.removeEventListener('visibilitychange', fn); };
  }, [load, periodDays]);

  /* ═══ Computed ═══ */

  const kpi = useMemo(() => {
    if (!data?.kpis) return null;
    const totalBalance = BigInt(data.kpis.totalBalanceCents ?? '0');
    const periodNet = BigInt(data.kpis.monthNetCents ?? '0');
    const prevTotalBalance = totalBalance - periodNet;

    const income = absBigInt(BigInt(data.kpis.monthIncomeCents ?? '0'));
    const expense = absBigInt(BigInt(data.kpis.monthExpenseCents ?? '0'));
    const capacity = BigInt(data.kpis.savingsCapacityCents ?? '0');
    const prevIncome = absBigInt(BigInt(data.kpis.prevIncomeCents ?? '0'));
    const prevExpense = absBigInt(BigInt(data.kpis.prevExpenseCents ?? '0'));

    function pctChange(cur: bigint, prev: bigint): number | null {
      if (prev === 0n && cur === 0n) return null;
      if (prev === 0n) return cur > 0n ? 100 : -100;
      const raw = Number(((cur - prev) * 100n) / absBigInt(prev));
      return Math.max(-999, Math.min(999, raw));
    }
    const sign = (v: bigint) => (v > 0n ? '+' : '');
    const fmtDelta = (diff: bigint) => sign(diff) + fmtKpi(diff.toString());

    // Trésorerie: current total balance vs balance at start of period
    const treasuryPctVal = pctChange(totalBalance, prevTotalBalance);
    // Charges: period expenses vs previous period expenses
    const expensePctVal = pctChange(expense, prevExpense);
    // Revenus: period income vs previous period income
    const incomePctVal = pctChange(income, prevIncome);

    const expenseDiff = expense - prevExpense;
    const incomeDiff = income - prevIncome;

    return {
      total: fmtKpi(totalBalance.toString()),
      income: fmtKpi(income.toString()),
      expense: fmtKpi(expense.toString()),
      fixedCharges: fmtKpi(data.kpis.fixedChargesMonthlyCents),
      savingsCapacity: fmtKpi(data.kpis.savingsCapacityCents),
      savingsCapacityPositive: capacity >= 0n,
      treasuryPct: treasuryPctVal,
      treasuryDelta: fmtDelta(periodNet),
      treasuryPositive: treasuryPctVal != null ? treasuryPctVal >= 0 : periodNet >= 0n,
      expensePct: expensePctVal,
      expenseDelta: fmtDelta(expenseDiff),
      chargesPositive: expenseDiff <= 0n,
      incomePct: incomePctVal,
      incomeDelta: fmtDelta(incomeDiff),
      revenusPositive: incomeDiff >= 0n,
    };
  }, [data]);

  const budgetSummary = useMemo(() => {
    if (!budgets.length) return null;
    const totalLimit = budgets.reduce((s, b) => s + BigInt(b.limitCents), 0n);
    const totalSpent = budgets.reduce((s, b) => s + absBigInt(BigInt(b.spentCents)), 0n);
    const pct = totalLimit > 0n ? Number((totalSpent * 100n) / totalLimit) : 0;
    return { totalLimit, totalSpent, pct: Math.min(pct, 100), over: totalSpent > totalLimit };
  }, [budgets]);

  /* ═══ Render ═══ */

  return (
    <PageContainer className="gap-3 md:gap-4 md:h-full md:overflow-hidden">
      {error ? <Alert variant="danger" title={error} /> : null}

      {/* ─── Title + Period filters ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 700 }}>Mon Wallet</h1>
        <div className="flex items-center gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setPeriodOverride(p.days)}
            className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              periodDays === p.days
                ? { background: 'var(--shell-accent-dark)', color: 'white' }
                : { background: 'var(--surface)', color: 'rgba(0,0,0,0.6)' }
            }
          >
            {p.label}
          </button>
        ))}
        </div>
      </div>

      {/* ─── Hero KPI cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HeroCard
          label="Trésorerie"
          value={kpi?.total ?? '—'}
          delta={kpi?.treasuryDelta}
          pctChange={kpi?.treasuryPct}
          positive={kpi?.treasuryPositive}
          href="/app/personal/comptes"
          loading={loading}
          delay={0}
        />
        <HeroCard
          label="Charges"
          value={kpi?.expense ?? '—'}
          delta={kpi?.expenseDelta}
          pctChange={kpi?.expensePct}
          positive={kpi?.chargesPositive}
          href="/app/personal/transactions"
          loading={loading}
          delay={50}
        />
        <HeroCard
          label="Revenus"
          value={kpi?.income ?? '—'}
          delta={kpi?.incomeDelta}
          pctChange={kpi?.incomePct}
          positive={kpi?.revenusPositive}
          href="/app/personal/transactions"
          loading={loading}
          delay={100}
        />
      </div>

      {/* ─── Empty state CTA ─── */}
      {!loading && data && !data.accounts?.length && !data.latestTransactions?.length && !budgets.length && (
        <Link
          href="/app/personal/comptes"
          className="flex flex-col items-center gap-4 rounded-2xl p-8 text-center transition-opacity hover:opacity-90 animate-fade-in-up"
          style={{ background: 'var(--shell-accent)', animationDelay: '120ms', animationFillMode: 'backwards' }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 64, height: 64, background: 'var(--shell-accent-dark)' }}
          >
            <Landmark size={32} style={{ color: 'white' }} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-white text-lg font-bold">Commencez par ajouter un compte</span>
            <span className="text-white/70 text-sm">
              Ajoutez votre premier compte bancaire pour suivre vos finances, transactions et budgets.
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--shell-accent)' }}>Créer un compte</span>
            <ArrowRight size={16} style={{ color: 'var(--shell-accent)' }} />
          </div>
        </Link>
      )}

      {/* ─── Bottom 2-col: Accounts + Budgets ─── */}
      <div className="flex flex-col lg:flex-row gap-4 min-w-0 w-full md:flex-1 md:min-h-0">

        {/* ── Left: Comptes + Transactions ── */}
        <div
          className="flex-1 min-w-0 rounded-xl py-3 flex flex-col gap-6 animate-fade-in-up overflow-hidden md:overflow-y-auto"
          style={{ background: 'var(--shell-accent)', animationDelay: '120ms', animationFillMode: 'backwards' }}
        >
          {/* Accounts header */}
          <div className="flex items-center justify-between px-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-white text-sm font-medium whitespace-nowrap">Comptes en banque</span>
              <CountBadge>{data?.accounts?.length ?? 0}</CountBadge>
            </div>
            <AccentLink href="/app/personal/comptes">Voir mes comptes</AccentLink>
          </div>

          {/* Account cards — horizontal scroll */}
          {loading ? (
            <div className="flex gap-3 px-3">
              <div className="shrink-0 w-[160px] h-[100px] rounded-lg animate-skeleton-pulse" style={{ background: 'var(--shell-accent-dark)' }} />
              <div className="shrink-0 w-[160px] h-[100px] rounded-lg animate-skeleton-pulse" style={{ background: 'var(--shell-accent-dark)' }} />
            </div>
          ) : data?.accounts?.length ? (
            <div className="flex gap-3 overflow-x-auto px-3 pb-1 scrollbar-none">
              {[...data.accounts]
                .sort((a, b) => (ACCOUNT_TYPE_ORDER[a.type] ?? 9) - (ACCOUNT_TYPE_ORDER[b.type] ?? 9))
                .map((a) => {
                  const bank = a.bankCode ? BANK_MAP.get(a.bankCode) : null;
                  const bankName = bank?.shortName ?? a.institution ?? null;
                  const bankUrl = bank?.websiteUrl ?? null;
                  return (
                    <Link
                      key={a.id}
                      href={`/app/personal/comptes/${a.id}`}
                      className="shrink-0 w-[175px] rounded-lg p-3 flex flex-col gap-2 transition-opacity hover:opacity-80"
                      style={{ background: 'var(--shell-accent-dark)' }}
                    >
                      <div className="flex items-center gap-2">
                        {bankUrl ? (
                          <FaviconAvatar name={bankName ?? ''} websiteUrl={bankUrl} size={22} className="rounded-md" />
                        ) : bankName ? (
                          <span className="inline-flex items-center justify-center rounded-md bg-white/15 text-[9px] font-bold text-white" style={{ width: 22, height: 22 }}>
                            {bankName.slice(0, 2).toUpperCase()}
                          </span>
                        ) : null}
                        <span className="text-white/70 text-xs truncate flex-1">{bankName ?? a.name}</span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-white text-xs truncate">{a.name}</span>
                        <span className="text-white/40 text-[10px] shrink-0">{ACCOUNT_TYPE_LABEL[a.type] ?? a.type}</span>
                      </div>
                      <span
                        className="text-lg font-bold"
                        style={{ color: BigInt(a.balanceCents) >= 0n ? '#45D195' : '#FF808B' }}
                      >
                        {BigInt(a.balanceCents) > 0n ? '+' : ''}{fmtKpi(a.balanceCents)}
                      </span>
                    </Link>
                  );
                })}
            </div>
          ) : (
            <p className="px-3 text-white/60 text-sm">Aucun compte.</p>
          )}

          {/* Transactions header */}
          <div className="flex items-center justify-between px-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-white text-sm font-medium whitespace-nowrap">Transactions récentes</span>
              <CountBadge>{data?.latestTransactions?.length ?? 0}</CountBadge>
            </div>
            <AccentLink href="/app/personal/transactions">Tout voir</AccentLink>
          </div>

          {/* Transaction list */}
          {!loading && data?.latestTransactions?.length ? (
            <div className="flex flex-col px-3">
              {data.latestTransactions.slice(0, 5).map((t) => {
                const amt = BigInt(t.amountCents);
                const isPositive = amt >= 0n;
                return (
                  <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-white/10 last:border-0">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{t.label || '—'}</p>
                      <p className="text-white/50 text-xs mt-0.5">
                        {t.account.name}
                        {t.category ? ` · ${t.category.name}` : ''}
                        {' · '}
                        {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-sm font-semibold ml-4"
                      style={{ color: isPositive ? '#45D195' : '#FF808B' }}
                    >
                      {isPositive ? '+' : ''}{formatCentsToEuroDisplay(t.amountCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── Right: Budgets + Épargne ── */}
        <div
          className="w-full lg:w-[381px] shrink-0 rounded-xl p-3 flex flex-col gap-5 animate-fade-in-up md:overflow-y-auto"
          style={{ background: 'var(--shell-accent)', animationDelay: '160ms', animationFillMode: 'backwards' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-white text-sm font-medium">Budgets</span>
            <AccentLink href="/app/personal/budgets">Voir les budgets</AccentLink>
          </div>

          {/* Donut */}
          {budgetSummary ? (
            <div className="flex flex-col items-center gap-4 py-3">
              <div className="relative w-[160px] h-[160px] md:w-[140px] md:h-[140px]">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: `conic-gradient(
                      var(--shell-accent-dark) 0deg ${budgetSummary.pct * 3.6}deg,
                      white ${budgetSummary.pct * 3.6}deg 360deg
                    )`,
                  }}
                />
                <div
                  className="absolute inset-[22%] rounded-full flex flex-col items-center justify-center"
                  style={{ background: 'var(--shell-accent)' }}
                >
                  <span className="text-white text-[28px] md:text-[24px] font-extrabold leading-none">{budgetSummary.pct}%</span>
                  <span className="text-white/70 text-xs mt-1">Dépensé</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--shell-accent-dark)' }} />
                  <span className="text-white text-xs">Dépensé</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-white" />
                  <span className="text-white text-xs">Restant</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-white/60 text-sm text-center">Aucun budget configuré.</p>
            </div>
          )}

          {/* Budget bars (top 4) */}
          {budgets.length > 0 ? (
            <div className="flex flex-col gap-3">
              {budgets.slice(0, 4).map((b) => {
                const spent = absBigInt(BigInt(b.spentCents));
                const limit = BigInt(b.limitCents);
                const pct = limit > 0n ? Number((spent * 100n) / limit) : 0;
                const over = spent > limit;
                return (
                  <div key={b.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs font-medium truncate">{b.name}</span>
                      <span className="text-white/60 text-xs shrink-0 ml-2">
                        {formatCentsToEuroDisplay(b.spentCents)} / {formatCentsToEuroDisplay(b.limitCents)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: over ? '#FF808B' : 'white',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Épargne summary */}
          <div className="mt-auto pt-3 border-t border-white/15 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">Charges fixes / mois</span>
              <span className="text-white text-xs font-semibold">{kpi?.fixedCharges ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">Capacité d&apos;épargne</span>
              <span
                className="text-xs font-semibold"
                style={{ color: kpi?.savingsCapacityPositive ? '#45D195' : '#FF808B' }}
              >
                {kpi?.savingsCapacity ?? '—'} / mois
              </span>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/* ═══ Sub-components ═══ */

function HeroCard({
  label, value, delta, pctChange, positive, href, loading, delay,
}: {
  label: string;
  value: string;
  delta?: string | null;
  pctChange?: number | null;
  positive?: boolean;
  href: string;
  loading?: boolean;
  delay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const isPositive = positive ?? true;
  const badgeBg = isPositive ? 'rgba(0, 194, 110, 0.15)' : 'rgba(255, 128, 139, 0.15)';
  const badgeColor = isPositive ? '#00C26E' : '#FF808B';
  const deltaColor = isPositive ? '#45D195' : '#FF808B';

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col min-h-[180px] md:min-h-0 justify-between rounded-xl bg-[var(--surface)] outline outline-[0.5px] outline-[var(--border)] p-3 animate-fade-in-up transition-shadow hover:shadow-md"
      style={{
        animationDelay: delay ? `${delay}ms` : undefined,
        animationFillMode: delay ? 'backwards' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        {pctChange != null ? (
          <div className="flex items-center gap-1 rounded-xl px-3 py-1.5" style={{ background: badgeBg }}>
            <span
              className="font-bold text-[14px] leading-[14px]"
              style={{ fontFamily: 'var(--font-roboto-mono), monospace', color: badgeColor }}
            >
              {pctChange > 0 ? '+' : ''}{pctChange}%
            </span>
            {pctChange >= 0 ? (
              <ChartNoAxesColumnIncreasing size={14} style={{ color: badgeColor }} />
            ) : (
              <ChartNoAxesColumnDecreasing size={14} style={{ color: badgeColor }} />
            )}
          </div>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          {delta ? (
            <span className="text-base font-bold uppercase" style={{ color: deltaColor }}>{delta}</span>
          ) : null}
          {loading ? (
            <div className="h-10 w-32 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
          ) : (
            <span className="text-[32px] md:text-[28px] font-extrabold leading-tight text-[var(--shell-accent)]">
              {value}
            </span>
          )}
        </div>
        <div
          className="shrink-0 inline-flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
          style={{
            background: hovered ? '#BF7F82' : 'white',
            border: `1px solid ${hovered ? '#BF7F82' : 'black'}`,
          }}
        >
          <ChevronRight size={14} strokeWidth={2.5} className="transition-colors" style={{ color: hovered ? 'white' : 'black' }} />
        </div>
      </div>
    </Link>
  );
}

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl px-1.5 py-px text-xs text-white"
      style={{ background: '#697077', minWidth: 22, lineHeight: '17px' }}
    >
      {children}
    </span>
  );
}

function AccentLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 transition-opacity hover:opacity-80"
    >
      <span
        className="text-black"
        style={{
          fontFamily: 'var(--font-barlow), sans-serif',
          fontSize: 16,
          fontWeight: 600,
          lineHeight: '16px',
        }}
      >
        {children}
      </span>
      <ChevronRight size={14} className="text-black" />
    </Link>
  );
}
