"use client";

import { cn } from '@/lib/cn';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';

// ─── Local types (subset of ProjectWorkspace types used by this modal) ─────────

export type WizardLineSource = 'catalog' | 'custom';

export type WizardLine = {
  id: string;
  source: WizardLineSource;
  serviceId?: string | null;
  code?: string | null;
  title: string;
  description: string;
  quantity: number;
  unitPrice: string;
  priceLocked: boolean;
};

export type CatalogService = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
};

export type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

export type WizardMember = {
  userId: string;
  email: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WIZARD_STEPS = ['Prestations', 'Tâches', 'Résumé'] as const;

const UI = {
  sectionSoft: 'rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-3',
  label: 'text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]',
  value: 'text-sm font-semibold text-[var(--text-primary)]',
};

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type QuoteWizardModalProps = {
  open: boolean;
  onClose: () => void;
  // Wizard state
  step: number;
  onStepChange: (step: number) => void;
  lines: WizardLine[];
  search: string;
  onSearchChange: (value: string) => void;
  generateTasks: boolean;
  onGenerateTasksChange: (value: boolean) => void;
  assigneeId: string;
  onAssigneeIdChange: (value: string) => void;
  dueOffsetDays: string;
  onDueOffsetDaysChange: (value: string) => void;
  error: string | null;
  info: string | null;
  saving: boolean;
  result: { quoteId: string; pdfUrl: string; downloadUrl: string } | null;
  // Computed
  lineValidation: Array<{ id: string; errors: string[] }>;
  canContinue: boolean;
  // Data
  catalogResults: CatalogService[];
  serviceTemplates: Record<string, ServiceTemplate[]>;
  templatesLoading: Record<string, boolean>;
  members: WizardMember[];
  isAdmin: boolean;
  // Handlers
  onAddCatalogLine: (service: CatalogService) => void;
  onAddCustomLine: () => void;
  onRemoveLine: (id: string) => void;
  onUpdateLine: (id: string, patch: Partial<WizardLine>) => void;
  onLoadCatalogServices: (q?: string) => void;
  onGenerate: () => void;
  // Navigation callbacks
  onGoToBilling: () => void;
  onOpenDepositInvoice: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteWizardModal({
  open,
  onClose,
  step,
  onStepChange,
  lines,
  search,
  onSearchChange,
  generateTasks,
  onGenerateTasksChange,
  assigneeId,
  onAssigneeIdChange,
  dueOffsetDays,
  onDueOffsetDaysChange,
  error,
  info,
  saving,
  result,
  lineValidation,
  canContinue,
  catalogResults,
  serviceTemplates,
  templatesLoading,
  members,
  isAdmin,
  onAddCatalogLine,
  onAddCustomLine,
  onRemoveLine,
  onUpdateLine,
  onLoadCatalogServices,
  onGenerate,
  onGoToBilling,
  onOpenDepositInvoice,
}: QuoteWizardModalProps) {
  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Créer un devis"
      description="Ajoutez vos prestations, générez les tâches, puis créez le devis."
    >
      <div className="space-y-4">
        {result ? (
          <div className="space-y-4">
            <Alert variant="success" title="Devis généré" />
            <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4 text-sm text-[var(--text-secondary)]">
              {generateTasks
                ? 'Les prestations et les tâches recommandées ont été ajoutées au projet.'
                : 'Les prestations ont été ajoutées au projet. Les tâches peuvent être créées plus tard.'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <a href={result.pdfUrl} target="_blank" rel="noreferrer">
                  Télécharger le PDF
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onGoToBilling();
                }}
              >
                Voir le devis
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClose();
                  onOpenDepositInvoice();
                }}
              >
                Facture d&apos;acompte
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
              {WIZARD_STEPS.map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border text-[11px]',
                      idx === step
                        ? 'border-[var(--text-primary)] text-[var(--text-primary)]'
                        : 'border-[var(--border)] text-[var(--text-secondary)]'
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className={idx === step ? 'text-[var(--text-primary)]' : ''}>{label}</span>
                  {idx < WIZARD_STEPS.length - 1 ? <span className="text-[var(--text-faint)]">→</span> : null}
                </div>
              ))}
            </div>

            {/* Step 0 — Prestations */}
            {step === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Rechercher un service"
                    value={search}
                    onChange={(e) => {
                      const value = e.target.value;
                      onSearchChange(value);
                      void onLoadCatalogServices(value);
                    }}
                  />
                  <div className="max-h-52 space-y-2 overflow-auto rounded-2xl border border-[var(--border)]/60 p-2">
                    {catalogResults.map((svc) => {
                      const priceHint = svc.defaultPriceCents ?? svc.tjmCents;
                      return (
                        <div
                          key={svc.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{svc.name}</p>
                            <p className="text-xs text-[var(--text-secondary)]">{svc.code}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[var(--text-secondary)]">
                              {priceHint
                                ? formatCurrencyEUR(Number(priceHint), { minimumFractionDigits: 0 })
                                : 'Prix manquant'}
                            </span>
                            <Button size="sm" variant="outline" onClick={() => onAddCatalogLine(svc)}>
                              Ajouter
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {catalogResults.length === 0 ? (
                      <p className="px-2 text-sm text-[var(--text-secondary)]">Aucun service trouvé.</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Prestations sélectionnées</p>
                  <Button size="sm" variant="ghost" onClick={onAddCustomLine}>
                    Ligne personnalisée
                  </Button>
                </div>

                {lines.length ? (
                  <div className="space-y-3">
                    {lines.map((line) => {
                      const errors = lineValidation.find((entry) => entry.id === line.id)?.errors ?? [];
                      const priceInput = line.unitPrice;
                      const lockedCents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
                      return (
                        <div
                          key={line.id}
                          className={cn(
                            'rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4',
                            errors.length ? 'border-[var(--danger-border)]' : ''
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                                {line.source === 'custom'
                                  ? 'Ligne personnalisée'
                                  : line.code
                                    ? `Service · ${line.code}`
                                    : 'Service'}
                              </p>
                              <Input
                                label="Titre"
                                value={line.title}
                                onChange={(e) => onUpdateLine(line.id, { title: e.target.value })}
                              />
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => onRemoveLine(line.id)}>
                              Supprimer
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Input
                              label="Qté"
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                onUpdateLine(line.id, {
                                  quantity: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                                })
                              }
                            />
                            {line.priceLocked ? (
                              <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                                  Prix catalogue
                                </p>
                                <p className="text-sm font-semibold text-[var(--text-primary)]">
                                  {lockedCents != null
                                    ? formatCurrencyEUR(lockedCents, { minimumFractionDigits: 0 })
                                    : '—'}
                                </p>
                              </div>
                            ) : (
                              <Input
                                label="Prix unitaire (€)"
                                type="text"
                                inputMode="decimal"
                                value={priceInput}
                                onChange={(e) =>
                                  onUpdateLine(line.id, { unitPrice: sanitizeEuroInput(e.target.value) })
                                }
                              />
                            )}
                          </div>

                          <div className="mt-3">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                            <textarea
                              className="mt-1 min-h-[90px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                              value={line.description}
                              onChange={(e) => onUpdateLine(line.id, { description: e.target.value })}
                              placeholder="Optionnel"
                            />
                          </div>

                          {errors.length ? (
                            <p className="mt-2 text-xs text-[var(--danger)]">{errors.join(' ')}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={cn(UI.sectionSoft, 'text-sm text-[var(--text-secondary)]')}>
                    Aucune prestation sélectionnée.
                  </div>
                )}

                <p className="text-xs text-[var(--text-secondary)]">
                  Les lignes personnalisées seront ajoutées au catalogue pour réutilisation.
                </p>
              </div>
            ) : null}

            {/* Step 1 — Tâches */}
            {step === 1 ? (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={generateTasks}
                    onChange={(e) => onGenerateTasksChange(e.target.checked)}
                    disabled={!isAdmin}
                  />
                  Créer les tâches recommandées
                </label>

                {generateTasks ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        label="Assigner à"
                        value={assigneeId}
                        onChange={(e) => onAssigneeIdChange(e.target.value)}
                        disabled={!isAdmin}
                      >
                        <option value="">Non assigné</option>
                        {members.map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.email}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Échéance dans (jours)"
                        type="number"
                        min={0}
                        max={365}
                        value={dueOffsetDays}
                        onChange={(e) => onDueOffsetDaysChange(e.target.value)}
                        disabled={!isAdmin}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Aperçu des tâches</p>
                      {lines.length === 0 ? (
                        <p className="text-xs text-[var(--text-secondary)]">Ajoute des prestations d&apos;abord.</p>
                      ) : (
                        <div className="space-y-2">
                          {lines.map((line) => {
                            const templates = line.serviceId ? serviceTemplates[line.serviceId] ?? [] : [];
                            const loading = line.serviceId ? templatesLoading[line.serviceId] : false;
                            return (
                              <div
                                key={line.id}
                                className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] p-3"
                              >
                                <p className="text-xs font-semibold text-[var(--text-primary)]">
                                  {line.title.trim() || 'Prestation'}
                                </p>
                                {line.source === 'custom' ? (
                                  <p className="text-[11px] text-[var(--text-secondary)]">
                                    Aucune tâche recommandée pour une ligne personnalisée.
                                  </p>
                                ) : loading ? (
                                  <p className="text-[11px] text-[var(--text-secondary)]">Chargement des templates…</p>
                                ) : templates.length ? (
                                  <ul className="mt-1 space-y-1 text-[11px] text-[var(--text-secondary)]">
                                    {templates.map((tpl) => (
                                      <li key={tpl.id}>• {tpl.title}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[11px] text-[var(--text-secondary)]">Aucun template disponible.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Vous pourrez créer les tâches plus tard depuis chaque prestation.
                  </p>
                )}
              </div>
            ) : null}

            {/* Step 2 — Résumé */}
            {step === 2 ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={cn(UI.sectionSoft, 'text-right')}>
                    <p className={UI.label}>Prestations</p>
                    <p className={UI.value}>{lines.length}</p>
                  </div>
                  <div className={cn(UI.sectionSoft, 'text-right')}>
                    <p className={UI.label}>Tâches</p>
                    <p className={UI.value}>{generateTasks ? 'Activées' : 'Non'}</p>
                  </div>
                  <div className={cn(UI.sectionSoft, 'text-right')}>
                    <p className={UI.label}>Total</p>
                    <p className={UI.value}>Calculé dans le devis</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  Le devis calculera automatiquement le total à partir des prestations ajoutées.
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            {info ? <p className="text-sm text-[var(--success)]">{info}</p> : null}

            {/* Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {step > 0 ? (
                  <Button
                    variant="outline"
                    onClick={() => onStepChange(Math.max(0, step - 1))}
                  >
                    Retour
                  </Button>
                ) : null}
                {step < 2 ? (
                  <Button
                    onClick={() => onStepChange(Math.min(2, step + 1))}
                    disabled={step === 0 && !canContinue}
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button onClick={onGenerate} disabled={saving || !canContinue}>
                    {saving ? 'Génération…' : 'Générer le devis'}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
