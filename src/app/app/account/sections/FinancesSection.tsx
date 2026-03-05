'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';

type FinancePrefs = {
  defaultCurrency: string;
  defaultTransactionType: string;
  defaultBudgetPeriod: string;
  defaultSubscriptionFrequency: string;
  dashboardPeriodDays: number;
  itemsPerPage: number;
};

const DEFAULTS: FinancePrefs = {
  defaultCurrency: 'EUR',
  defaultTransactionType: 'EXPENSE',
  defaultBudgetPeriod: 'MONTHLY',
  defaultSubscriptionFrequency: 'MONTHLY',
  dashboardPeriodDays: 30,
  itemsPerPage: 50,
};

export function FinancesSection() {
  const { refresh: refreshGlobal } = useUserPreferences();
  const [prefs, setPrefs] = useState<FinancePrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<FinancePrefs & Record<string, unknown>>(
        '/api/account/preferences', {}, ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data) {
        setPrefs({
          defaultCurrency: res.data.defaultCurrency ?? DEFAULTS.defaultCurrency,
          defaultTransactionType: res.data.defaultTransactionType ?? DEFAULTS.defaultTransactionType,
          defaultBudgetPeriod: res.data.defaultBudgetPeriod ?? DEFAULTS.defaultBudgetPeriod,
          defaultSubscriptionFrequency: res.data.defaultSubscriptionFrequency ?? DEFAULTS.defaultSubscriptionFrequency,
          dashboardPeriodDays: res.data.dashboardPeriodDays ?? DEFAULTS.dashboardPeriodDays,
          itemsPerPage: res.data.itemsPerPage ?? DEFAULTS.itemsPerPage,
        });
      }
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    const res = await fetchJson<FinancePrefs>('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });

    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Impossible de sauvegarder.');
      return;
    }
    setInfo('Préférences enregistrées.');
    refreshGlobal();
  }

  const disabled = loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Finances personnelles</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Valeurs par défaut utilisées dans votre espace finances personnelles (wallet, transactions, budgets, abonnements).
        </p>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Select
              label="Devise par défaut"
              value={prefs.defaultCurrency}
              onChange={(e) => setPrefs((p) => ({ ...p, defaultCurrency: e.target.value }))}
              disabled={disabled}
            >
              <option value="EUR">EUR — Euro (€)</option>
              <option value="USD">USD — Dollar ($)</option>
              <option value="GBP">GBP — Livre (£)</option>
              <option value="CHF">CHF — Franc suisse</option>
              <option value="CAD">CAD — Dollar canadien</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Devise utilisée par défaut pour les nouveaux comptes et l&apos;affichage des montants.
            </p>
          </div>

          <div className="space-y-1">
            <Select
              label="Type de transaction"
              value={prefs.defaultTransactionType}
              onChange={(e) => setPrefs((p) => ({ ...p, defaultTransactionType: e.target.value }))}
              disabled={disabled}
            >
              <option value="EXPENSE">Dépense</option>
              <option value="INCOME">Revenu</option>
              <option value="TRANSFER">Transfert</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Type pré-sélectionné lors de la création d&apos;une transaction.
            </p>
          </div>

          <div className="space-y-1">
            <Select
              label="Période budget"
              value={prefs.defaultBudgetPeriod}
              onChange={(e) => setPrefs((p) => ({ ...p, defaultBudgetPeriod: e.target.value }))}
              disabled={disabled}
            >
              <option value="MONTHLY">Mensuel</option>
              <option value="YEARLY">Annuel</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Période par défaut pour les nouveaux budgets.
            </p>
          </div>

          <div className="space-y-1">
            <Select
              label="Fréquence abonnement"
              value={prefs.defaultSubscriptionFrequency}
              onChange={(e) => setPrefs((p) => ({ ...p, defaultSubscriptionFrequency: e.target.value }))}
              disabled={disabled}
            >
              <option value="WEEKLY">Hebdomadaire</option>
              <option value="MONTHLY">Mensuel</option>
              <option value="QUARTERLY">Trimestriel</option>
              <option value="YEARLY">Annuel</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Fréquence par défaut pour les nouveaux abonnements.
            </p>
          </div>

          <div className="space-y-1">
            <Select
              label="Période tableau de bord"
              value={String(prefs.dashboardPeriodDays)}
              onChange={(e) => setPrefs((p) => ({ ...p, dashboardPeriodDays: Number(e.target.value) }))}
              disabled={disabled}
            >
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Période affichée par défaut sur le tableau de bord finances.
            </p>
          </div>

          <div className="space-y-1">
            <Select
              label="Éléments par page"
              value={String(prefs.itemsPerPage)}
              onChange={(e) => setPrefs((p) => ({ ...p, itemsPerPage: Number(e.target.value) }))}
              disabled={disabled}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <p className="text-xs text-[var(--text-secondary)]">
              Nombre d&apos;éléments affichés par page dans les listes.
            </p>
          </div>
        </div>

        <Button type="submit" disabled={disabled}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </Card>
  );
}
