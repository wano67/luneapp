import { useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchSelect } from '@/components/ui/search-select';
import { Modal } from '@/components/ui/modal';
import type { Finance } from '@/components/pro/finances/finance-types';
import { TYPE_OPTIONS, METHOD_OPTIONS, RECURRING_OPTIONS } from '@/components/pro/finances/finance-types';
import type { FinanceFormState } from '@/components/pro/finances/hooks/useFinanceForm';
import { groupedCategories, VAT_RATES, computeVat } from '@/config/pcg';
import { parseEuroToCents } from '@/lib/money';

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
  projectOptions: Array<{ id: string; name: string }>;
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
  projectOptions,
  recurringPreview,
}: Props) {
  const pcgGroups = useMemo(
    () => groupedCategories(form.type === 'INCOME' ? 'INCOME' : 'EXPENSE'),
    [form.type]
  );

  const projectItems = useMemo(
    () => [{ code: '', label: 'Aucun projet' }, ...projectOptions.map((p) => ({ code: p.id, label: p.name }))],
    [projectOptions]
  );

  const categoryRefItems = useMemo(
    () => [{ code: '', label: 'Aucune' }, ...categoryOptions.map((c) => ({ code: c.id, label: c.name }))],
    [categoryOptions]
  );

  const vatBreakdown = useMemo(() => {
    const cents = parseEuroToCents(form.amount);
    if (!Number.isFinite(cents) || cents <= 0) return null;
    const rate = Number.parseInt(form.vatRate, 10) || 0;
    const result = computeVat(BigInt(cents), rate);
    return {
      ht: Number(result.htCents) / 100,
      tva: Number(result.tvaCents) / 100,
      ttc: Number(result.ttcCents) / 100,
    };
  }, [form.amount, form.vatRate]);

  function handlePcgChange(e: ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    if (code === '__custom__') {
      setForm((prev) => ({ ...prev, accountCode: '', category: '' }));
      return;
    }
    // Find the label from the grouped categories
    for (const cats of pcgGroups.values()) {
      const match = cats.find((c) => c.code === code);
      if (match) {
        setForm((prev) => ({ ...prev, accountCode: code, category: match.label }));
        return;
      }
    }
  }

  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title={editing ? 'Modifier l\'écriture' : 'Nouvelle écriture'}
      description="Sélectionnez une catégorie comptable, un montant et une date."
    >
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="grid gap-2 md:grid-cols-2">
          {/* Type */}
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

          {/* PCG Category picker */}
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Catégorie comptable</span>
            <Select value={form.accountCode || '__custom__'} onChange={handlePcgChange}>
              <option value="__custom__">Autre (saisie libre)</option>
              {Array.from(pcgGroups.entries()).map(([group, cats]) => (
                <optgroup key={group} label={group}>
                  {cats.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.code} — {cat.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </label>

          {/* Free-text category (visible when "Autre" or to override label) */}
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Libellé</span>
            <Input
              name="category"
              value={form.category}
              onChange={onFieldChange}
              placeholder={form.accountCode ? 'Auto-rempli' : 'Ex: Loyer, Assurance…'}
              required={!form.accountCode}
            />
          </label>

          {/* Amount */}
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Montant TTC (€)</span>
            <Input
              name="amount"
              type="text"
              inputMode="decimal"
              value={form.amount}
              onChange={onFieldChange}
              required
            />
          </label>

          {/* VAT rate */}
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Taux de TVA</span>
            <Select
              value={form.vatRate}
              onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
            >
              {VAT_RATES.map((rate) => (
                <option key={rate.value} value={rate.value}>
                  {rate.label}
                </option>
              ))}
            </Select>
          </label>

          {/* Date */}
          <label className="text-sm text-[var(--text-primary)]">
            <span className="text-xs text-[var(--text-secondary)]">Date</span>
            <Input name="date" type="date" value={form.date} onChange={onFieldChange} required />
          </label>
        </div>

        {/* VAT breakdown */}
        {vatBreakdown && vatBreakdown.tva > 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <span>HT : {vatBreakdown.ht.toFixed(2)} €</span>
            <span>·</span>
            <span>TVA : {vatBreakdown.tva.toFixed(2)} €</span>
            <span>·</span>
            <span className="font-medium text-[var(--text-primary)]">TTC : {vatBreakdown.ttc.toFixed(2)} €</span>
          </div>
        ) : null}

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
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Réf. pièce justificative</span>
              <Input
                name="pieceRef"
                value={form.pieceRef}
                onChange={onFieldChange}
                placeholder="N° facture, reçu…"
              />
            </label>
            <SearchSelect
              label="Projet (optionnel)"
              items={projectItems}
              value={form.projectId}
              onChange={(code) => setForm((prev) => ({ ...prev, projectId: code }))}
            />
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
            <div className="md:col-span-2">
              <SearchSelect
                label="Catégorie de référence"
                items={categoryRefItems}
                value={form.categoryReferenceId}
                onChange={(code) => setForm((prev) => ({ ...prev, categoryReferenceId: code }))}
              />
            </div>
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
        {actionError ? <p className="text-xs text-[var(--danger)]">{actionError}</p> : null}

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
