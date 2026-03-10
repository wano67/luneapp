'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import { fmtKpi, fmtDate } from '@/lib/format';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/* ═══ Types ═══ */

type LatestTx = {
  id: string;
  label: string;
  amountCents: string;
  date: string;
  categoryName: string | null;
  accountName: string;
};

type PersonalSummary = {
  totalBalanceCents: string;
  monthNetCents: string;
  monthIncomeCents: string;
  monthExpenseCents: string;
  latestTransactions: LatestTx[];
};

type NextDueInvoice = {
  id: string;
  totalCents: string;
  dueAt: string;
  projectName: string;
};

type ProSummary = {
  businessId: string;
  businessName: string;
  activeProjectsCount: number;
  pendingInvoicesCount: number;
  monthRevenueCents: string;
  nextDueInvoice: NextDueInvoice | null;
};

type FocusSummary = {
  personal: PersonalSummary;
  pro: ProSummary | null;
};

type AccountOptimization = {
  accountId: string;
  accountName: string;
  balanceCents: string;
  currentRateBps: number | null;
  bestRateBps: number;
  bestRateLabel: string;
  annualGainCents: string;
};

type GoalTimeline = {
  goalId: string;
  goalName: string;
  percentComplete: number;
  monthlyNeededCents: string | null;
  deadline: string | null;
  onTrack: boolean | null;
};

type SavingsInsight = {
  type: 'info' | 'warning' | 'success';
  title: string;
  description: string;
};

type SavingsAnalysis = {
  avgMonthlyIncomeCents: string;
  avgMonthlyExpenseCents: string;
  fixedChargesCents: string;
  savingsCapacityCents: string;
  savingsRatePercent: number;
  healthScore: number;
  totalEstimatedAnnualInterestCents: string;
  accountOptimizations: AccountOptimization[];
  goalTimelines: GoalTimeline[];
  insights: SavingsInsight[];
};

/* ═══ Page ═══ */

export default function FocusPage() {
  const [data, setData] = useState<FocusSummary | null>(null);
  const [analysis, setAnalysis] = useState<SavingsAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [summaryRes, analysisRes] = await Promise.all([
      fetchJson<FocusSummary>('/api/focus/summary'),
      fetchJson<SavingsAnalysis>('/api/personal/focus'),
    ]);
    if (summaryRes.ok && summaryRes.data) setData(summaryRes.data);
    else setError(summaryRes.error ?? 'Impossible de charger le résumé.');
    if (analysisRes.ok && analysisRes.data) setAnalysis(analysisRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const personal = data?.personal;
  const pro = data?.pro;
  const monthNet = personal ? BigInt(personal.monthNetCents) : 0n;

  return (
    <PageContainer className="gap-7">
      <PageHeader title="Focus" />

      {error ? <Alert variant="danger" title={error} /> : null}

      {loading ? (
        <EmptyState title="Chargement…" />
      ) : (
        <>
          {/* ── Wallet — Personnel ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader
              title="Wallet — Personnel"
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/personal">Wallet <ChevronRight size={14} /></Link>
                </Button>
              }
            />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <KpiCard
                label="Solde total"
                value={personal ? fmtKpi(personal.totalBalanceCents) : '—'}
                delay={0}
              />
              <KpiCard
                label="Revenus (mois)"
                value={personal ? fmtKpi(personal.monthIncomeCents) : '—'}
                delay={50}
              />
              <KpiCard
                label="Net (mois)"
                value={personal ? fmtKpi(personal.monthNetCents) : '—'}
                delay={100}
                delta={personal ? (monthNet >= 0n ? '+' : '') + fmtKpi(personal.monthNetCents) : undefined}
                trend={monthNet >= 0n ? 'up' : 'down'}
              />
            </div>
          </div>

          {/* ── Studio — Pro ── */}
          {pro ? (
            <div className="flex flex-col gap-4">
              <SectionHeader
                title={`Studio — ${pro.businessName}`}
                actions={
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/pro/${pro.businessId}`}>Studio <ChevronRight size={14} /></Link>
                  </Button>
                }
              />

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <KpiCard label="CA encaissé (mois)" value={fmtKpi(pro.monthRevenueCents)} delay={150} />
                <KpiCard label="Projets actifs" value={String(pro.activeProjectsCount)} delay={200} />
                <KpiCard label="Factures en attente" value={String(pro.pendingInvoicesCount)} delay={250} />
              </div>

              {pro.nextDueInvoice && (
                <div
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
                  style={{ background: 'var(--shell-accent)' }}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-white/70">Prochaine facture à encaisser</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{pro.nextDueInvoice.projectName}</p>
                    <p className="text-xs text-white/70">Échéance le {fmtDate(pro.nextDueInvoice.dueAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-white font-extrabold"
                      style={{ fontFamily: 'var(--font-roboto-mono), monospace', fontSize: 20 }}
                    >
                      {fmtKpi(pro.nextDueInvoice.totalCents)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/pro/${pro.businessId}/finances`}>Voir</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <SectionHeader title="Studio — Pro" />
              <EmptyState
                title="Aucune activité pro pour le moment."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/app/pro">Créer un espace pro <ChevronRight size={14} /></Link>
                  </Button>
                }
              />
            </div>
          )}

          {/* ── Optimisation épargne ── */}
          {analysis && (
            <div className="flex flex-col gap-4">
              <SectionHeader
                title="Optimisation épargne"
                actions={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/app/personal/epargne">Épargne <ChevronRight size={14} /></Link>
                  </Button>
                }
              />

              {/* Health score + KPIs */}
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                <Card className="p-4 flex flex-col items-center justify-center gap-1">
                  <p className="text-xs text-[var(--text-faint)]">Score de santé</p>
                  <p
                    className="text-3xl font-bold"
                    style={{
                      color: analysis.healthScore >= 70
                        ? 'var(--success)'
                        : analysis.healthScore >= 40
                        ? 'var(--warning)'
                        : 'var(--danger)',
                    }}
                  >
                    {analysis.healthScore}
                  </p>
                  <p className="text-xs text-[var(--text-faint)]">/ 100</p>
                </Card>
                <KpiCard
                  label="Taux d'épargne"
                  value={`${analysis.savingsRatePercent.toFixed(1)} %`}
                  trend={analysis.savingsRatePercent >= 10 ? 'up' : 'down'}
                />
                <KpiCard
                  label="Capacité mensuelle"
                  value={formatCentsToEuroDisplay(analysis.savingsCapacityCents)}
                />
                <KpiCard
                  label="Intérêts estimés / an"
                  value={formatCentsToEuroDisplay(analysis.totalEstimatedAnnualInterestCents)}
                />
              </div>

              {/* Waterfall: Revenus → Charges → Variable → Capacité */}
              <Card className="p-4">
                <p className="text-sm font-semibold mb-3">Décomposition mensuelle</p>
                <div className="space-y-2">
                  <WaterfallRow
                    label="Revenus moyens"
                    value={formatCentsToEuroDisplay(analysis.avgMonthlyIncomeCents)}
                    color="var(--success)"
                  />
                  <WaterfallRow
                    label="Charges fixes"
                    value={`-${formatCentsToEuroDisplay(analysis.fixedChargesCents)}`}
                    color="var(--danger)"
                  />
                  <WaterfallRow
                    label="Dépenses variables"
                    value={`-${formatCentsToEuroDisplay(
                      (BigInt(analysis.avgMonthlyExpenseCents) > BigInt(analysis.fixedChargesCents)
                        ? BigInt(analysis.avgMonthlyExpenseCents) - BigInt(analysis.fixedChargesCents)
                        : 0n
                      ).toString()
                    )}`}
                    color="var(--warning)"
                  />
                  <div className="border-t border-[var(--border)] pt-2">
                    <WaterfallRow
                      label="Capacité d'épargne"
                      value={formatCentsToEuroDisplay(analysis.savingsCapacityCents)}
                      color="var(--accent)"
                      bold
                    />
                  </div>
                </div>
              </Card>

              {/* Insights */}
              {analysis.insights.length > 0 && (
                <div className="space-y-2">
                  {analysis.insights.map((insight, i) => (
                    <Card key={i} className="p-4 flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        {insight.type === 'warning' ? (
                          <AlertTriangle size={16} className="text-[var(--warning)]" />
                        ) : insight.type === 'success' ? (
                          <CheckCircle size={16} className="text-[var(--success)]" />
                        ) : (
                          <Info size={16} className="text-[var(--accent)]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{insight.title}</p>
                        <p className="text-xs text-[var(--text-faint)] mt-0.5">{insight.description}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Goal timelines */}
              {analysis.goalTimelines.length > 0 && (
                <Card className="p-4">
                  <p className="text-sm font-semibold mb-3">Objectifs d&apos;épargne</p>
                  <div className="space-y-3">
                    {analysis.goalTimelines.map((gt) => (
                      <div key={gt.goalId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{gt.goalName}</p>
                            {gt.onTrack === true && <Badge variant="pro">En bonne voie</Badge>}
                            {gt.onTrack === false && <Badge variant="neutral">En retard</Badge>}
                          </div>
                          <p className="text-xs text-[var(--text-faint)]">{Math.round(gt.percentComplete)} %</p>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.round(gt.percentComplete))}%`,
                              backgroundColor: gt.onTrack === false ? 'var(--warning)' : 'var(--accent)',
                            }}
                          />
                        </div>
                        {gt.monthlyNeededCents && (
                          <p className="text-xs text-[var(--text-faint)] mt-1">
                            {formatCentsToEuroDisplay(gt.monthlyNeededCents)}/mois nécessaires
                            {gt.deadline ? ` avant ${new Date(gt.deadline).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Account rate optimization */}
              {analysis.accountOptimizations.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-[var(--accent)]" />
                    <p className="text-sm font-semibold">Optimisation des taux</p>
                  </div>
                  <div className="space-y-2">
                    {analysis.accountOptimizations.map((opt) => (
                      <div
                        key={opt.accountId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 bg-[var(--surface-2)]"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{opt.accountName}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {formatCentsToEuroDisplay(opt.balanceCents)}
                            {' · '}
                            Taux actuel : {opt.currentRateBps != null ? `${(opt.currentRateBps / 100).toFixed(2)} %` : 'non renseigné'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--text-faint)]">
                            Référence : {opt.bestRateLabel} ({(opt.bestRateBps / 100).toFixed(2)} %)
                          </p>
                          {BigInt(opt.annualGainCents) > 0n && (
                            <p className="text-xs font-semibold text-[var(--success)]">
                              +{formatCentsToEuroDisplay(opt.annualGainCents)}/an possible
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── Dernières transactions perso ── */}
          {personal && personal.latestTransactions.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title="Dernières transactions perso"
                actions={
                  <Link href="/app/personal/transactions" className="text-xs font-semibold hover:underline" style={{ color: 'var(--shell-accent)' }}>
                    Tout voir →
                  </Link>
                }
              />

              {personal.latestTransactions.slice(0, 5).map((tx) => {
                const amt = BigInt(tx.amountCents);
                const isPositive = amt >= 0n;
                return (
                  <ListRow
                    key={tx.id}
                    left={tx.label || '—'}
                    sub={`${tx.accountName}${tx.categoryName ? ` · ${tx.categoryName}` : ''} · ${new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                    right={
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {isPositive ? '+' : ''}{fmtKpi(tx.amountCents)}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

/* ═══ Waterfall Row ═══ */

function WaterfallRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <p className={`text-sm ${bold ? 'font-semibold' : ''}`}>{label}</p>
      </div>
      <p className={`text-sm ${bold ? 'font-bold' : 'font-medium'}`} style={{ color }}>
        {value}
      </p>
    </div>
  );
}
