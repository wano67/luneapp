"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchSelect } from '@/components/ui/search-select';
import { Modal, ModalFooterSticky } from '@/components/ui/modal';
import type { WizardLineTask, TaskSuggestion } from '../hooks/useQuoteWizard';

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
  tasks: WizardLineTask[];
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

export type WizardMember = {
  userId: string;
  email: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WIZARD_STEPS = ['Prestations', 'Conditions', 'Résumé'] as const;

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

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

// ─── TaskTitleInput with auto-suggest ─────────────────────────────────────────

function TaskTitleInput({
  value,
  onChange,
  suggestions,
  onLoadSuggestions,
  onSelectSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  suggestions: TaskSuggestion[];
  onLoadSuggestions: (q: string) => void;
  onSelectSuggestion: (s: TaskSuggestion) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
      clearTimeout(debounceRef.current);
      if (val.trim().length >= 2) {
        debounceRef.current = setTimeout(() => {
          onLoadSuggestions(val);
          setShowDropdown(true);
        }, 300);
      } else {
        setShowDropdown(false);
      }
    },
    [onChange, onLoadSuggestions]
  );

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (value.trim().length >= 2 && suggestions.length > 0) setShowDropdown(true); }}
        onBlur={() => { setTimeout(() => setShowDropdown(false), 150); }}
        placeholder="Titre de la tâche"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      />
      {showDropdown && suggestions.length > 0 ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-h-40 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          {suggestions.map((s, i) => (
            <button
              key={`${s.title}-${i}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelectSuggestion(s);
                setShowDropdown(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            >
              <span className="truncate text-[var(--text-primary)]">{s.title}</span>
              {s.estimatedMinutes ? (
                <span className="shrink-0 text-xs text-[var(--text-faint)]">{s.estimatedMinutes} min</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  // Conditions step
  expiresOffsetDays: string;
  onExpiresOffsetDaysChange: (value: string) => void;
  depositPercent: string;
  onDepositPercentChange: (value: string) => void;
  paymentTermsDays: string;
  onPaymentTermsDaysChange: (value: string) => void;
  internalNote: string;
  onInternalNoteChange: (value: string) => void;
  error: string | null;
  info: string | null;
  saving: boolean;
  result: { quoteId: string; pdfUrl: string; downloadUrl: string } | null;
  // Computed
  lineValidation: Array<{ id: string; errors: string[] }>;
  canContinue: boolean;
  // Data
  catalogResults: CatalogService[];
  members: WizardMember[];
  isAdmin: boolean;
  // Task handlers
  taskSuggestions: TaskSuggestion[];
  onLoadTaskSuggestions: (q: string) => void;
  onAddTaskToLine: (lineId: string) => void;
  onUpdateTaskOnLine: (lineId: string, taskKey: string, patch: Partial<WizardLineTask>) => void;
  onRemoveTaskFromLine: (lineId: string, taskKey: string) => void;
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
  expiresOffsetDays,
  onExpiresOffsetDaysChange,
  depositPercent,
  onDepositPercentChange,
  paymentTermsDays,
  onPaymentTermsDaysChange,
  internalNote,
  onInternalNoteChange,
  error,
  info,
  saving,
  result,
  lineValidation,
  canContinue,
  catalogResults,
  members,
  isAdmin,
  taskSuggestions,
  onLoadTaskSuggestions,
  onAddTaskToLine,
  onUpdateTaskOnLine,
  onRemoveTaskFromLine,
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
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const toggleTasks = useCallback((lineId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [lineId]: !prev[lineId] }));
  }, []);

  const memberItems = useMemo(
    () => [{ code: '', label: 'Non assigné' }, ...members.map((m) => ({ code: m.userId, label: m.email }))],
    [members]
  );

  // Count total tasks + total estimated time
  const totalTasks = lines.reduce((sum, l) => sum + l.tasks.filter((t) => t.title.trim()).length, 0);
  const totalEstMin = lines.reduce(
    (sum, l) => sum + l.tasks.reduce((s, t) => s + (Number(t.estimatedMinutes) || 0), 0),
    0
  );

  return (
    <Modal
      open={open}
      onCloseAction={onClose}
      title="Construire une offre"
      description="Ajoutez vos prestations, définissez les conditions, puis générez le devis."
      size="lg"
    >
      {result ? (
        <div className="space-y-4">
          <Alert variant="success" title="Devis généré" />
          <div className="rounded-2xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-4 text-sm text-[var(--text-secondary)]">
            Les prestations et les tâches ont été ajoutées au projet.
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

          {/* Step 0 — Prestations + Tâches inline */}
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

              {/* Line items with inline tasks */}
              {lines.length ? (
                <div className="space-y-3">
                  {lines.map((line) => {
                    const errors = lineValidation.find((entry) => entry.id === line.id)?.errors ?? [];
                    const lineCents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
                    const tasksExpanded = expandedTasks[line.id] ?? (line.tasks.length > 0);
                    const lineTaskMin = line.tasks.reduce((s, t) => s + (Number(t.estimatedMinutes) || 0), 0);

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
                            className="text-xs text-[var(--danger)] hover:underline cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </div>

                        {/* Row 2: title + qty + price */}
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

                        {/* Line total */}
                        {lineCents != null && line.quantity > 0 ? (
                          <p className="mt-2 text-xs text-[var(--text-secondary)] text-right">
                            {line.quantity} × {formatCurrencyEUR(lineCents, { minimumFractionDigits: 0 })}
                            {' = '}
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatCurrencyEUR(lineCents * line.quantity, { minimumFractionDigits: 0 })}
                            </span>
                          </p>
                        ) : null}

                        {/* Description */}
                        <textarea
                          className="mt-3 min-h-[56px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                          value={line.description}
                          onChange={(e) => onUpdateLine(line.id, { description: e.target.value })}
                          placeholder="Description (optionnel)"
                        />

                        {/* Inline tasks section */}
                        <div className="mt-3 border-t border-[var(--border)]/40 pt-3">
                          <button
                            type="button"
                            onClick={() => toggleTasks(line.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent)] transition-colors"
                          >
                            {tasksExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            Tâches ({line.tasks.length})
                            {lineTaskMin > 0 ? (
                              <span className="font-normal text-[var(--text-faint)] ml-1">
                                — {formatMinutes(lineTaskMin)}
                              </span>
                            ) : null}
                          </button>
                          {tasksExpanded ? (
                            <div className="mt-2 space-y-2">
                              {line.tasks.map((task) => (
                                <div key={task._key} className="flex items-center gap-2">
                                  <TaskTitleInput
                                    value={task.title}
                                    onChange={(val) => onUpdateTaskOnLine(line.id, task._key, { title: val })}
                                    suggestions={taskSuggestions}
                                    onLoadSuggestions={onLoadTaskSuggestions}
                                    onSelectSuggestion={(s) =>
                                      onUpdateTaskOnLine(line.id, task._key, {
                                        title: s.title,
                                        estimatedMinutes: s.estimatedMinutes != null ? String(s.estimatedMinutes) : '',
                                      })
                                    }
                                  />
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    value={task.estimatedMinutes}
                                    onChange={(e) =>
                                      onUpdateTaskOnLine(line.id, task._key, { estimatedMinutes: e.target.value })
                                    }
                                    placeholder="min"
                                    className="w-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => onRemoveTaskFromLine(line.id, task._key)}
                                    className="cursor-pointer shrink-0 rounded-lg p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] transition-colors"
                                    aria-label="Supprimer la tâche"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => onAddTaskToLine(line.id)}
                                className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
                              >
                                <Plus size={12} />
                                Ajouter une tâche
                              </button>
                            </div>
                          ) : null}
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
                  Aucune prestation sélectionnée. Cherchez dans le catalogue ou ajoutez une ligne personnalisée.
                </div>
              )}

              {/* Options tâches */}
              {lines.length > 0 ? (
                <div className="space-y-3 rounded-2xl border border-[var(--border)]/40 bg-[var(--surface)] p-4">
                  <p className="text-xs font-semibold text-[var(--text-faint)]">Options tâches</p>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      checked={generateTasks}
                      onChange={(e) => onGenerateTasksChange(e.target.checked)}
                      disabled={!isAdmin}
                    />
                    Créer les tâches des services sans tâches manuelles
                  </label>
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
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Step 1 — Conditions */}
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Définissez les conditions commerciales de votre offre.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex w-full flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Validité du devis</span>
                  <select
                    value={expiresOffsetDays}
                    onChange={(e) => onExpiresOffsetDaysChange(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <option value="15">15 jours</option>
                    <option value="30">30 jours</option>
                    <option value="60">60 jours</option>
                    <option value="90">90 jours</option>
                  </select>
                </label>
                <label className="flex w-full flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Acompte</span>
                  <select
                    value={depositPercent}
                    onChange={(e) => onDepositPercentChange(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <option value="">Par défaut (paramètres business)</option>
                    <option value="0">0 %</option>
                    <option value="30">30 %</option>
                    <option value="50">50 %</option>
                    <option value="100">100 %</option>
                  </select>
                </label>
              </div>
              <Input
                label="Délai de paiement (jours)"
                type="number"
                min={0}
                max={365}
                value={paymentTermsDays}
                onChange={(e) => onPaymentTermsDaysChange(e.target.value)}
                placeholder="Ex : 30"
              />
              <label className="flex w-full flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Note interne</span>
                <textarea
                  className="min-h-[80px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
                  value={internalNote}
                  onChange={(e) => onInternalNoteChange(e.target.value)}
                  placeholder="Note visible uniquement par votre équipe (non incluse dans le devis client)"
                />
              </label>
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
                  <p className={UI.value}>
                    {totalTasks > 0 ? totalTasks : generateTasks ? 'Auto' : 'Non'}
                  </p>
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
              {totalEstMin > 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Temps total estimé : <span className="font-semibold">{formatMinutes(totalEstMin)}</span>
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn(UI.sectionSoft)}>
                  <p className={UI.label}>Validité</p>
                  <p className={UI.value}>{expiresOffsetDays} jours</p>
                </div>
                <div className={cn(UI.sectionSoft)}>
                  <p className={UI.label}>Acompte</p>
                  <p className={UI.value}>{depositPercent ? `${depositPercent} %` : 'Par défaut'}</p>
                </div>
              </div>
              {paymentTermsDays ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Délai de paiement : <span className="font-semibold">{paymentTermsDays} jours</span>
                </p>
              ) : null}
              <p className="text-sm text-[var(--text-secondary)]">
                Le devis sera généré avec les prestations et conditions ci-dessus.
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
                onClick={() => onStepChange(step + 1)}
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
