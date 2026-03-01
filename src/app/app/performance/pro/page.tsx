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
import { CategoryPieChart } from '@/components/ui/charts/CategoryPieChart';
import { TrendLineChart } from '@/components/ui/charts/TrendLineChart';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';

type ProBusiness = { id: string; name: string };

type ProAnalyticsResponse = {
  totalRevenueCents: string;
  totalExpensesCents: string;
  netMarginCents: string;
  activeProjectsCount: number;
  completedProjectsCount: number;
  projectProfitability: Array<{
    projectId: string;
    name: string;
    revenueCents: string;
    expenseCents: string;
    marginPercent: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    totalCents: string;
    percent: number;
  }>;
  revenueTrend: Array<{
    month: string;
    totalCents: string;
  }>;
};

type BusinessesResponse = {
  items?: Array<{ business?: { id?: string; name?: string } }>;
};

const ACTIVE_KEY = 'activeProBusinessId';
const LAST_KEY = 'lastProBusinessId';

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

export default function PerformanceProPage() {
  const [businesses, setBusinesses] = useState<ProBusiness[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [storedBusinessId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(ACTIVE_KEY) || window.localStorage.getItem(LAST_KEY);
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<ProAnalyticsResponse | null>(null);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBusinesses() {
      setLoadingBusinesses(true);
      const res = await fetchJson<BusinessesResponse>('/api/pro/businesses');
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error ?? 'Impossible de charger les entreprises.');
        setBusinesses([]);
        setLoadingBusinesses(false);
        return;
      }

      const parsed: ProBusiness[] = (res.data?.items ?? [])
        .map((item) => ({ id: item.business?.id ?? '', name: item.business?.name ?? '' }))
        .filter((item) => item.id && item.name);

      setBusinesses(parsed);
      setLoadingBusinesses(false);
    }

    void loadBusinesses();
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultBusinessId = useMemo(() => {
    if (!businesses.length) return null;
    if (storedBusinessId && businesses.some((business) => business.id === storedBusinessId)) {
      return storedBusinessId;
    }
    return businesses[0].id;
  }, [businesses, storedBusinessId]);

  const effectiveBusinessId = useMemo(() => {
    if (!selectedBusinessId) return defaultBusinessId;
    if (businesses.some((business) => business.id === selectedBusinessId)) return selectedBusinessId;
    return defaultBusinessId;
  }, [businesses, defaultBusinessId, selectedBusinessId]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    try {
      window.localStorage.setItem(ACTIVE_KEY, effectiveBusinessId);
      window.localStorage.setItem(LAST_KEY, effectiveBusinessId);
    } catch {
      // ignore storage failures
    }
  }, [effectiveBusinessId]);

  useEffect(() => {
    if (!effectiveBusinessId) return;
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ProAnalyticsResponse>(
        `/api/pro/businesses/${effectiveBusinessId}/analytics`
      );
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Impossible de charger l’analyse pro.');
        setData(null);
        setLoading(false);
        return;
      }
      setData(res.data);
      setLoading(false);
    }

    void loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [effectiveBusinessId]);

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === effectiveBusinessId) ?? null,
    [businesses, effectiveBusinessId]
  );

  const trendData = useMemo(
    () =>
      (data?.revenueTrend ?? []).map((point) => ({
        label: formatMonthLabel(point.month),
        value: toEuros(point.totalCents),
      })),
    [data?.revenueTrend]
  );

  const expensesChartData = useMemo(
    () =>
      (data?.expensesByCategory ?? []).map((item) => ({
        name: item.category,
        value: toEuros(item.totalCents),
      })),
    [data?.expensesByCategory]
  );

  const netMargin = data ? centsToNumber(data.netMarginCents) : 0;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Analyse Pro"
        subtitle="Performance de ton activité professionnelle."
        backHref="/app/focus"
        backLabel="Performance"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {businesses.length > 1 ? (
              <label className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                <span className="whitespace-nowrap text-xs">Entreprise</span>
                <select
                  value={effectiveBusinessId ?? ''}
                  onChange={(event) => setSelectedBusinessId(event.target.value)}
                  className="min-w-[180px] bg-transparent text-[var(--text-primary)] focus-visible:outline-none"
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {selectedBusiness ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/pro/${selectedBusiness.id}`}>Ouvrir le studio</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {loadingBusinesses ? <p className="text-sm text-[var(--text-faint)]">Chargement des entreprises…</p> : null}

      {!loadingBusinesses && businesses.length === 0 ? (
        <EmptyState
          title="Aucune entreprise disponible"
          description="Crée ou rejoins un espace pro pour afficher cette analyse."
          action={
            <Button asChild size="sm">
              <Link href="/app/pro">Aller au Studio</Link>
            </Button>
          }
        />
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {effectiveBusinessId && !error ? (
        <>
          {loading ? <p className="text-sm text-[var(--text-faint)]">Chargement de l’analyse…</p> : null}

          {data ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="CA du mois"
                  value={formatCentsToEuroDisplay(data.totalRevenueCents)}
                  trend="up"
                />
                <KpiCard
                  label="Dépenses du mois"
                  value={formatCentsToEuroDisplay(data.totalExpensesCents)}
                  trend="down"
                />
                <KpiCard
                  label="Marge nette"
                  value={formatCentsToEuroDisplay(data.netMarginCents)}
                  trend={netMargin >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                  label="Projets actifs"
                  value={String(data.activeProjectsCount)}
                  hint={`${data.completedProjectsCount} terminés`}
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="space-y-4 p-5">
                  <SectionHeader title="Tendance CA (6 mois)" />
                  <TrendLineChart data={trendData} />
                </Card>

                <Card className="space-y-4 p-5">
                  <SectionHeader title="Répartition des dépenses" />
                  <CategoryPieChart data={expensesChartData} />
                </Card>
              </div>

              <section className="space-y-4">
                <SectionHeader title="Rentabilité par projet" />
                {data.projectProfitability.length === 0 ? (
                  <Card className="p-5 text-sm text-[var(--text-faint)]">
                    Aucune donnée de rentabilité projet pour le moment.
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {data.projectProfitability.map((project) => {
                      const marginWidth = Math.min(100, Math.max(0, Math.abs(project.marginPercent)));
                      const isPositive = project.marginPercent >= 0;
                      return (
                        <Card key={project.projectId} className="space-y-3 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--text)]">{project.name}</p>
                            <p
                              className="text-sm font-semibold"
                              style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                            >
                              {project.marginPercent.toFixed(1)}%
                            </p>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--surface-2)]">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${marginWidth}%`,
                                background: isPositive ? 'var(--success)' : 'var(--danger)',
                              }}
                            />
                          </div>
                          <div className="grid gap-2 text-xs text-[var(--text-faint)] sm:grid-cols-2">
                            <span>Revenus: {formatCentsToEuroDisplay(project.revenueCents)}</span>
                            <span>Dépenses: {formatCentsToEuroDisplay(project.expenseCents)}</span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </PageContainer>
  );
}
