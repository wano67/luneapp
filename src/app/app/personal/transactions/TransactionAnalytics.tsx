'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { fmtKpi, fmtDate } from '@/lib/format';
import { absCents, formatCents } from '@/lib/money';

const CategoryPieChart = dynamic(
  () => import('@/components/ui/charts/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false }
);

export type Analytics = {
  totalIncomeCents: string;
  totalExpenseCents: string;
  txnCount: number;
  topExpenseCategories: { name: string; totalCents: string; count: number }[];
  topExpenses: { id: string; label: string; amountCents: string; date: string; currency: string; accountName: string }[];
  perAccount: { accountId: string; accountName: string; count: number; totalCents: string }[];
};

const CHART_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6',
];

type Props = {
  analytics: Analytics | null;
  loading: boolean;
  periodText: string;
};

export function TransactionAnalytics({ analytics, loading, periodText }: Props) {
  const pieData = useMemo(() => {
    if (!analytics?.topExpenseCategories.length) return [];
    return analytics.topExpenseCategories.map((c, i) => ({
      name: c.name,
      value: Math.abs(Number(c.totalCents)) / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [analytics]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

      {/* KPIs Row */}
      <section className="lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[var(--danger)] p-5">
          <p className="text-sm font-medium text-white/80">Dépenses</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-white">
              {fmtKpi(analytics?.totalExpenseCents ?? '0')}
            </p>
          )}
          <p className="mt-1 text-xs text-white/60">{periodText}</p>
        </div>

        <div className="rounded-2xl bg-[var(--success)] p-5">
          <p className="text-sm font-medium text-white/80">Revenus</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-white">
              {fmtKpi(analytics?.totalIncomeCents ?? '0')}
            </p>
          )}
          <p className="mt-1 text-xs text-white/60">{periodText}</p>
        </div>

        <div className="rounded-2xl bg-[var(--shell-accent)] p-5">
          <p className="text-sm font-medium text-white/80">Solde net</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-white">
              {fmtKpi(
                String(
                  BigInt(analytics?.totalIncomeCents ?? '0') +
                  BigInt(analytics?.totalExpenseCents ?? '0')
                )
              )}
            </p>
          )}
          <p className="mt-1 text-xs text-white/60">{periodText}</p>
        </div>

        <div className="rounded-2xl bg-[var(--shell-accent)] p-5">
          <p className="text-sm font-medium text-white/80">Transactions</p>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
          ) : (
            <p className="mt-1 text-3xl font-extrabold text-white">
              {analytics?.txnCount ?? 0}
            </p>
          )}
          <p className="mt-1 text-xs text-white/60">{periodText}</p>
        </div>
      </section>

      {/* Allocation des dépenses (Pie Chart) */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold text-[var(--text)]">Allocation des dépenses</p>
        <p className="mt-0.5 text-xs text-[var(--text-faint)]">Par catégorie — {periodText}</p>
        {loading ? (
          <div className="mt-4 flex items-center justify-center" style={{ height: 260 }}>
            <div className="h-32 w-32 rounded-full bg-[var(--surface-2)] animate-skeleton-pulse" />
          </div>
        ) : pieData.length > 0 ? (
          <div className="mt-3">
            <CategoryPieChart data={pieData} height={260} />
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 260 }}>
            Aucune catégorie de dépense
          </div>
        )}
      </section>

      {/* Top dépenses */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold text-[var(--text)]">Plus grosses dépenses</p>
        <p className="mt-0.5 text-xs text-[var(--text-faint)]">{periodText}</p>
        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-[var(--surface-2)] animate-skeleton-pulse" />
            ))}
          </div>
        ) : analytics?.topExpenses.length ? (
          <div className="mt-4 space-y-2">
            {analytics.topExpenses.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)]/50 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/10 text-xs font-bold text-[var(--danger)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text)]">{t.label}</p>
                  <p className="text-xs text-[var(--text-faint)]">{t.accountName} · {fmtDate(t.date)}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-[var(--danger)]">
                  {formatCents(absCents(t.amountCents), t.currency)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 200 }}>
            Aucune dépense
          </div>
        )}
      </section>

      {/* Transactions par compte */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <p className="text-sm font-semibold text-[var(--text)]">Par compte</p>
        <p className="mt-0.5 text-xs text-[var(--text-faint)]">Nombre de transactions — {periodText}</p>
        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-[var(--surface-2)] animate-skeleton-pulse" />
            ))}
          </div>
        ) : analytics?.perAccount.length ? (
          <div className="mt-4 space-y-2">
            {analytics.perAccount
              .sort((a, b) => b.count - a.count)
              .map((pa) => {
                const maxCount = Math.max(...analytics.perAccount.map((x) => x.count));
                const pct = maxCount > 0 ? (pa.count / maxCount) * 100 : 0;
                return (
                  <div key={pa.accountId} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-[var(--text)]">{pa.accountName}</p>
                      <span className="shrink-0 text-xs font-medium text-[var(--text-faint)]">
                        {pa.count} transactions · {fmtKpi(pa.totalCents)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--shell-accent)] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 200 }}>
            Aucune donnée
          </div>
        )}
      </section>
    </div>
  );
}
