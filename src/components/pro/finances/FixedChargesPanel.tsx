'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useRecurringRule } from '@/components/pro/finances/hooks/useRecurringRule';
import { RecurringRuleModal } from '@/components/pro/finances/modals/RecurringRuleModal';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type RecurringRule = {
  id: string;
  type: string;
  amountCents: string;
  category: string;
  vendor: string | null;
  method: string | null;
  frequency: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
};

export function FixedChargesPanel({ businessId }: { businessId: string }) {
  const active = useActiveBusiness({ optional: true });
  const role = active?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ items: RecurringRule[] }>(
        `/api/pro/businesses/${businessId}/finances/recurring`
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Impossible de charger les charges fixes.');
        setRules([]);
        return;
      }
      setRules(res.data.items ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const {
    recurringModalOpen,
    setRecurringModalOpen,
    recurringRule,
    recurringOccurrences,
    recurringRuleForm,
    setRecurringRuleForm,
    recurringApplyFuture,
    setRecurringApplyFuture,
    recurringRecalculate,
    setRecurringRecalculate,
    recurringHorizonMonths,
    setRecurringHorizonMonths,
    recurringRuleLoading,
    recurringRuleError,
    openRecurringRule,
    openCreateRecurringRule,
    handleSaveRecurringRule,
    handleCreateRecurringRule,
    isCreateMode,
  } = useRecurringRule({ businessId, loadFinances: loadRules });

  // KPIs
  const activeRules = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);
  const monthlyTotalCents = activeRules
    .filter((r) => r.frequency === 'MONTHLY')
    .reduce((acc, r) => acc + Number(r.amountCents), 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Total mensuel estimé</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{formatCents(monthlyTotalCents)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Charges actives</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{activeRules.length}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-[var(--text-secondary)]">Inactives</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{inactiveRules.length}</p>
        </Card>
      </div>

      {/* Actions */}
      {isAdmin ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={openCreateRecurringRule}>
            Nouvelle charge fixe
          </Button>
        </div>
      ) : null}

      {/* Error */}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {/* Loading */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
      ) : rules.length === 0 ? (
        <Card className="border-dashed p-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Aucune charge fixe. Ajoutez-en une pour suivre vos frais récurrents.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border)]/70 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {rule.category}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {rule.vendor ?? '—'} · Jour {rule.dayOfMonth} · {rule.frequency === 'MONTHLY' ? 'Mensuel' : 'Annuel'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {formatCents(Number(rule.amountCents))}
                </p>
                <Badge variant={rule.isActive ? 'pro' : 'neutral'}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {isAdmin ? (
                  <Button size="sm" variant="outline" onClick={() => openRecurringRule(rule.id)}>
                    Modifier
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <RecurringRuleModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        rule={recurringRule}
        occurrences={recurringOccurrences}
        form={recurringRuleForm}
        setForm={setRecurringRuleForm}
        applyFuture={recurringApplyFuture}
        setApplyFuture={setRecurringApplyFuture}
        recalculate={recurringRecalculate}
        setRecalculate={setRecurringRecalculate}
        horizonMonths={recurringHorizonMonths}
        setHorizonMonths={setRecurringHorizonMonths}
        loading={recurringRuleLoading}
        error={recurringRuleError}
        onSave={isCreateMode ? handleCreateRecurringRule : handleSaveRecurringRule}
        onEditOccurrence={() => {/* handled via FinanceEntriesPanel */}}
      />
    </div>
  );
}
