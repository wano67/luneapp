'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import dynamic from 'next/dynamic';

const CategoryPieChart = dynamic(() => import('@/components/ui/charts/CategoryPieChart').then((m) => m.CategoryPieChart), { ssr: false });
const TrendLineChart = dynamic(() => import('@/components/ui/charts/TrendLineChart').then((m) => m.TrendLineChart), { ssr: false });
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';

type PersonalAnalyticsResponse = {
  totalBalanceCents: string;
  monthIncomeCents: string;
  monthExpenseCents: string;
  savingsRate: number;
  fixedChargesMonthlyCents: string;
  variableChargesCents: string;
  expensesByCategory: Array<{
    category: string;
    totalCents: string;
    percent: number;
  }>;
  balanceTrend: Array<{
    month: string;
    balanceCents: string;
  }>;
  budgetVsActual: Array<{
    budgetName: string;
    limitCents: string;
    spentCents: string;
    percent: number;
  }>;
};

function centsToNumber(cents: string) {
  const parsed = Number(cents);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toEuros(cents: string) {
  return centsToNumber(cents) / 100;
}

function formatMonthLabel(monthKey: string) {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date);
}

export default function PerformancePersoPage() {
  const [data, setData] = useState<PersonalAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const res = await fetchJson<PersonalAnalyticsResponse>('/api/personal/analytics');
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Impossible de charger l’analyse perso.');
        setData(null);
        setLoading(false);
        return;
      }
      setData(res.data);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendData = useMemo(
    () =>
      (data?.balanceTrend ?? []).map((point) => ({
        label: formatMonthLabel(point.month),
        value: toEuros(point.balanceCents),
      })),
    [data?.balanceTrend]
  );

  const expensesChartData = useMemo(
    () =>
      (data?.expensesByCategory ?? []).map((item) => ({
        name: item.category,
        value: toEuros(item.totalCents),
      })),
    [data?.expensesByCategory]
  );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Analyse Perso"
        subtitle="Performance de tes finances personnelles."
        backHref="/app/focus"
        backLabel="Performance"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/personal">Ouvrir le Wallet</Link>
          </Button>
        }
      />

      {loading ? <p className="text-sm text-[var(--text-faint)]">Chargement de l’analyse…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Solde total" value={formatCentsToEuroDisplay(data.totalBalanceCents)} />
            <KpiCard label="Revenus du mois" value={formatCentsToEuroDisplay(data.monthIncomeCents)} trend="up" />
            <KpiCard label="Dépenses du mois" value={formatCentsToEuroDisplay(data.monthExpenseCents)} trend="down" />
            <KpiCard label="Taux d’épargne" value={`${data.savingsRate.toFixed(1)}%`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard label="Charges fixes / mois" value={formatCentsToEuroDisplay(data.fixedChargesMonthlyCents)} />
            <KpiCard label="Charges variables / mois" value={formatCentsToEuroDisplay(data.variableChargesCents)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="space-y-4 p-5">
              <SectionHeader title="Évolution du solde (6 mois)" />
              <TrendLineChart data={trendData} />
            </Card>

            <Card className="space-y-4 p-5">
              <SectionHeader title="Répartition des dépenses" />
              <CategoryPieChart data={expensesChartData} />
            </Card>
          </div>

          <section className="space-y-4">
            <SectionHeader title="Budgets vs Réel" />
            {data.budgetVsActual.length === 0 ? (
              <EmptyState
                title="Aucun budget configuré"
                description="Ajoute des budgets pour comparer tes objectifs aux dépenses réelles."
                action={
                  <Button asChild size="sm">
                    <Link href="/app/personal/budgets">Configurer les budgets</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                {data.budgetVsActual.map((budget) => {
                  const ratio = Math.min(100, Math.max(0, budget.percent));
                  const overLimit = budget.percent > 100;
                  return (
                    <Card key={budget.budgetName} className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text)]">{budget.budgetName}</p>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: overLimit ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {budget.percent.toFixed(1)}%
                        </p>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${ratio}%`,
                            background: overLimit ? 'var(--danger)' : 'var(--success)',
                          }}
                        />
                      </div>
                      <div className="grid gap-2 text-xs text-[var(--text-faint)] sm:grid-cols-2">
                        <span>Dépensé: {formatCentsToEuroDisplay(budget.spentCents)}</span>
                        <span>Budget: {formatCentsToEuroDisplay(budget.limitCents)}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}
