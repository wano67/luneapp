'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { Landmark } from 'lucide-react';

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
  currentCents: string;
  deadline: string | null;
  isCompleted: boolean;
  accountId: string | null;
  monthlyContributionCents: string | null;
  account: { id: string; name: string; balanceCents: string } | null;
  monthlyNeededCents: string | null;
  projectedDate: string | null;
  percentComplete: number;
};

type FormState = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
  accountId: string;
  monthlyContribution: string;
};

type FeedFormState = {
  amount: string;
};

const EMPTY_FORM: FormState = {
  name: '', targetAmount: '', currentAmount: '',
  deadline: '', accountId: '', monthlyContribution: '',
};
const EMPTY_FEED: FeedFormState = { amount: '' };

/* ═══ Helpers ═══ */

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

/* ═══ Page ═══ */

export default function EpargnePage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [savingsAccountsTotalCents, setSavingsAccountsTotalCents] = useState('0');
  const [totalSavedCents, setTotalSavedCents] = useState('0');
  const [totalTargetCents, setTotalTargetCents] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Feed modal
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [feedingGoal, setFeedingGoal] = useState<SavingsGoal | null>(null);
  const [feedForm, setFeedForm] = useState<FeedFormState>(EMPTY_FEED);
  const [feedSaving, setFeedSaving] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{
      items: SavingsGoal[];
      savingsAccounts: SavingsAccount[];
      savingsAccountsTotalCents: string;
      totalSavedCents: string;
      totalTargetCents: string;
    }>('/api/personal/savings');
    if (res.ok && res.data) {
      setGoals(res.data.items ?? []);
      setSavingsAccounts(res.data.savingsAccounts ?? []);
      setSavingsAccountsTotalCents(String(res.data.savingsAccountsTotalCents ?? '0'));
      setTotalSavedCents(String(res.data.totalSavedCents ?? '0'));
      setTotalTargetCents(String(res.data.totalTargetCents ?? '0'));
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
      currentAmount: centsToInputValue(g.currentCents),
      deadline: deadlineToInputDate(g.deadline),
      accountId: g.accountId ?? '',
      monthlyContribution: centsToInputValue(g.monthlyContributionCents),
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function openFeed(g: SavingsGoal) {
    setFeedingGoal(g);
    setFeedForm(EMPTY_FEED);
    setFeedError(null);
    setFeedModalOpen(true);
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
      const currentCents = form.currentAmount
        ? parseEuroToCents(form.currentAmount.replace(',', '.'))
        : 0;
      const monthlyContributionCents = form.monthlyContribution
        ? parseEuroToCents(form.monthlyContribution.replace(',', '.'))
        : null;

      const body = {
        name: form.name.trim(),
        targetCents,
        currentCents: Number.isFinite(currentCents) ? currentCents : 0,
        deadline: form.deadline || null,
        accountId: form.accountId || null,
        monthlyContributionCents: monthlyContributionCents && Number.isFinite(monthlyContributionCents) ? monthlyContributionCents : null,
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

  async function handleFeed() {
    if (!feedingGoal) return;
    setFeedError(null);
    setFeedSaving(true);
    try {
      const addCents = parseEuroToCents(feedForm.amount.replace(',', '.'));
      if (!Number.isFinite(addCents) || addCents <= 0) {
        setFeedError('Montant invalide.');
        return;
      }
      const newCurrentCents = BigInt(feedingGoal.currentCents) + BigInt(addCents);
      const newTarget = BigInt(feedingGoal.targetCents);
      const isCompleted = newCurrentCents >= newTarget;
      const res = await fetchJson(`/api/personal/savings/${feedingGoal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCents: Number(newCurrentCents), isCompleted }),
      });
      if (!res.ok) {
        setFeedError(res.error ?? 'Erreur lors de la mise à jour.');
        return;
      }
      setFeedModalOpen(false);
      await load();
    } catch (e) {
      setFeedError(getErrorMessage(e));
    } finally {
      setFeedSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetchJson(`/api/personal/savings/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  /* ═══ Computed ═══ */

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const totalRemaining = BigInt(totalTargetCents) > BigInt(totalSavedCents)
    ? BigInt(totalTargetCents) - BigInt(totalSavedCents)
    : 0n;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Épargne"
        subtitle="Objectifs d'épargne, comptes et projections."
        actions={<Button size="sm" onClick={openCreate}>Nouvel objectif</Button>}
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {/* ── KPIs ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-4">
        <KpiCard label="Épargne en banque" value={formatCentsToEuroDisplay(savingsAccountsTotalCents)} />
        <KpiCard label="Objectifs actifs" value={String(activeGoals.length)} />
        <KpiCard label="Total épargné (objectifs)" value={formatCentsToEuroDisplay(totalSavedCents)} trend="up" />
        <KpiCard
          label="Restant à atteindre"
          value={formatCentsToEuroDisplay(totalRemaining.toString())}
          trend={totalRemaining > 0n ? 'down' : 'up'}
        />
      </div>

      {/* ── Savings accounts scroll ── */}
      {savingsAccounts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Comptes épargne</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {savingsAccounts.map((a) => (
              <Card key={a.id} className="p-4 min-w-[200px] shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={16} className="text-[var(--text-faint)]" />
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                </div>
                <p className="text-lg font-bold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                {a.interestRateBps != null ? (
                  <p className="text-xs text-[var(--text-faint)]">
                    Taux : {(a.interestRateBps / 100).toFixed(2)} %
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Goals list ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Objectifs</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : goals.length === 0 ? (
          <EmptyState
            title="Aucun objectif"
            description="Crée des objectifs d'épargne pour suivre ta progression vers tes projets."
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
                        {g.account ? (
                          <Badge variant="neutral">{g.account.name}</Badge>
                        ) : null}
                        {g.deadline ? (
                          <Badge variant="neutral">{formatDeadline(g.deadline)}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(g.currentCents)} / {formatCentsToEuroDisplay(g.targetCents)}
                        {' '}({pct} %)
                      </p>

                      {/* Projections */}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
                        {g.monthlyNeededCents ? (
                          <span>{formatCentsToEuroDisplay(g.monthlyNeededCents)}/mois nécessaires</span>
                        ) : null}
                        {g.monthlyContributionCents ? (
                          <span>{formatCentsToEuroDisplay(g.monthlyContributionCents)}/mois planifiés</span>
                        ) : null}
                        {g.projectedDate ? (
                          <span>Objectif atteint ~{formatProjectedDate(g.projectedDate)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!g.isCompleted ? (
                        <Button size="sm" variant="outline" onClick={() => openFeed(g)}>Alimenter</Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => openEdit(g)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(g.id)}>Supprimer</Button>
                    </div>
                  </div>

                  {/* Progress bar with deadline marker */}
                  <div className="mt-3 relative">
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: g.isCompleted ? 'var(--success)' : 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════ CREATE / EDIT MODAL ══════════ */}
      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editingId ? 'Modifier l\'objectif' : 'Nouvel objectif'}
        description="Définissez un montant cible, une contribution mensuelle et une échéance."
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
              <span className="text-xs text-[var(--text-faint)]">Déjà épargné (€)</span>
              <Input
                value={form.currentAmount}
                onChange={(e) => setForm((p) => ({ ...p, currentAmount: sanitizeEuroInput(e.target.value) }))}
                placeholder="0"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Contribution mensuelle (€)</span>
              <Input
                value={form.monthlyContribution}
                onChange={(e) => setForm((p) => ({ ...p, monthlyContribution: sanitizeEuroInput(e.target.value) }))}
                placeholder="200"
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

          {/* Auto-calc preview */}
          {form.targetAmount && form.monthlyContribution && (() => {
            const target = parseEuroToCents(form.targetAmount.replace(',', '.'));
            const current = form.currentAmount ? parseEuroToCents(form.currentAmount.replace(',', '.')) : 0;
            const monthly = parseEuroToCents(form.monthlyContribution.replace(',', '.'));
            if (Number.isFinite(target) && Number.isFinite(monthly) && monthly > 0 && target > current) {
              const remaining = target - (Number.isFinite(current) ? current : 0);
              const months = Math.ceil(remaining / monthly);
              const projected = new Date();
              projected.setMonth(projected.getMonth() + months);
              return (
                <p className="text-xs text-[var(--accent)] bg-[var(--surface-2)] rounded-lg px-3 py-2">
                  À ce rythme, objectif atteint vers {projected.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} (~{months} mois)
                </p>
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

      {/* ══════════ FEED MODAL ══════════ */}
      <Modal
        open={feedModalOpen}
        onCloseAction={() => setFeedModalOpen(false)}
        title="Alimenter l'objectif"
        description={feedingGoal ? `Ajouter de l'\u00e9pargne \u00e0 "${feedingGoal.name}".` : ''}
      >
        <div className="space-y-4">
          {feedError ? <p className="text-xs text-[var(--danger)]">{feedError}</p> : null}
          <label className="text-sm">
            <span className="text-xs text-[var(--text-faint)]">Montant à ajouter (€)</span>
            <Input
              value={feedForm.amount}
              onChange={(e) => setFeedForm((p) => ({ ...p, amount: sanitizeEuroInput(e.target.value) }))}
              placeholder="100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setFeedModalOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleFeed} disabled={feedSaving}>
              {feedSaving ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
