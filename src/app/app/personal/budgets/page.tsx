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

type Category = { id: string; name: string };

type Budget = {
  id: string;
  name: string;
  period: 'MONTHLY' | 'YEARLY';
  limitCents: string;
  spentCents: string;
  category: Category | null;
};

type FormState = {
  name: string;
  limitAmount: string;
  period: 'MONTHLY' | 'YEARLY';
  categoryId: string;
};

const EMPTY_FORM: FormState = { name: '', limitAmount: '', period: 'MONTHLY', categoryId: '' };

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

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, cRes] = await Promise.all([
      fetchJson<{ items: Budget[] }>('/api/personal/budgets'),
      fetchJson<{ items: Category[] }>('/api/personal/categories'),
    ]);
    if (bRes.ok && bRes.data) setBudgets(bRes.data.items ?? []);
    else setError(bRes.error ?? 'Impossible de charger les budgets.');
    if (cRes.ok && cRes.data) setCategories(cRes.data.items ?? []);
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

  function openEdit(b: Budget) {
    setEditingId(b.id);
    setForm({
      name: b.name,
      limitAmount: centsToInputValue(b.limitCents),
      period: b.period,
      categoryId: b.category?.id ?? '',
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const limitCents = parseEuroToCents(form.limitAmount.replace(',', '.'));
      if (!Number.isFinite(limitCents) || limitCents <= 0) {
        setSaveError('Montant invalide.');
        return;
      }
      if (!form.name.trim()) {
        setSaveError('Nom requis.');
        return;
      }
      const body = {
        name: form.name.trim(),
        limitCents,
        period: form.period,
        categoryId: form.categoryId || null,
      };
      const res = editingId
        ? await fetchJson(`/api/personal/budgets/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchJson('/api/personal/budgets', {
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
    const res = await fetchJson(`/api/personal/budgets/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  const totalLimit = budgets.reduce((s, b) => s + BigInt(b.limitCents), 0n);
  const totalSpent = budgets.reduce((s, b) => s + BigInt(b.spentCents), 0n);
  const overBudget = budgets.filter((b) => BigInt(b.spentCents) > BigInt(b.limitCents)).length;

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Budgets"
        subtitle="Suivi de tes enveloppes mensuelles."
        actions={
          <Button size="sm" onClick={openCreate}>
            Nouveau budget
          </Button>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total budgété" value={formatCentsToEuroDisplay(totalLimit.toString())} />
        <KpiCard
          label="Dépensé ce mois"
          value={formatCentsToEuroDisplay(totalSpent.toString())}
          trend={totalSpent > totalLimit ? 'down' : 'up'}
        />
        <KpiCard
          label="Budgets dépassés"
          value={String(overBudget)}
          trend={overBudget > 0 ? 'down' : 'up'}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
      ) : budgets.length === 0 ? (
        <EmptyState
          title="Aucun budget"
          description="Crée des enveloppes pour suivre tes catégories de dépenses."
          action={
            <Button size="sm" onClick={openCreate}>
              Créer un budget
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
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
                    <Button size="sm" variant="outline" onClick={() => openEdit(b)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(b.id)}>
                      Supprimer
                    </Button>
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

      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editingId ? 'Modifier le budget' : 'Nouveau budget'}
        description="Définissez une enveloppe mensuelle ou annuelle par catégorie."
      >
        <div className="space-y-4">
          {saveError ? <p className="text-xs text-[var(--danger)]">{saveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom du budget</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Alimentation"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Montant limite (€)</span>
              <Input
                value={form.limitAmount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, limitAmount: sanitizeEuroInput(e.target.value) }))
                }
                placeholder="500"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Période</span>
              <Select
                value={form.period}
                onChange={(e) =>
                  setForm((p) => ({ ...p, period: e.target.value as 'MONTHLY' | 'YEARLY' }))
                }
              >
                <option value="MONTHLY">Mensuel</option>
                <option value="YEARLY">Annuel</option>
              </Select>
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Catégorie liée (optionnel)</span>
              <Select
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">— Aucune catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
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
    </PageContainer>
  );
}
