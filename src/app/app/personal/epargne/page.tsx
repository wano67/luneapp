'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';

type SavingsGoal = {
  id: string;
  name: string;
  targetCents: string;
  currentCents: string;
  deadline: string | null;
  isCompleted: boolean;
};

type FormState = {
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
};

type FeedFormState = {
  amount: string;
};

const EMPTY_FORM: FormState = { name: '', targetAmount: '', currentAmount: '', deadline: '' };
const EMPTY_FEED: FeedFormState = { amount: '' };

function centsToInputValue(cents: string): string {
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

function deadlineToInputDate(deadline: string | null): string {
  if (!deadline) return '';
  return deadline.slice(0, 10);
}

export default function EpargnePage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create/edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Feed modal (alimenter)
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [feedingGoal, setFeedingGoal] = useState<SavingsGoal | null>(null);
  const [feedForm, setFeedForm] = useState<FeedFormState>(EMPTY_FEED);
  const [feedSaving, setFeedSaving] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{ items: SavingsGoal[] }>('/api/personal/savings');
    if (res.ok && res.data) setGoals(res.data.items ?? []);
    else setError(res.error ?? 'Impossible de charger les objectifs.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      const body = {
        name: form.name.trim(),
        targetCents,
        currentCents: Number.isFinite(currentCents) ? currentCents : 0,
        deadline: form.deadline || null,
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
        body: JSON.stringify({
          currentCents: Number(newCurrentCents),
          isCompleted,
        }),
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

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const totalSaved = goals.reduce((s, g) => s + BigInt(g.currentCents), 0n);
  const totalTarget = goals.reduce((s, g) => s + BigInt(g.targetCents), 0n);
  const totalRemaining = totalTarget > totalSaved ? totalTarget - totalSaved : 0n;

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Épargne"
        subtitle="Objectifs d'épargne et progression."
        actions={
          <Button size="sm" onClick={openCreate}>
            Nouvel objectif
          </Button>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Objectifs actifs" value={String(activeGoals.length)} />
        <KpiCard
          label="Total épargné"
          value={formatCentsToEuroDisplay(totalSaved.toString())}
          trend="up"
        />
        <KpiCard
          label="Restant à atteindre"
          value={formatCentsToEuroDisplay(totalRemaining.toString())}
          trend={totalRemaining > 0n ? 'down' : 'up'}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
      ) : goals.length === 0 ? (
        <EmptyState
          title="Aucun objectif"
          description="Crée des objectifs d'épargne pour suivre ta progression vers tes projets."
          action={
            <Button size="sm" onClick={openCreate}>
              Créer un objectif
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const current = BigInt(g.currentCents);
            const target = BigInt(g.targetCents);
            const pct = target > 0n ? Number((current * 100n) / target) : 0;
            return (
              <Card key={g.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{g.name}</p>
                      {g.isCompleted ? (
                        <Badge variant="pro">Atteint</Badge>
                      ) : null}
                      {g.deadline ? (
                        <Badge variant="neutral">{formatDeadline(g.deadline)}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      {formatCentsToEuroDisplay(g.currentCents)} /{' '}
                      {formatCentsToEuroDisplay(g.targetCents)}
                      {' '}
                      <span className="text-[var(--text-faint)]">({Math.min(100, pct)}%)</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!g.isCompleted ? (
                      <Button size="sm" variant="outline" onClick={() => openFeed(g)}>
                        Alimenter
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(g.id)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: g.isCompleted ? 'var(--success)' : 'var(--accent)',
                    }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editingId ? "Modifier l'objectif" : 'Nouvel objectif'}
        description="Définissez un montant cible et une échéance optionnelle."
      >
        <div className="space-y-4">
          {saveError ? <p className="text-xs text-[var(--danger)]">{saveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom de l'objectif</span>
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
                onChange={(e) =>
                  setForm((p) => ({ ...p, targetAmount: sanitizeEuroInput(e.target.value) }))
                }
                placeholder="3000"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Déjà épargné (€)</span>
              <Input
                value={form.currentAmount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, currentAmount: sanitizeEuroInput(e.target.value) }))
                }
                placeholder="0"
              />
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Échéance (optionnel)</span>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Feed modal */}
      <Modal
        open={feedModalOpen}
        onCloseAction={() => setFeedModalOpen(false)}
        title="Alimenter l'objectif"
        description={feedingGoal ? `Ajouter de l'épargne à "${feedingGoal.name}".` : ''}
      >
        <div className="space-y-4">
          {feedError ? <p className="text-xs text-[var(--danger)]">{feedError}</p> : null}
          <label className="text-sm">
            <span className="text-xs text-[var(--text-faint)]">Montant à ajouter (€)</span>
            <Input
              value={feedForm.amount}
              onChange={(e) =>
                setFeedForm((p) => ({ ...p, amount: sanitizeEuroInput(e.target.value) }))
              }
              placeholder="100"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setFeedModalOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleFeed} disabled={feedSaving}>
              {feedSaving ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
