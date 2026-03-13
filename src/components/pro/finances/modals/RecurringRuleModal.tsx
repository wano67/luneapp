import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';
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
  frequency: 'MONTHLY' | 'YEARLY';
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
  onDelete?: () => void;
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
  onDelete,
  onEditOccurrence,
}: Props) {
  const isCreateMode = !rule;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const billingHint = useMemo(() => {
    if (!form.startDate) return null;
    const d = new Date(form.startDate);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getDate();
    if (form.frequency === 'YEARLY') {
      const monthName = d.toLocaleDateString('fr-FR', { month: 'long' });
      return `Facturation le ${day} ${monthName} de chaque année`;
    }
    return `Facturation le ${day} de chaque mois`;
  }, [form.startDate, form.frequency]);

  function handleClose() {
    setConfirmDelete(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onCloseAction={handleClose}
      title={isCreateMode ? 'Nouvelle charge fixe' : 'Modifier la charge fixe'}
      description={isCreateMode ? 'Créer une nouvelle charge récurrente.' : 'Modifier la règle et ses occurrences futures.'}
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-xl bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {loading && !rule && !isCreateMode ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : (
          <>
            {/* Form fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Montant (€)</span>
                <Input
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: sanitizeEuroInput(e.target.value) }))
                  }
                  placeholder="0,00"
                  disabled={loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Libellé</span>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Ex: Loyer, Assurance…"
                  disabled={loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Fournisseur</span>
                <Input
                  value={form.vendor}
                  onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  placeholder="Optionnel"
                  disabled={loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Mode de paiement</span>
                <Select
                  value={form.method}
                  onChange={(e) => setForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}
                  disabled={loading}
                >
                  {METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Date de début</span>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  disabled={loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Date de fin</span>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  disabled={loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Fréquence</span>
                <Select
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                  disabled={loading}
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="YEARLY">Annuel</option>
                </Select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border border-[var(--border)] accent-[var(--shell-accent)]"
                  disabled={loading}
                />
                <span className="text-sm text-[var(--text-primary)]">Règle active</span>
              </label>
            </div>

            {billingHint ? (
              <p className="text-xs text-[var(--text-secondary)] -mt-2">
                {billingHint}
              </p>
            ) : null}

            {/* Edit-mode options */}
            {!isCreateMode ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                  Options de mise à jour
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={applyFuture}
                      onChange={(e) => setApplyFuture(e.target.checked)}
                      className="h-4 w-4 rounded border border-[var(--border)] accent-[var(--shell-accent)]"
                      disabled={loading}
                    />
                    Appliquer aux futures
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={recalculate}
                      onChange={(e) => setRecalculate(e.target.checked)}
                      className="h-4 w-4 rounded border border-[var(--border)] accent-[var(--shell-accent)]"
                      disabled={loading}
                    />
                    Recalculer
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    Horizon
                    <Input
                      className="w-20"
                      value={horizonMonths}
                      onChange={(e) => setHorizonMonths(e.target.value)}
                      type="number"
                      min={1}
                      max={36}
                      disabled={loading}
                    />
                    <span className="text-xs text-[var(--text-secondary)]">mois</span>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Occurrences (edit mode only) */}
            {!isCreateMode && occurrences.length > 0 ? (
              <div className="space-y-3 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                  Occurrences ({occurrences.length})
                </p>
                <div className="max-h-56 space-y-1.5 overflow-auto">
                  {occurrences.map((occ) => (
                    <div
                      key={occ.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">
                          {formatFinanceDate(occ.date)} · {formatCurrency(Number(occ.amountCents) / 100)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {occ.isRuleOverride ? 'Modifiée' : 'Automatique'}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onEditOccurrence(occ)}>
                        Modifier
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Delete confirmation */}
            {!isCreateMode && confirmDelete ? (
              <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-4">
                <p className="text-sm font-medium text-[var(--danger)]">
                  Supprimer cette charge fixe ?
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  La règle et toutes ses occurrences seront supprimées. Cette action est irréversible.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[var(--danger)] text-white hover:opacity-90"
                    onClick={() => {
                      setConfirmDelete(false);
                      onDelete?.();
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Suppression…' : 'Confirmer la suppression'}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Sticky footer */}
      <ModalFooterSticky>
        {!isCreateMode && onDelete && !confirmDelete ? (
          <Button
            size="sm"
            variant="outline"
            className="border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10"
            onClick={() => setConfirmDelete(true)}
            disabled={loading}
          >
            Supprimer
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={handleClose}>
          Fermer
        </Button>
        <Button size="sm" onClick={onSave} disabled={loading}>
          {loading
            ? isCreateMode ? 'Création…' : 'Enregistrement…'
            : isCreateMode ? 'Créer' : 'Enregistrer'}
        </Button>
      </ModalFooterSticky>
    </Modal>
  );
}
