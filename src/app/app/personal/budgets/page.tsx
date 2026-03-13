'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { FaviconAvatar } from '@/app/app/components/FaviconAvatar';
import { formatCentsToEuroDisplay, sanitizeEuroInput } from '@/lib/money';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { Plus, Search, ChevronLeft, Zap, PiggyBank, Pencil, Check, X, TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import Link from 'next/link';

import { useBudgetData, toMonthlyCents, toYearlyCents, formatLastSeen, FREQUENCY_LABELS, BUDGET_TEMPLATES } from './useBudgetData';
import { useBudgetForm } from './useBudgetForm';
import { useSubscriptionForm } from './useSubscriptionForm';

/* ═══ Page ═══ */

export default function BudgetsPage() {
  const { prefs } = useUserPreferences();

  const data = useBudgetData();

  const budget = useBudgetForm({
    categories: data.categories,
    defaultBudgetPeriod: prefs.defaultBudgetPeriod,
    load: data.load,
  });

  const sub = useSubscriptionForm({
    defaultSubscriptionFrequency: prefs.defaultSubscriptionFrequency,
    load: data.load,
    loadRecurring: data.loadRecurring,
  });

  /* ═══ Render ═══ */

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Gestion du budget"
        subtitle="Vue d'ensemble de tes finances, budgets et charges."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={sub.openCatalog}>
              <Plus size={14} /> Charge fixe
            </Button>
            <Button size="sm" onClick={budget.openBudgetCreate}>
              <Plus size={14} /> Budget
            </Button>
          </div>
        }
      />

      {data.error ? <p className="text-sm text-[var(--danger)]">{data.error}</p> : null}

      {/* ── KPIs ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenus du mois"
          value={formatCentsToEuroDisplay(data.monthIncomeCents.toString())}
          trend={data.monthIncomeCents > 0n ? 'up' : undefined}
        />
        <KpiCard
          label="Charges fixes / mois"
          value={formatCentsToEuroDisplay(data.totalFixedChargesMonthlyCents.toString())}
        />
        <KpiCard
          label="Dépensé ce mois"
          value={formatCentsToEuroDisplay(data.monthExpenseCents.toString())}
          trend={data.monthExpenseCents > data.totalLimit ? 'down' : 'up'}
        />
        <KpiCard
          label="Hors budget"
          value={formatCentsToEuroDisplay(data.unbudgetedExpenseCents.toString())}
          trend={data.unbudgetedExpenseCents > 0n ? 'down' : 'up'}
        />
      </div>

      {/* ── Synthèse mensuelle ── */}
      {(() => {
        const disponible = data.monthIncomeCents - data.totalFixedChargesMonthlyCents - data.totalLimit - data.totalSavingsBudgetCents;
        const disponiblePositive = disponible >= 0n;
        return (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
              Synthèse mensuelle
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingUp size={14} className="text-[var(--success)]" /> Revenus
                </span>
                <span className="font-semibold text-[var(--success)]">
                  +{formatCentsToEuroDisplay(data.monthIncomeCents.toString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingDown size={14} className="text-[var(--danger)]" /> Charges fixes
                </span>
                <span className="font-medium text-[var(--danger)]">
                  -{formatCentsToEuroDisplay(data.totalFixedChargesMonthlyCents.toString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingDown size={14} className="text-[var(--danger)]" /> Budgets alloués
                </span>
                <span className="font-medium text-[var(--danger)]">
                  -{formatCentsToEuroDisplay(data.totalLimit.toString())}
                </span>
              </div>
              {data.totalSavingsBudgetCents > 0n ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <PiggyBank size={14} className="text-[var(--primary)]" /> Épargne programmée
                  </span>
                  <span className="font-medium text-[var(--primary)]">
                    -{formatCentsToEuroDisplay(data.totalSavingsBudgetCents.toString())}
                  </span>
                </div>
              ) : null}
              <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between">
                <span className="font-semibold">Capacité restante</span>
                <span className={`font-bold text-base ${disponiblePositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {disponiblePositive ? '' : '-'}{formatCentsToEuroDisplay((disponiblePositive ? disponible : -disponible).toString())}
                </span>
              </div>
              {data.unbudgetedExpenseCents > 0n ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="flex items-center gap-1.5 text-[var(--warning)]">
                    <AlertTriangle size={12} /> Dépenses hors budget ce mois
                  </span>
                  <span className="font-semibold text-[var(--warning)]">
                    {formatCentsToEuroDisplay(data.unbudgetedExpenseCents.toString())}
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        );
      })()}

      {data.overBudget > 0 ? (
        <p className="text-sm font-semibold text-[var(--danger)]">
          {data.overBudget} budget{data.overBudget > 1 ? 's' : ''} dépassé{data.overBudget > 1 ? 's' : ''}
        </p>
      ) : null}

      {/* ════════════════ BUDGETS SECTION ════════════════ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Budgets</h2>
        {data.loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : data.budgets.length === 0 ? (
          <EmptyState
            title="Aucun budget"
            description="Crée des enveloppes pour suivre tes catégories de dépenses."
            action={<Button size="sm" onClick={budget.openBudgetCreate}>Créer un budget</Button>}
          />
        ) : (
          <div className="space-y-3">
            {data.budgets.map((b) => {
              const spent = BigInt(b.spentCents);
              const limit = BigInt(b.limitCents);
              const pct = limit > 0n ? Number((spent * 100n) / limit) : 0;
              const over = spent > limit;
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{b.name}</p>
                        {b.category ? <Badge variant="neutral">{b.category.name}</Badge> : null}
                        <Badge variant={b.period === 'MONTHLY' ? 'pro' : 'neutral'}>
                          {b.period === 'MONTHLY' ? 'Mensuel' : 'Annuel'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(b.spentCents)} / {formatCentsToEuroDisplay(b.limitCents)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => budget.openBudgetEdit(b)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => budget.handleBudgetDelete(b.id)}>Supprimer</Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: over ? 'var(--danger)' : 'var(--success)',
                      }}
                    />
                  </div>
                  {over ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
                      Dépassé de {formatCentsToEuroDisplay((spent - limit).toString())}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════ ÉPARGNE PROGRAMMÉE SECTION ════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Épargne programmée</h2>
          </div>
          <Link href="/app/personal/epargne" className="text-xs text-[var(--primary)] hover:underline">
            Gérer les objectifs →
          </Link>
        </div>
        {data.savingsGoals.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-[var(--text-faint)]">
              Aucun objectif d&apos;épargne avec contribution mensuelle.{' '}
              <Link href="/app/personal/epargne" className="text-[var(--primary)] hover:underline">
                Définis tes objectifs
              </Link>{' '}
              et programme un montant mensuel pour chacun.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.savingsGoals.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{g.name}</p>
                      {g.priority >= 2 && <Badge variant="danger">Prioritaire</Badge>}
                      {g.priority === 1 && <Badge variant="neutral">Moyenne</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      Objectif : {formatCentsToEuroDisplay(g.targetCents)}
                      {g.deadline ? ` · Échéance : ${new Date(g.deadline).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {data.editingSavingsId === g.id ? (
                      <>
                        <Input
                          value={data.editingSavingsAmount}
                          onChange={(e) => data.onEditingSavingsAmountChange(e.target.value)}
                          placeholder="0.00"
                          className="w-24 text-right text-sm"
                        />
                        <span className="text-xs text-[var(--text-faint)]">€/mois</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void data.saveSavingsContribution(g.id)}
                          disabled={data.savingSavingsGoal}
                        >
                          <Check size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={data.cancelEditSavings}>
                          <X size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--primary)]">
                          {g.monthlyContributionCents
                            ? `${formatCentsToEuroDisplay(g.monthlyContributionCents)} / mois`
                            : '—'}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => data.startEditSavings(g)}>
                          <Pencil size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            <div className="flex justify-end pt-1">
              <p className="text-sm font-semibold">
                Total : {formatCentsToEuroDisplay(data.totalSavingsBudgetCents.toString())} / mois
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════ CHARGES FIXES SECTION ════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Charges fixes</h2>
          <Button size="sm" variant="outline" onClick={sub.openCatalog}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>
        {data.loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : data.subscriptions.length === 0 ? (
          <EmptyState
            title="Aucune charge fixe"
            description="Ajoute tes abonnements et charges récurrentes pour calculer ta capacité d'épargne."
            action={
              <Button size="sm" onClick={sub.openCatalog}>
                Ajouter un abonnement
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.subscriptions.map((s) => {
              const monthly = toMonthlyCents(s.amountCents, s.frequency);
              return (
                <Card key={s.id} className="p-4" style={s.isActive ? undefined : { opacity: 0.6 }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{s.name}</p>
                        <Badge variant={s.isActive ? 'pro' : 'neutral'}>
                          {s.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Badge variant="neutral">{FREQUENCY_LABELS[s.frequency] ?? s.frequency}</Badge>
                        {s.category ? <Badge variant="neutral">{s.category.name}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(s.amountCents)} / {FREQUENCY_LABELS[s.frequency]?.toLowerCase() ?? s.frequency}
                        {s.frequency !== 'MONTHLY' ? ` · ${formatCentsToEuroDisplay(monthly.toString())} / mois` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => sub.openSubEdit(s)}>Modifier</Button>
                      <Button size="sm" variant="outline" onClick={() => sub.handleSubToggleActive(s)}>
                        {s.isActive ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => sub.handleSubDelete(s.id)}>Supprimer</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════ DÉPENSES RÉCURRENTES DÉTECTÉES ════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-[var(--warning)]" />
          <h2 className="text-lg font-semibold">Dépenses récurrentes détectées</h2>
        </div>
        <p className="text-xs text-[var(--text-faint)] mb-3">
          Analyse automatique de tes transactions des 12 derniers mois. Ajoute-les en charges fixes pour mieux suivre ton budget.
        </p>
        {data.recurringLoading ? (
          <p className="text-sm text-[var(--text-faint)]">Analyse en cours…</p>
        ) : data.recurring.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            Aucune dépense récurrente détectée pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {data.recurring.map((r) => {
              const monthly = toMonthlyCents(r.estimatedAmountCents, r.estimatedFrequency);
              const yearly = toYearlyCents(r.estimatedAmountCents, r.estimatedFrequency);
              const impactPct = data.monthExpenseCents > 0n
                ? Number((monthly * 100n) / data.monthExpenseCents)
                : 0;
              return (
                <Card key={r.label} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-base font-semibold capitalize">{r.label}</p>
                        {r.categoryName ? <Badge variant="neutral">{r.categoryName}</Badge> : null}
                      </div>

                      {/* Données clés mises en évidence */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Coût mensuel</p>
                          <p className="text-sm font-bold text-[var(--danger)]">
                            ~{formatCentsToEuroDisplay(monthly.toString())}
                          </p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Coût annuel</p>
                          <p className="text-sm font-bold text-[var(--text)]">
                            ~{formatCentsToEuroDisplay(yearly.toString())}
                          </p>
                        </div>
                        {impactPct > 0 ? (
                          <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Impact budget</p>
                            <p className="text-sm font-bold text-[var(--warning)]">
                              {impactPct}% des dépenses
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* Détails */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-faint)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {FREQUENCY_LABELS[r.estimatedFrequency]}
                        </span>
                        <span>·</span>
                        <span>{r.occurrences} occurrence{r.occurrences > 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>Dernière : {formatLastSeen(r.lastSeen)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {data.budgets.filter((b) => b.category).length > 0 && (
                        <Select
                          value=""
                          onChange={(e) => { if (e.target.value) data.linkRecurringToBudget(r.label, e.target.value); }}
                          disabled={data.linkingLabel === r.label}
                          className="h-8 w-44 rounded-lg text-xs"
                        >
                          <option value="">
                            {data.linkingLabel === r.label ? 'Association…' : 'Associer à un budget'}
                          </option>
                          {data.budgets.filter((b) => b.category).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </Select>
                      )}
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => sub.addRecurringAsSub(r)}>
                        <Plus size={14} /> Charge fixe
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Total estimé */}
            {(() => {
              const totalMonthly = data.recurring.reduce(
                (sum, r) => sum + toMonthlyCents(r.estimatedAmountCents, r.estimatedFrequency), 0n,
              );
              const totalYearly = data.recurring.reduce(
                (sum, r) => sum + toYearlyCents(r.estimatedAmountCents, r.estimatedFrequency), 0n,
              );
              return (
                <Card className="p-4 border-dashed">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">
                      Total estimé des dépenses récurrentes non suivies
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span className="font-bold text-[var(--danger)]">
                        ~{formatCentsToEuroDisplay(totalMonthly.toString())} / mois
                      </span>
                      <span className="font-semibold text-[var(--text-faint)]">
                        ~{formatCentsToEuroDisplay(totalYearly.toString())} / an
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}
      </section>

      {/* ══════════ CATALOG PICKER MODAL ══════════ */}
      <Modal
        open={sub.catalogOpen}
        onCloseAction={() => { sub.closeCatalog(); data.setCatalogSearch(''); }}
        title={sub.selectedProvider ? sub.selectedProvider.name : 'Ajouter une charge fixe'}
        description={sub.selectedProvider ? 'Choisis un abonnement.' : 'Choisis un service ou crée un abonnement personnalisé.'}
      >
        {sub.selectedProvider ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={sub.clearSelectedProvider}
              className="flex items-center gap-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft size={16} /> Retour
            </button>
            <div className="flex items-center gap-3 mb-2">
              <FaviconAvatar name={sub.selectedProvider.name} websiteUrl={sub.selectedProvider.websiteUrl} size={36} />
              <p className="font-semibold">{sub.selectedProvider.name}</p>
            </div>
            <div className="space-y-2">
              {sub.selectedProvider.plans.map((plan) => (
                <button
                  key={plan.label}
                  type="button"
                  onClick={() => sub.openSubFromPlan(sub.selectedProvider!, plan)}
                  className="flex items-center justify-between w-full rounded-xl border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <p className="text-sm font-semibold">{plan.label}</p>
                  <p className="text-sm text-[var(--text-faint)]">
                    {(plan.defaultCents / 100).toFixed(2).replace('.', ',')} € / {plan.frequency === 'YEARLY' ? 'an' : 'mois'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                value={data.catalogSearch}
                onChange={(e) => data.setCatalogSearch(e.target.value)}
                placeholder="Rechercher un service…"
                className="pl-9"
              />
            </div>
            <button
              type="button"
              onClick={sub.openManualCreate}
              className="flex items-center gap-3 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={16} className="text-[var(--text-faint)]" />
              Saisie manuelle
            </button>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {Array.from(data.catalogGrouped.entries()).map(([cat, providers]) => (
                <div key={cat}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        onClick={() => sub.handleProviderClick(provider)}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <FaviconAvatar name={provider.name} websiteUrl={provider.websiteUrl} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{provider.name}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {provider.plans.length} offre{provider.plans.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {data.catalogGrouped.size === 0 ? (
                <p className="text-sm text-[var(--text-faint)] text-center py-4">Aucun résultat</p>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════ SUBSCRIPTION FORM MODAL ══════════ */}
      <Modal
        open={sub.subModalOpen}
        onCloseAction={sub.closeSubModal}
        title={sub.subEditingId ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'}
        description="Déclare une charge fixe ou récurrente."
      >
        <div className="space-y-4">
          {sub.subSaveError ? <p className="text-xs text-[var(--danger)]">{sub.subSaveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom du service</span>
              <Input
                value={sub.subForm.name}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Netflix, Loyer, Assurance"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Montant (€)</span>
              <Input
                value={sub.subForm.amount}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, amount: sanitizeEuroInput(e.target.value) }))}
                placeholder="15.99"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Fréquence</span>
              <Select
                value={sub.subForm.frequency}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, frequency: e.target.value as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' }))}
              >
                <option value="WEEKLY">Hebdomadaire</option>
                <option value="MONTHLY">Mensuel</option>
                <option value="QUARTERLY">Trimestriel</option>
                <option value="YEARLY">Annuel</option>
              </Select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Date de début</span>
              <Input
                type="date"
                value={sub.subForm.startDate}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Date de fin (optionnel)</span>
              <Input
                type="date"
                value={sub.subForm.endDate}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Catégorie (optionnel)</span>
              <Select
                value={sub.subForm.categoryId}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">— Aucune catégorie —</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Note (optionnel)</span>
              <Input
                value={sub.subForm.note}
                onChange={(e) => sub.setSubForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ex: Engagement 12 mois"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={sub.closeSubModal}>Annuler</Button>
            <Button size="sm" onClick={sub.handleSubSave} disabled={sub.subSaving}>
              {sub.subSaving ? 'Enregistrement…' : sub.subEditingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════ BUDGET FORM MODAL ══════════ */}
      <Modal
        open={budget.budgetModalOpen}
        onCloseAction={budget.closeBudgetModal}
        title={
          budget.budgetEditingId
            ? 'Modifier le budget'
            : budget.budgetPickerStep === 'picker'
              ? 'Nouveau budget'
              : `Budget : ${budget.budgetForm.name || 'Personnalisé'}`
        }
        description={
          budget.budgetEditingId
            ? 'Modifiez votre enveloppe budgétaire.'
            : budget.budgetPickerStep === 'picker'
              ? 'Choisissez un type de budget ou créez le vôtre.'
              : 'Ajustez le montant et la catégorie liée.'
        }
      >
        {budget.budgetPickerStep === 'picker' && !budget.budgetEditingId ? (
          <div className="space-y-4">
            {/* Custom budget button */}
            <button
              type="button"
              onClick={budget.openBudgetCustom}
              className="flex items-center gap-3 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={16} className="text-[var(--text-faint)]" />
              Budget personnalisé
            </button>

            {/* Template grid by category */}
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {BUDGET_TEMPLATES.map((group) => (
                <div key={group.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">
                    {group.category}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map((tpl) => {
                      const alreadyExists = data.budgets.some(
                        (b) => b.name.toLowerCase() === tpl.name.toLowerCase(),
                      );
                      return (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => budget.selectBudgetTemplate(tpl)}
                          disabled={alreadyExists}
                          className={`flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-colors ${alreadyExists ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-hover)]'}`}
                        >
                          <span className="text-xl">{tpl.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{tpl.name}</p>
                            <p className="text-xs text-[var(--text-faint)]">
                              ~{(tpl.suggestedCents / 100).toFixed(0)} € / mois
                            </p>
                          </div>
                          {alreadyExists && (
                            <span className="shrink-0 text-[10px] font-medium text-[var(--success)]">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!budget.budgetEditingId && (
              <button
                type="button"
                onClick={budget.goBackToPicker}
                className="flex items-center gap-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
              >
                <ChevronLeft size={16} /> Retour aux suggestions
              </button>
            )}
            {budget.budgetSaveError ? <p className="text-xs text-[var(--danger)]">{budget.budgetSaveError}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="col-span-2 text-sm">
                <span className="text-xs text-[var(--text-faint)]">Nom du budget</span>
                <Input
                  value={budget.budgetForm.name}
                  onChange={(e) => budget.setBudgetForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Alimentation"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--text-faint)]">Montant limite (€)</span>
                <Input
                  value={budget.budgetForm.limitAmount}
                  onChange={(e) => budget.setBudgetForm((p) => ({ ...p, limitAmount: sanitizeEuroInput(e.target.value) }))}
                  placeholder="500"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--text-faint)]">Période</span>
                <Select
                  value={budget.budgetForm.period}
                  onChange={(e) => budget.setBudgetForm((p) => ({ ...p, period: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="YEARLY">Annuel</option>
                </Select>
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-xs text-[var(--text-faint)]">Catégorie liée (optionnel)</span>
                <Select
                  value={budget.budgetForm.categoryId}
                  onChange={(e) => budget.setBudgetForm((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">— Aucune catégorie —</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={budget.closeBudgetModal}>Annuler</Button>
              <Button size="sm" onClick={budget.handleBudgetSave} disabled={budget.budgetSaving}>
                {budget.budgetSaving ? 'Enregistrement…' : budget.budgetEditingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
