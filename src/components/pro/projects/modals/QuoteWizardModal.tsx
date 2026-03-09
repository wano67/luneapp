"use client";

import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchSelect } from '@/components/ui/search-select';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';

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
  catalogPriceCents: number | null;
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
  estimatedMinutes: number | null;
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

function computeTotal(lines: WizardLine[]): number | null {
  let total = 0;
  for (const line of lines) {
    const cents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
    if (cents == null) return null;
    total += cents * line.quantity;
  }
  return total;
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
  const totalCents = computeTotal(lines);

  const memberItems = useMemo(
    () => [{ code: '', label: 'Non assigné' }, ...members.map((m) => ({ code: m.userId, label: m.email }))],
    [members]
  );

  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Créer un devis"
      description="Ajoutez vos prestations, générez les tâches, puis créez le devis."
      size="lg"
    >
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
          <div className="flex items-center gap-1 mb-5">
            {WIZARD_STEPS.map((label, idx) => (
              <div key={label} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { if (idx < step) onStepChange(idx); }}
                  disabled={idx > step}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    idx === step
                      ? 'bg-[var(--shell-accent)] text-white'
                      : idx < step
                        ? 'bg-[var(--surface-2)] text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-2)]/80'
                        : 'bg-[var(--surface-2)]/40 text-[var(--text-faint)]'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                      idx === step
                        ? 'bg-white/20 text-white'
                        : idx < step
                          ? 'bg-[var(--success)]/20 text-[var(--success)]'
                          : 'bg-[var(--border)] text-[var(--text-faint)]'
                    )}
                  >
                    {idx < step ? '✓' : idx + 1}
                  </span>
                  {label}
                </button>
                {idx < WIZARD_STEPS.length - 1 ? (
                  <div className={cn(
                    'h-px w-4 sm:w-8',
                    idx < step ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
                  )} />
                ) : null}
              </div>
            ))}
          </div>

          {/* Step 0 — Prestations */}
          {step === 0 ? (
            <div className="space-y-4">
              {/* Catalog search */}
              <div className="space-y-2">
                <Input
                  placeholder="Rechercher un service dans le catalogue"
                  value={search}
                  onChange={(e) => {
                    const value = e.target.value;
                    onSearchChange(value);
                    void onLoadCatalogServices(value);
                  }}
                />
                <div className="max-h-44 space-y-1.5 overflow-auto rounded-2xl border border-[var(--border)]/60 p-2">
                  {catalogResults.map((svc) => {
                    const priceHint = svc.defaultPriceCents ?? svc.tjmCents;
                    return (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)]/40 bg-[var(--surface)] px-3 py-2"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{svc.name}</span>
                          <span className="shrink-0 text-xs text-[var(--text-faint)]">{svc.code}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-xs text-[var(--text-secondary)]">
                            {priceHint
                              ? formatCurrencyEUR(Number(priceHint), { minimumFractionDigits: 0 })
                              : '—'}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => onAddCatalogLine(svc)}>
                            Ajouter
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {catalogResults.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-[var(--text-secondary)]">Aucun service trouvé.</p>
                  ) : null}
                </div>
              </div>

              {/* Selected lines header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Prestations ({lines.length})
                  </p>
                  {totalCents != null && lines.length > 0 ? (
                    <span className="text-sm font-semibold text-[var(--shell-accent)]">
                      {formatCurrencyEUR(totalCents, { minimumFractionDigits: 0 })}
                    </span>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" onClick={onAddCustomLine}>
                  + Ligne personnalisée
                </Button>
              </div>

              {/* Line items */}
              {lines.length ? (
                <div className="space-y-3">
                  {lines.map((line) => {
                    const errors = lineValidation.find((entry) => entry.id === line.id)?.errors ?? [];
                    const lineCents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
                    return (
                      <div
                        key={line.id}
                        className={cn(
                          'rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4',
                          errors.length ? 'border-[var(--danger-border)]' : ''
                        )}
                      >
                        {/* Row 1: source tag + delete */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                            {line.source === 'custom'
                              ? 'Ligne personnalisée'
                              : line.code
                                ? `Service · ${line.code}`
                                : 'Service'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveLine(line.id)}
                            className="text-xs text-[var(--danger)] hover:underline"
                          >
                            Supprimer
                          </button>
                        </div>

                        {/* Row 2: title + qty + price on one row */}
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-[1fr_100px_140px]">
                          <Input
                            label="Titre"
                            value={line.title}
                            onChange={(e) => onUpdateLine(line.id, { title: e.target.value })}
                          />
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
                          <div>
                            <Input
                              label="Prix unit. (€)"
                              type="text"
                              inputMode="decimal"
                              value={line.unitPrice}
                              onChange={(e) =>
                                onUpdateLine(line.id, { unitPrice: sanitizeEuroInput(e.target.value) })
                              }
                            />
                            {line.catalogPriceCents != null ? (
                              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                                Catalogue : {formatCurrencyEUR(line.catalogPriceCents, { minimumFractionDigits: 0 })}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Line total: qty × price = total */}
                        {lineCents != null && line.quantity > 0 ? (
                          <p className="mt-2 text-xs text-[var(--text-secondary)] text-right">
                            {line.quantity} × {formatCurrencyEUR(lineCents, { minimumFractionDigits: 0 })}
                            {' = '}
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatCurrencyEUR(lineCents * line.quantity, { minimumFractionDigits: 0 })}
                            </span>
                          </p>
                        ) : null}

                        {/* Row 3: description (compact) */}
                        <textarea
                          className="mt-3 min-h-[56px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                          value={line.description}
                          onChange={(e) => onUpdateLine(line.id, { description: e.target.value })}
                          placeholder="Description (optionnel)"
                        />

                        {errors.length ? (
                          <p className="mt-2 text-xs text-[var(--danger)]">{errors.join(' ')}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={cn(UI.sectionSoft, 'text-sm text-[var(--text-secondary)]')}>
                  Aucune prestation sélectionnée. Cherchez dans le catalogue ou ajoutez une ligne personnalisée.
                </div>
              )}
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
                    <SearchSelect
                      label="Assigner à"
                      items={memberItems}
                      value={assigneeId}
                      onChange={onAssigneeIdChange}
                      disabled={!isAdmin}
                    />
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

                  {/* Workload summary */}
                  {(() => {
                    const roleMap = new Map<string, number>();
                    let totalMin = 0;
                    for (const line of lines) {
                      if (!line.serviceId) continue;
                      const tpls = serviceTemplates[line.serviceId] ?? [];
                      for (const tpl of tpls) {
                        const mins = tpl.estimatedMinutes ?? 0;
                        if (mins <= 0) continue;
                        totalMin += mins;
                        const role = tpl.defaultAssigneeRole || 'Non assigné';
                        roleMap.set(role, (roleMap.get(role) ?? 0) + mins);
                      }
                    }
                    if (totalMin <= 0) return null;
                    const fmt = (min: number) => {
                      const h = Math.floor(min / 60);
                      const m = min % 60;
                      return `${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}min` : ''}`;
                    };
                    return (
                      <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-3">
                        <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Charge de travail estimée</p>
                        <div className="space-y-1">
                          {[...roleMap.entries()].map(([role, mins]) => (
                            <div key={role} className="flex items-center justify-between text-[11px]">
                              <span className="text-[var(--text-secondary)]">{role}</span>
                              <span className="font-medium text-[var(--text-primary)]">{fmt(mins)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-[11px] border-t border-[var(--border)]/40 pt-1 mt-1">
                            <span className="font-semibold text-[var(--text-primary)]">Total</span>
                            <span className="font-semibold text-[var(--text-primary)]">{fmt(totalMin)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                                <>
                                  <ul className="mt-1 space-y-1 text-[11px] text-[var(--text-secondary)]">
                                    {templates.map((tpl) => (
                                      <li key={tpl.id}>
                                        • {tpl.title}
                                        {tpl.estimatedMinutes ? (
                                          <span className="ml-1 text-[var(--text-faint)]">({tpl.estimatedMinutes} min)</span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                  {(() => {
                                    const total = templates.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
                                    if (total <= 0) return null;
                                    const h = Math.floor(total / 60);
                                    const m = total % 60;
                                    return (
                                      <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                                        Durée estimée : {h > 0 ? `${h}h` : ''}{m > 0 ? `${m}min` : ''}
                                      </p>
                                    );
                                  })()}
                                </>
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
                  <p className={UI.label}>Total HT</p>
                  <p className={UI.value}>
                    {totalCents != null
                      ? formatCurrencyEUR(totalCents, { minimumFractionDigits: 2 })
                      : 'Incomplet'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Le devis sera généré avec les prestations ci-dessus.
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
          {info ? <p className="mt-3 text-sm text-[var(--success)]">{info}</p> : null}

          {/* Sticky footer navigation */}
          <ModalFooterSticky>
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
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
          </ModalFooterSticky>
        </>
      )}
    </Modal>
  );
}
