import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import type { Finance } from '@/components/pro/finances/finance-types';
import { TYPE_OPTIONS, METHOD_OPTIONS, RECURRING_OPTIONS } from '@/components/pro/finances/finance-types';
import type { FinanceFormState } from '@/components/pro/finances/hooks/useFinanceForm';

type Props = {
  open: boolean;
  onClose: () => void;
  editing: Finance | null;
  form: FinanceFormState;
  setForm: React.Dispatch<React.SetStateAction<FinanceFormState>>;
  onFieldChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  creating: boolean;
  actionError: string | null;
  isAdmin: boolean;
  readOnlyMessage: string;
  categoryOptions: Array<{ id: string; name: string }>;
  tagOptions: Array<{ id: string; name: string }>;
  recurringPreview: { pastCount: number; futureCount: number } | null;
};

export function FinanceFormModal({
  open,
  onClose,
  editing,
  form,
  setForm,
  onFieldChange,
  onSubmit,
  creating,
  actionError,
  isAdmin,
  readOnlyMessage,
  categoryOptions,
  tagOptions,
  recurringPreview,
}: Props) {
  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title={editing ? 'Modifier écriture' : 'Nouvelle charge'}
      description="Montant, libellé et date sont requis."
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Type</span>
            <Select name="type" value={form.type} onChange={onFieldChange}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Montant (€)</span>
            <Input
              name="amount"
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={onFieldChange}
              required
            />
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Libellé</span>
            <Input name="category" value={form.category} onChange={onFieldChange} required />
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Date</span>
            <Input name="date" type="date" value={form.date} onChange={onFieldChange} required />
          </label>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Projet (optionnel)</span>
            <Input name="projectId" value={form.projectId} onChange={onFieldChange} />
          </label>
        </div>

        <details className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Options avancées
          </summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Fournisseur</span>
              <Input name="vendor" value={form.vendor} onChange={onFieldChange} />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Mode de paiement</span>
              <Select name="method" value={form.method} onChange={onFieldChange}>
                {METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input
                type="checkbox"
                name="isRecurring"
                checked={form.isRecurring}
                onChange={onFieldChange}
                className="h-4 w-4 rounded border border-[var(--border)]"
              />
              <span>Récurrent</span>
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Fréquence</span>
              <Select
                name="recurringUnit"
                value={form.recurringUnit}
                onChange={onFieldChange}
                disabled={!form.isRecurring}
              >
                {RECURRING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
            {form.isRecurring && form.recurringUnit === 'MONTHLY' ? (
              <>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Créer sur (mois)</span>
                  <Input
                    name="recurringMonths"
                    value={form.recurringMonths}
                    onChange={onFieldChange}
                    type="number"
                    min={1}
                    max={36}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Jour de facturation</span>
                  <Input
                    name="recurringDayOfMonth"
                    value={form.recurringDayOfMonth}
                    onChange={onFieldChange}
                    type="number"
                    min={1}
                    max={31}
                    placeholder="Auto"
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Fin de récurrence</span>
                  <Input
                    name="recurringEndDate"
                    type="date"
                    value={form.recurringEndDate}
                    onChange={onFieldChange}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    name="recurringRetroactive"
                    checked={form.recurringRetroactive}
                    onChange={onFieldChange}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  <span>Créer rétroactivement depuis la date de début</span>
                </label>
                {recurringPreview ? (
                  <div className="text-xs text-[var(--text-secondary)] md:col-span-2">
                    +{recurringPreview.pastCount} occurrences passées · +{recurringPreview.futureCount} occurrences futures
                  </div>
                ) : null}
              </>
            ) : null}
            <label className="text-sm text-[var(--text-primary)] md:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">Note</span>
              <Input name="note" value={form.note} onChange={onFieldChange} />
            </label>
            <label className="text-sm text-[var(--text-primary)] md:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">Catégorie de référence</span>
              <Select
                value={form.categoryReferenceId}
                onChange={(e) => setForm((prev) => ({ ...prev, categoryReferenceId: e.target.value }))}
              >
                <option value="">Aucune</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-[var(--text-primary)] md:col-span-2">
              <span className="text-xs text-[var(--text-secondary)]">Tags</span>
              <Select
                multiple
                value={form.tagReferenceIds}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tagReferenceIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                  }))
                }
              >
                {tagOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>
        {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
          </Button>
        </div>
        {!isAdmin ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
      </form>
    </Modal>
  );
}
