import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/app/app/pro/pro-data';
import { sanitizeEuroInput } from '@/lib/money';
import type { Finance, PaymentMethod } from '@/components/pro/finances/finance-types';
import { METHOD_OPTIONS, formatFinanceDate } from '@/components/pro/finances/finance-types';

type RecurringRuleFormState = {
  amount: string;
  category: string;
  vendor: string;
  method: PaymentMethod;
  startDate: string;
  endDate: string;
  dayOfMonth: string;
  isActive: boolean;
};

type RecurringOccurrence = Finance;

type Props = {
  open: boolean;
  onClose: () => void;
  rule: { id: string } | null;
  occurrences: RecurringOccurrence[];
  form: RecurringRuleFormState;
  setForm: React.Dispatch<React.SetStateAction<RecurringRuleFormState>>;
  applyFuture: boolean;
  setApplyFuture: (v: boolean) => void;
  recalculate: boolean;
  setRecalculate: (v: boolean) => void;
  horizonMonths: string;
  setHorizonMonths: (v: string) => void;
  loading: boolean;
  error: string | null;
  onSave: () => void;
  onEditOccurrence: (occ: Finance) => void;
};

export function RecurringRuleModal({
  open,
  onClose,
  rule,
  occurrences,
  form,
  setForm,
  applyFuture,
  setApplyFuture,
  recalculate,
  setRecalculate,
  horizonMonths,
  setHorizonMonths,
  loading,
  error,
  onSave,
  onEditOccurrence,
}: Props) {
  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Règle de récurrence"
      description="Modifie la règle et les occurrences futures."
    >
      <div className="space-y-4">
        {loading ? <p className="text-xs text-[var(--text-secondary)]">Chargement…</p> : null}
        {error ? <p className="text-xs text-rose-500">{error}</p> : null}
        {rule ? (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Montant (€)</span>
                <Input
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: sanitizeEuroInput(e.target.value) }))
                  }
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Libellé</span>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Fournisseur</span>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Mode</span>
                <Select
                  value={form.method}
                  onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}
                >
                  {METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Date de début</span>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Date de fin</span>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Jour de facturation</span>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border border-[var(--border)]"
                />
                <span>Règle active</span>
              </label>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-3 text-xs text-[var(--text-secondary)]">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={applyFuture}
                    onChange={(e) => setApplyFuture(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  <span>Appliquer aux occurrences futures</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recalculate}
                    onChange={(e) => setRecalculate(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  <span>Recalculer (re-générer)</span>
                </label>
                <label className="flex items-center gap-2">
                  <span>Horizon</span>
                  <Input
                    className="w-20"
                    value={horizonMonths}
                    onChange={(e) => setHorizonMonths(e.target.value)}
                    type="number"
                    min={1}
                    max={36}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              <Button size="sm" onClick={onSave} disabled={loading}>
                {loading ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                Occurrences
              </p>
              <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                {occurrences.length ? (
                  occurrences.map((occ) => (
                    <div
                      key={occ.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="text-[var(--text-primary)]">
                          {formatFinanceDate(occ.date)} · {formatCurrency(Number(occ.amountCents) / 100)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {occ.isRuleOverride ? 'Modifiée' : 'Automatique'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditOccurrence(occ)}
                      >
                        Modifier
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">Aucune occurrence.</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
