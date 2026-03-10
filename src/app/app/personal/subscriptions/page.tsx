'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { SUBSCRIPTION_PROVIDERS, groupProvidersByCategory, type SubscriptionProvider, type SubscriptionPlan } from '@/config/commonSubscriptions';
import { Plus, Search, ChevronLeft } from 'lucide-react';

type Category = { id: string; name: string };

type Subscription = {
  id: string;
  name: string;
  amountCents: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  note: string | null;
  category: Category | null;
};

type FormState = {
  name: string;
  amount: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  categoryId: string;
  note: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  amount: '',
  frequency: 'MONTHLY',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  categoryId: '',
  note: '',
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdo',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

function toMonthlyCents(amountCents: string, freq: string): bigint {
  const a = BigInt(amountCents);
  switch (freq) {
    case 'WEEKLY':    return (a * 52n) / 12n;
    case 'QUARTERLY': return (a * 4n) / 12n;
    case 'YEARLY':    return a / 12n;
    default:          return a;
  }
}

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

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function SubscriptionsPage() {
  const { prefs } = useUserPreferences();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Catalog picker
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SubscriptionProvider | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, cRes] = await Promise.all([
      fetchJson<{ items: Subscription[] }>('/api/personal/subscriptions'),
      fetchJson<{ items: Category[] }>('/api/personal/categories'),
    ]);
    if (sRes.ok && sRes.data) setSubscriptions(sRes.data.items ?? []);
    else setError(sRes.error ?? 'Impossible de charger les abonnements.');
    if (cRes.ok && cRes.data) setCategories(cRes.data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, frequency: prefs.defaultSubscriptionFrequency as FormState['frequency'] });
    setSaveError(null);
    setModalOpen(true);
  }

  function openCreateFromPlan(provider: SubscriptionProvider, plan: SubscriptionPlan) {
    setCatalogOpen(false);
    setCatalogSearch('');
    setSelectedProvider(null);
    setEditingId(null);
    setForm({
      name: provider.plans.length === 1 ? provider.name : `${provider.name} — ${plan.label}`,
      amount: (plan.defaultCents / 100).toFixed(2),
      frequency: plan.frequency,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      categoryId: '',
      note: '',
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function handleProviderClick(provider: SubscriptionProvider) {
    if (provider.plans.length === 1) {
      openCreateFromPlan(provider, provider.plans[0]);
    } else {
      setSelectedProvider(provider);
    }
  }

  function openManualCreate() {
    setCatalogOpen(false);
    setCatalogSearch('');
    setSelectedProvider(null);
    openCreate();
  }

  function openEdit(s: Subscription) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      amount: centsToInputValue(s.amountCents),
      frequency: s.frequency,
      startDate: toDateInput(s.startDate),
      endDate: toDateInput(s.endDate),
      categoryId: s.category?.id ?? '',
      note: s.note ?? '',
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const amountCents = parseEuroToCents(form.amount.replace(',', '.'));
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setSaveError('Montant invalide.');
        return;
      }
      if (!form.name.trim()) {
        setSaveError('Nom requis.');
        return;
      }
      if (!form.startDate) {
        setSaveError('Date de début requise.');
        return;
      }

      const body = {
        name: form.name.trim(),
        amountCents,
        frequency: form.frequency,
        startDate: form.startDate,
        endDate: form.endDate || null,
        categoryId: form.categoryId || null,
        note: form.note.trim() || null,
      };

      const res = editingId
        ? await fetchJson(`/api/personal/subscriptions/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchJson('/api/personal/subscriptions', {
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

  async function handleToggleActive(s: Subscription) {
    await fetchJson(`/api/personal/subscriptions/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    await load();
  }

  async function handleDelete(id: string) {
    const res = await fetchJson(`/api/personal/subscriptions/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  }

  const activeSubs = subscriptions.filter((s) => s.isActive);
  const totalMonthlyCents = activeSubs.reduce(
    (acc, s) => acc + toMonthlyCents(s.amountCents, s.frequency),
    0n
  );

  const catalogGrouped = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    const filtered = q
      ? SUBSCRIPTION_PROVIDERS.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : SUBSCRIPTION_PROVIDERS;
    return groupProvidersByCategory(filtered);
  }, [catalogSearch]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title="Abonnements"
        subtitle="Charges fixes et dépenses récurrentes."
        actions={
          <Button size="sm" onClick={() => setCatalogOpen(true)}>
            Nouvel abonnement
          </Button>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <KpiCard label="Abonnements actifs" value={String(activeSubs.length)} />
        <KpiCard label="Charges fixes / mois" value={formatCentsToEuroDisplay(totalMonthlyCents.toString())} />
        <KpiCard label="Charges fixes / an" value={formatCentsToEuroDisplay((totalMonthlyCents * 12n).toString())} />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          title="Aucun abonnement"
          description="Ajoute tes charges fixes pour calculer ta capacité d'épargne."
          action={
            <Button size="sm" onClick={() => setCatalogOpen(true)}>
              Ajouter un abonnement
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {subscriptions.map((s) => {
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
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(s)}>
                      {s.isActive ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(s.id)}>
                      Supprimer
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Catalog picker modal ── */}
      <Modal
        open={catalogOpen}
        onCloseAction={() => { setCatalogOpen(false); setCatalogSearch(''); setSelectedProvider(null); }}
        title={selectedProvider ? selectedProvider.name : 'Ajouter un abonnement'}
        description={selectedProvider ? 'Choisis un abonnement.' : 'Choisis un service ou crée un abonnement personnalisé.'}
      >
        {selectedProvider ? (
          /* ── Step 2: Plans for selected provider ── */
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="flex items-center gap-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft size={16} />
              Retour
            </button>
            <div className="flex items-center gap-3 mb-2">
              <FaviconAvatar name={selectedProvider.name} websiteUrl={selectedProvider.websiteUrl} size={36} />
              <p className="font-semibold">{selectedProvider.name}</p>
            </div>
            <div className="space-y-2">
              {selectedProvider.plans.map((plan) => (
                <button
                  key={plan.label}
                  type="button"
                  onClick={() => openCreateFromPlan(selectedProvider, plan)}
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
          /* ── Step 1: Provider list ── */
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Rechercher un service…"
                className="pl-9"
              />
            </div>

            <button
              type="button"
              onClick={openManualCreate}
              className="flex items-center gap-3 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={16} className="text-[var(--text-faint)]" />
              Saisie manuelle
            </button>

            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {Array.from(catalogGrouped.entries()).map(([cat, providers]) => (
                <div key={cat}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        onClick={() => handleProviderClick(provider)}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <FaviconAvatar
                          name={provider.name}
                          websiteUrl={provider.websiteUrl}
                          size={28}
                        />
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
              {catalogGrouped.size === 0 ? (
                <p className="text-sm text-[var(--text-faint)] text-center py-4">Aucun résultat</p>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Form modal ── */}
      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editingId ? 'Modifier l\'abonnement' : 'Nouvel abonnement'}
        description="Déclare une charge fixe ou récurrente."
      >
        <div className="space-y-4">
          {saveError ? <p className="text-xs text-[var(--danger)]">{saveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom du service</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Netflix, Loyer, Assurance"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Montant (€)</span>
              <Input
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: sanitizeEuroInput(e.target.value) }))}
                placeholder="15.99"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Fréquence</span>
              <Select
                value={form.frequency}
                onChange={(e) =>
                  setForm((p) => ({ ...p, frequency: e.target.value as FormState['frequency'] }))
                }
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
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Date de fin (optionnel)</span>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Catégorie (optionnel)</span>
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
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Note (optionnel)</span>
              <Input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ex: Engagement 12 mois"
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
    </PageContainer>
  );
}
