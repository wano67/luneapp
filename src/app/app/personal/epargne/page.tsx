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
import { Landmark, TrendingUp } from 'lucide-react';

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
  projectedDate: string | null;
  percentComplete: number;
};

type FormState = {
  name: string;
  targetAmount: string;
  deadline: string;
  accountId: string;
};

const EMPTY_FORM: FormState = { name: '', targetAmount: '', deadline: '', accountId: '' };

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
      const body = {
        name: form.name.trim(),
        targetCents,
        deadline: form.deadline || null,
        accountId: form.accountId || null,
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

  /* ═══ Computed ═══ */

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const capacityBigInt = BigInt(monthlySavingsCapacityCents);
  const remainingBigInt = BigInt(totalRemainingCents);

  // Months to reach all goals at current capacity
  const monthsToReachAll = capacityBigInt > 0n && remainingBigInt > 0n
    ? Number(remainingBigInt / capacityBigInt)
    : null;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Épargne"
        subtitle="Objectifs d'épargne, comptes et projections."
        actions={<Button size="sm" onClick={openCreate}>Nouvel objectif</Button>}
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {/* ── KPIs ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-5">
        <KpiCard label="Patrimoine total" value={formatCentsToEuroDisplay(totalPatrimoineCents)} />
        <KpiCard label="Épargne en banque" value={formatCentsToEuroDisplay(savingsAccountsTotalCents)} />
        <KpiCard label="Investissements" value={formatCentsToEuroDisplay(investAccountsTotalCents)} />
        <KpiCard
          label="Capacité d'épargne / mois"
          value={formatCentsToEuroDisplay(monthlySavingsCapacityCents)}
          trend={capacityBigInt > 0n ? 'up' : 'down'}
        />
        <KpiCard
          label="Restant à atteindre"
          value={formatCentsToEuroDisplay(totalRemainingCents)}
          trend={remainingBigInt > 0n ? 'down' : 'up'}
        />
      </div>

      {/* Summary projection */}
      {activeGoals.length > 0 && (
        <Card className="p-4 bg-[var(--surface-2)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {formatCentsToEuroDisplay(totalPatrimoineCents)} épargnés sur {formatCentsToEuroDisplay(totalTargetCents)} d&apos;objectifs
              </p>
              {monthsToReachAll != null && monthsToReachAll > 0 ? (
                <p className="text-xs text-[var(--text-faint)] mt-0.5">
                  À votre rythme actuel ({formatCentsToEuroDisplay(monthlySavingsCapacityCents)}/mois), tous vos objectifs seront atteints dans ~{monthsToReachAll} mois
                </p>
              ) : remainingBigInt <= 0n ? (
                <p className="text-xs text-[var(--success)] mt-0.5">
                  Votre patrimoine couvre l&apos;ensemble de vos objectifs
                </p>
              ) : null}
            </div>
            {totalTargetCents !== '0' && (
              <p className="text-2xl font-bold" style={{ color: remainingBigInt <= 0n ? 'var(--success)' : 'var(--accent)' }}>
                {Math.min(100, Math.round(Number((BigInt(totalPatrimoineCents) * 100n) / BigInt(totalTargetCents))))} %
              </p>
            )}
          </div>
          {totalTargetCents !== '0' && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round(Number((BigInt(totalPatrimoineCents) * 100n) / BigInt(totalTargetCents))))}%`,
                  backgroundColor: remainingBigInt <= 0n ? 'var(--success)' : 'var(--accent)',
                }}
              />
            </div>
          )}
        </Card>
      )}

      {/* ── Accounts scroll ── */}
      {(savingsAccounts.length > 0 || investAccounts.length > 0) && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Comptes épargne & investissement</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {savingsAccounts.map((a) => (
              <Card key={a.id} className="p-4 min-w-[200px] shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <Landmark size={16} className="text-[var(--text-faint)]" />
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                </div>
                <p className="text-lg font-bold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="neutral">Épargne</Badge>
                  {a.interestRateBps != null ? (
                    <span className="text-xs text-[var(--text-faint)]">
                      {(a.interestRateBps / 100).toFixed(2)} %
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
            {investAccounts.map((a) => (
              <Card key={a.id} className="p-4 min-w-[200px] shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-[var(--text-faint)]" />
                  <p className="text-sm font-semibold truncate">{a.name}</p>
                </div>
                <p className="text-lg font-bold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="pro">Investissement</Badge>
                  {a.interestRateBps != null ? (
                    <span className="text-xs text-[var(--text-faint)]">
                      {(a.interestRateBps / 100).toFixed(2)} %
                    </span>
                  ) : null}
                </div>
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
            description="Fixe-toi des objectifs d'épargne — la progression se calcule automatiquement depuis tes comptes."
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
                        {g.account ? <Badge variant="neutral">{g.account.name}</Badge> : null}
                        {g.deadline ? <Badge variant="neutral">{formatDeadline(g.deadline)}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(g.fundedCents)} / {formatCentsToEuroDisplay(g.targetCents)}
                        {' '}({pct} %)
                      </p>

                      {/* Projections */}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
                        {g.monthlyNeededCents ? (
                          <span>{formatCentsToEuroDisplay(g.monthlyNeededCents)}/mois nécessaires</span>
                        ) : null}
                        {g.projectedDate ? (
                          <span>Objectif atteint ~{formatProjectedDate(g.projectedDate)}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(g)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(g.id)}>Supprimer</Button>
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
                    Votre patrimoine couvre déjà {pct} % de cet objectif ({formatCentsToEuroDisplay(funded.toString())} / {formatCentsToEuroDisplay(targetBig.toString())})
                  </p>
                  {remaining > 0n && capacity > 0n ? (
                    <p className="text-[var(--text-faint)]">
                      Il vous reste {formatCentsToEuroDisplay(remaining.toString())} — atteignable en ~{Number(remaining / capacity)} mois à votre rythme actuel
                    </p>
                  ) : remaining <= 0n ? (
                    <p className="text-[var(--success)]">Cet objectif est déjà couvert par votre patrimoine !</p>
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
