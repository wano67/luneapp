'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import {
  Landmark, TrendingUp, Target, Clock, ArrowRight,
  Wallet, PiggyBank, ChevronRight, ChevronUp, ChevronDown,
} from 'lucide-react';

/* ═══ Types ═══ */

type SavingsAccount = {
  id: string;
  name: string;
  balanceCents: string;
  interestRateBps: number | null;
};

type SavingsGoal = {
  id: string;
  name: string;
  targetCents: string;
  fundedCents: string;
  deadline: string | null;
  isCompleted: boolean;
  accountId: string | null;
  account: { id: string; name: string; balanceCents: string } | null;
  monthlyNeededCents: string | null;
  monthlyContributionCents: string | null;
  projectedDate: string | null;
  percentComplete: number;
  priority: number;
};

type FormState = {
  name: string;
  targetAmount: string;
  deadline: string;
  accountId: string;
  priority: string;
  monthlyContribution: string;
};

const EMPTY_FORM: FormState = { name: '', targetAmount: '', deadline: '', accountId: '', priority: '0', monthlyContribution: '' };

const PRIORITY_LABELS: Record<string, string> = {
  '3': 'Haute',
  '2': 'Moyenne',
  '1': 'Basse',
  '0': 'Aucune',
};

/* ═══ Helpers ═══ */

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatProjectedDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function deadlineToInputDate(deadline: string | null): string {
  if (!deadline) return '';
  return deadline.slice(0, 10);
}

function centsToInputValue(cents: string | null): string {
  if (!cents) return '';
  try {
    const b = BigInt(cents);
    const abs = b < 0n ? -b : b;
    const euros = abs / 100n;
    const rem = abs % 100n;
    return `${euros}.${rem.toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatMonthsHuman(months: number): string {
  if (months < 1) return 'moins d\u2019un mois';
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} et ${rem} mois`;
}

/* ═══ Page ═══ */

export default function EpargnePage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [investAccounts, setInvestAccounts] = useState<SavingsAccount[]>([]);
  const [savingsAccountsTotalCents, setSavingsAccountsTotalCents] = useState('0');
  const [investAccountsTotalCents, setInvestAccountsTotalCents] = useState('0');
  const [totalPatrimoineCents, setTotalPatrimoineCents] = useState('0');
  const [totalTargetCents, setTotalTargetCents] = useState('0');
  const [totalRemainingCents, setTotalRemainingCents] = useState('0');
  const [monthlySavingsCapacityCents, setMonthlySavingsCapacityCents] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{
      items: SavingsGoal[];
      savingsAccounts: SavingsAccount[];
      investAccounts: SavingsAccount[];
      savingsAccountsTotalCents: string;
      investAccountsTotalCents: string;
      totalPatrimoineCents: string;
      totalTargetCents: string;
      totalRemainingCents: string;
      monthlySavingsCapacityCents: string;
    }>('/api/personal/savings');
    if (res.ok && res.data) {
      setGoals(res.data.items ?? []);
      setSavingsAccounts(res.data.savingsAccounts ?? []);
      setInvestAccounts(res.data.investAccounts ?? []);
      setSavingsAccountsTotalCents(String(res.data.savingsAccountsTotalCents ?? '0'));
      setInvestAccountsTotalCents(String(res.data.investAccountsTotalCents ?? '0'));
      setTotalPatrimoineCents(String(res.data.totalPatrimoineCents ?? '0'));
      setTotalTargetCents(String(res.data.totalTargetCents ?? '0'));
      setTotalRemainingCents(String(res.data.totalRemainingCents ?? '0'));
      setMonthlySavingsCapacityCents(String(res.data.monthlySavingsCapacityCents ?? '0'));
    } else {
      setError(res.error ?? 'Impossible de charger les objectifs.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ═══ CRUD handlers ═══ */

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(g: SavingsGoal) {
    setEditingId(g.id);
    setForm({
      name: g.name,
      targetAmount: centsToInputValue(g.targetCents),
      deadline: deadlineToInputDate(g.deadline),
      accountId: g.accountId ?? '',
      priority: String(g.priority ?? 0),
      monthlyContribution: centsToInputValue(g.monthlyContributionCents),
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const targetCents = parseEuroToCents(form.targetAmount.replace(',', '.'));
      if (!Number.isFinite(targetCents) || targetCents <= 0) {
        setSaveError('Montant cible invalide.');
        return;
      }
      if (!form.name.trim()) {
        setSaveError('Nom requis.');
        return;
      }
      const mcRaw = form.monthlyContribution ? parseEuroToCents(form.monthlyContribution.replace(',', '.')) : null;
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        targetCents,
        deadline: form.deadline || null,
        accountId: form.accountId || null,
        priority: Number(form.priority) || 0,
        monthlyContributionCents: mcRaw && Number.isFinite(mcRaw) && mcRaw > 0 ? mcRaw : null,
      };
      const res = editingId
        ? await fetchJson(`/api/personal/savings/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchJson('/api/personal/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        setSaveError(res.error ?? 'Erreur lors de la sauvegarde.');
        return;
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setSaveError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetchJson(`/api/personal/savings/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  async function movePriority(goalId: string, direction: 'up' | 'down') {
    const active = goals.filter((g) => !g.isCompleted);
    const idx = active.findIndex((g) => g.id === goalId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= active.length) return;

    // Swap priorities
    const items = active.map((g, i) => ({
      id: g.id,
      priority: active.length - i, // highest first
    }));
    // swap the two
    const tmpPrio = items[idx].priority;
    items[idx].priority = items[swapIdx].priority;
    items[swapIdx].priority = tmpPrio;

    await fetchJson('/api/personal/savings/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    await load();
  }

  /* ═══ Computed ═══ */

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const patrimoineBigInt = BigInt(totalPatrimoineCents);
  const capacityBigInt = BigInt(monthlySavingsCapacityCents);
  const remainingBigInt = BigInt(totalRemainingCents);
  const savingsBigInt = BigInt(savingsAccountsTotalCents);
  const investBigInt = BigInt(investAccountsTotalCents);
  const targetBigInt = BigInt(totalTargetCents);

  const monthsToReachAll = capacityBigInt > 0n && remainingBigInt > 0n
    ? Number(remainingBigInt / capacityBigInt)
    : null;

  const overallPct = targetBigInt > 0n
    ? Math.min(100, Math.round(Number((patrimoineBigInt * 100n) / targetBigInt)))
    : 0;

  const savingsRate = patrimoineBigInt > 0n && savingsBigInt > 0n
    ? Math.round(Number((savingsBigInt * 100n) / patrimoineBigInt))
    : 0;
  const investRate = patrimoineBigInt > 0n && investBigInt > 0n
    ? Math.round(Number((investBigInt * 100n) / patrimoineBigInt))
    : 0;

  /* ═══ Render ═══ */

  if (loading) {
    return (
      <PageContainer className="space-y-8">
        <PageHeader title="Épargne" subtitle="Chargement…" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[var(--surface)] animate-skeleton-pulse" />
          ))}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-10">
      <PageHeader
        title="Épargne"
        subtitle="Vue d&apos;ensemble de ton patrimoine et de tes objectifs."
        actions={<Button size="sm" onClick={openCreate}>Nouvel objectif</Button>}
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {/* ═══ 1. HERO — Patrimoine total ═══ */}
      <section className="rounded-2xl bg-[var(--surface)] outline outline-[0.5px] outline-[var(--border)] p-6 sm:p-8 animate-fade-in-up">
        <p className="text-sm font-medium text-[var(--text-faint)] mb-1">Patrimoine total</p>
        <p className="text-4xl sm:text-5xl font-extrabold text-[var(--shell-accent)]">
          {formatCentsToEuroDisplay(totalPatrimoineCents)}
        </p>

        {/* Progress bar — patrimoine vs objectifs */}
        {(() => {
          // The bar base = max(patrimoine, target) so it always fills correctly
          const base = targetBigInt > patrimoineBigInt ? targetBigInt : patrimoineBigInt;
          if (base <= 0n) return null;
          const savingsPct = Math.round(Number((savingsBigInt * 100n) / base));
          const investPct = Math.round(Number((investBigInt * 100n) / base));
          const filledPct = savingsPct + investPct;
          return (
            <div className="mt-5">
              {targetBigInt > 0n && (
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--text-faint)]">
                    {overallPct} % de tes objectifs atteints
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">
                    Objectif : {formatCentsToEuroDisplay(totalTargetCents)}
                  </span>
                </div>
              )}
              <div className="h-3 overflow-hidden rounded-full bg-[var(--border)] flex">
                {savingsBigInt > 0n && (
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${savingsPct}%` }}
                  />
                )}
                {investBigInt > 0n && (
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${investPct}%` }}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5">
                {savingsBigInt > 0n && (
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-[var(--text-faint)]">
                      Épargne · {formatCentsToEuroDisplay(savingsAccountsTotalCents)}
                    </span>
                  </div>
                )}
                {investBigInt > 0n && (
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-[var(--text-faint)]">
                      Investissements · {formatCentsToEuroDisplay(investAccountsTotalCents)}
                    </span>
                  </div>
                )}
                {remainingBigInt > 0n && (
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[var(--border)]" />
                    <span className="text-xs text-[var(--text-faint)]">
                      Restant · {formatCentsToEuroDisplay(totalRemainingCents)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* ═══ 2. KPI CARDS — 2 colonnes aérées ═══ */}
      <section className="grid gap-4 sm:grid-cols-2">
        {/* Capacité d'épargne */}
        <div className="rounded-2xl bg-[var(--surface)] outline outline-[0.5px] outline-[var(--border)] p-5 animate-fade-in-up" style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <PiggyBank size={16} className="text-emerald-500" />
            </div>
            <span className="text-sm font-medium text-[var(--text)]">Capacité d&apos;épargne</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text)]">
            {formatCentsToEuroDisplay(monthlySavingsCapacityCents)}<span className="text-sm font-normal text-[var(--text-faint)]"> / mois</span>
          </p>
          <p className="text-xs text-[var(--text-faint)] mt-1.5">
            Calculée sur la moyenne de tes 6 derniers mois (revenus − dépenses)
          </p>
        </div>

        {/* Objectifs en cours */}
        <div className="rounded-2xl bg-[var(--surface)] outline outline-[0.5px] outline-[var(--border)] p-5 animate-fade-in-up" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <Target size={16} className="text-blue-500" />
            </div>
            <span className="text-sm font-medium text-[var(--text)]">Objectifs en cours</span>
          </div>
          {activeGoals.length > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-[var(--text)]">{overallPct} %</p>
                <span className="text-xs text-[var(--text-faint)]">atteints</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${overallPct}%`,
                    backgroundColor: remainingBigInt <= 0n ? 'var(--success)' : 'var(--accent)',
                  }}
                />
              </div>
              <p className="text-xs text-[var(--text-faint)] mt-1.5">
                {remainingBigInt > 0n
                  ? `Il te reste ${formatCentsToEuroDisplay(totalRemainingCents)} à épargner`
                  : 'Ton patrimoine couvre tous tes objectifs'}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--text-faint)]">Aucun objectif défini</p>
          )}
        </div>
      </section>

      {/* ═══ 3. Projection temporelle ═══ */}
      {monthsToReachAll != null && monthsToReachAll > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-[var(--shell-accent)]/5 to-[var(--shell-accent)]/10 outline outline-[0.5px] outline-[var(--shell-accent)]/20 p-5 animate-fade-in-up" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--shell-accent)]/15">
              <Clock size={18} className="text-[var(--shell-accent)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">
                Tous tes objectifs atteints dans ~{formatMonthsHuman(monthsToReachAll)}
              </p>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                En continuant d&apos;épargner {formatCentsToEuroDisplay(monthlySavingsCapacityCents)}/mois, tu auras mis de côté les {formatCentsToEuroDisplay(totalRemainingCents)} restants.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ═══ 4. Comptes ═══ */}
      {(savingsAccounts.length > 0 || investAccounts.length > 0) && (
        <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tes comptes</h2>
            <Link href="/app/personal/comptes" className="flex items-center gap-1 text-xs font-medium text-[var(--shell-accent)] hover:underline">
              Voir tous les comptes <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {savingsAccounts.map((a) => (
              <Card key={a.id} className="p-4 min-w-[200px] shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={16} className="text-blue-500" />
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                </div>
                <p className="text-lg font-bold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                {a.interestRateBps != null ? (
                  <span className="text-xs text-[var(--text-faint)]">
                    {(a.interestRateBps / 100).toFixed(2)} % / an
                  </span>
                ) : null}
              </Card>
            ))}
            {investAccounts.map((a) => (
              <Card key={a.id} className="p-4 min-w-[200px] shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-emerald-500" />
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                </div>
                <p className="text-lg font-bold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                {a.interestRateBps != null ? (
                  <span className="text-xs text-[var(--text-faint)]">
                    {(a.interestRateBps / 100).toFixed(2)} % / an
                  </span>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ═══ 5. Objectifs détaillés ═══ */}
      <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}>
        <h2 className="text-lg font-semibold">Objectifs</h2>
        {goals.length === 0 ? (
          <EmptyState
            title="Aucun objectif"
            description="Fixe-toi des objectifs — la progression se calcule automatiquement depuis tes comptes."
            action={<Button size="sm" onClick={openCreate}>Créer un objectif</Button>}
          />
        ) : (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round(g.percentComplete));
              return (
                <Card key={g.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{g.name}</p>
                        {g.isCompleted ? <Badge variant="pro">Atteint</Badge> : null}
                        {g.priority >= 3 ? <Badge variant="warning">Prioritaire</Badge>
                          : g.priority >= 2 ? <Badge variant="neutral">Moyenne</Badge>
                          : g.priority >= 1 ? <Badge variant="neutral">Basse</Badge>
                          : null}
                        {g.account ? <Badge variant="neutral">{g.account.name}</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text)]">
                        {formatCentsToEuroDisplay(g.fundedCents)} <span className="text-[var(--text-faint)]">sur</span> {formatCentsToEuroDisplay(g.targetCents)}
                      </p>

                      {/* Projections */}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {g.monthlyContributionCents ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                            <PiggyBank size={12} />
                            <span>{formatCentsToEuroDisplay(g.monthlyContributionCents)}/mois programmés</span>
                          </div>
                        ) : null}
                        {g.deadline ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                            <Clock size={12} />
                            <span>Échéance : {formatDeadline(g.deadline)}</span>
                          </div>
                        ) : null}
                        {g.monthlyNeededCents ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                            <Wallet size={12} />
                            <span>{formatCentsToEuroDisplay(g.monthlyNeededCents)}/mois nécessaires</span>
                          </div>
                        ) : null}
                        {g.projectedDate && !g.isCompleted ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                            <Target size={12} />
                            <span>Atteint ~{formatProjectedDate(g.projectedDate)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!g.isCompleted && (
                        <div className="flex flex-col">
                          <button type="button" onClick={() => movePriority(g.id, 'up')} className="p-0.5 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors" title="Monter la priorité">
                            <ChevronUp size={16} />
                          </button>
                          <button type="button" onClick={() => movePriority(g.id, 'down')} className="p-0.5 text-[var(--text-faint)] hover:text-[var(--text)] transition-colors" title="Baisser la priorité">
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      )}
                      <span className="text-lg font-bold" style={{ color: g.isCompleted ? 'var(--success)' : 'var(--shell-accent)' }}>
                        {pct} %
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(g)}>Modifier</Button>
                        <Button size="sm" variant="danger" onClick={() => handleDelete(g.id)}>Supprimer</Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: g.isCompleted ? 'var(--success)' : 'var(--accent)',
                      }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ 6. Pour aller plus loin — Cross-links ═══ */}
      <section className="space-y-3 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
        <h2 className="text-lg font-semibold">Pour aller plus loin</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/app/focus" className="group">
            <Card className="p-4 h-full transition-colors hover:bg-[var(--surface-2)]/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <TrendingUp size={16} className="text-amber-500" />
                </div>
                <span className="text-sm font-semibold">Optimisation</span>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Score de santé financière, optimisation de taux et conseils personnalisés.
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--shell-accent)]">
                Voir le diagnostic <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
          <Link href="/app/personal/budgets" className="group">
            <Card className="p-4 h-full transition-colors hover:bg-[var(--surface-2)]/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Wallet size={16} className="text-blue-500" />
                </div>
                <span className="text-sm font-semibold">Budgets</span>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Contrôle tes dépenses et tes charges fixes pour augmenter ta capacité d&apos;épargne.
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--shell-accent)]">
                Gérer mes budgets <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
          <Link href="/app/personal/transactions" className="group">
            <Card className="p-4 h-full transition-colors hover:bg-[var(--surface-2)]/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                  <ArrowRight size={16} className="text-purple-500" />
                </div>
                <span className="text-sm font-semibold">Transactions</span>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                Catégorise tes transactions pour comprendre où passe ton argent.
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--shell-accent)]">
                Voir mes transactions <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        </div>
      </section>

      {/* ══════════ CREATE / EDIT MODAL ══════════ */}
      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editingId ? 'Modifier l\'objectif' : 'Nouvel objectif'}
        description="Fixe un montant cible et une échéance — la progression se calcule automatiquement."
      >
        <div className="space-y-4">
          {saveError ? <p className="text-xs text-[var(--danger)]">{saveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom de l&apos;objectif</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Voyage au Japon"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Montant cible (€)</span>
              <Input
                value={form.targetAmount}
                onChange={(e) => setForm((p) => ({ ...p, targetAmount: sanitizeEuroInput(e.target.value) }))}
                placeholder="3000"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Échéance (optionnel)</span>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Priorité</span>
              <Select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              >
                <option value="3">Haute</option>
                <option value="2">Moyenne</option>
                <option value="1">Basse</option>
                <option value="0">Aucune</option>
              </Select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Épargne mensuelle (optionnel)</span>
              <Input
                value={form.monthlyContribution}
                onChange={(e) => setForm((p) => ({ ...p, monthlyContribution: sanitizeEuroInput(e.target.value) }))}
                placeholder="300"
              />
            </label>
            {savingsAccounts.length > 0 && (
              <label className="col-span-2 text-sm">
                <span className="text-xs text-[var(--text-faint)]">Compte épargne lié (optionnel)</span>
                <Select
                  value={form.accountId}
                  onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
                >
                  <option value="">— Aucun compte —</option>
                  {savingsAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatCentsToEuroDisplay(a.balanceCents)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>

          {/* Auto preview from real data */}
          {form.targetAmount && (() => {
            const target = parseEuroToCents(form.targetAmount.replace(',', '.'));
            const patrimoine = BigInt(totalPatrimoineCents);
            const capacity = BigInt(monthlySavingsCapacityCents);
            if (Number.isFinite(target) && target > 0) {
              const targetBig = BigInt(target);
              const funded = patrimoine > targetBig ? targetBig : patrimoine;
              const remaining = targetBig > funded ? targetBig - funded : 0n;
              const pct = Math.min(100, Math.round(Number((funded * 100n) / targetBig)));
              return (
                <div className="text-xs bg-[var(--surface-2)] rounded-lg px-3 py-2 space-y-1">
                  <p style={{ color: 'var(--accent)' }}>
                    Ton patrimoine couvre déjà {pct} % de cet objectif ({formatCentsToEuroDisplay(funded.toString())} / {formatCentsToEuroDisplay(targetBig.toString())})
                  </p>
                  {remaining > 0n && capacity > 0n ? (
                    <p className="text-[var(--text-faint)]">
                      Il te reste {formatCentsToEuroDisplay(remaining.toString())} — atteignable en ~{formatMonthsHuman(Number(remaining / capacity))}
                    </p>
                  ) : remaining <= 0n ? (
                    <p className="text-[var(--success)]">Cet objectif est déjà couvert par ton patrimoine !</p>
                  ) : null}
                </div>
              );
            }
            return null;
          })()}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
