"use client";

import type { DragEvent } from 'react';
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { UI, KebabMenu } from '@/components/pro/projects/workspace-ui';
import { TASK_STATUS_OPTIONS } from '@/lib/taskStatusUi';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { sanitizeEuroInput } from '@/lib/money';
import type { ServiceItem, TaskItem, MemberItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ServiceDraft = {
  quantity: string;
  price: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: string;
  billingUnit: string;
  unitLabel: string;
};

export type PricingLine = {
  id: string;
  totalCents: number;
  originalUnitPriceCents: number | null;
  billingUnit: string;
  unitLabel: string;
  missingPrice: boolean;
  priceSource: string;
};

type BillingServiceCardProps = {
  svc: ServiceItem;
  draft: ServiceDraft;
  line: PricingLine | undefined;
  lineError: string | undefined;
  isLineSaving: boolean;
  isDragOver: boolean;
  durationHours: number | null | undefined;
  serviceTasks: TaskItem[];
  tasksOpen: boolean;
  notesOpen: boolean;
  applyingTemplates: boolean;
  isRecurringGenerating: boolean;
  reordering: boolean;
  members: MemberItem[];
  taskUpdating: Record<string, boolean>;
  isAdmin: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragStart: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDraftChange: (patch: Partial<ServiceDraft>) => void;
  onClearError: () => void;
  onToggleNotes: () => void;
  onToggleTasks: () => void;
  onDelete: () => void;
  onSave: () => void;
  onApplyTemplates: () => void;
  onGenerateRecurring: () => void;
  onUpdateTask: (taskId: string, patch: { status?: string; assigneeUserId?: string | null; dueDate?: string | null }) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BillingServiceCard({
  svc,
  draft,
  line,
  lineError,
  isLineSaving,
  isDragOver,
  durationHours,
  serviceTasks,
  tasksOpen,
  notesOpen,
  applyingTemplates,
  isRecurringGenerating,
  reordering,
  members,
  taskUpdating,
  isAdmin,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  onDraftChange,
  onClearError,
  onToggleNotes,
  onToggleTasks,
  onDelete,
  onSave,
  onApplyTemplates,
  onGenerateRecurring,
  onUpdateTask,
}: BillingServiceCardProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    () => draft.discountType !== 'NONE' || draft.billingUnit !== 'ONE_OFF'
  );
  const durationLabel = durationHours != null ? `${durationHours} h` : null;
  const unitSuffix = line?.unitLabel ?? (line?.billingUnit === 'MONTHLY' ? '/mois' : null);
  const priceSourceLabel =
    line?.priceSource === 'project'
      ? 'Tarif projet'
      : line?.priceSource === 'default'
        ? 'Catalogue'
        : line?.priceSource === 'tjm'
          ? 'TJM'
          : 'Prix manquant';

  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-4 ${isDragOver ? 'ring-2 ring-[var(--focus-ring)]' : ''}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            draggable={isAdmin && !reordering}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-label="Réordonner le service"
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {svc.titleOverride?.trim() || svc.service.name}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              <span>{svc.service.code}</span>
              {durationLabel ? <span>· Durée : {durationLabel}</span> : null}
              {draft.billingUnit === 'MONTHLY' ? (
                <Badge variant="neutral">Abonnement</Badge>
              ) : null}
            </div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              {priceSourceLabel}
            </p>
            {line?.missingPrice ? (
              <p className="text-xs text-[var(--danger)]">Prix manquant</p>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-right">
          <p className={UI.label}>Total</p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {formatCurrencyEUR(line?.totalCents ?? 0, { minimumFractionDigits: 0 })}
            {unitSuffix ? ` ${unitSuffix}` : ''}
          </p>
          {line?.originalUnitPriceCents ? (
            <p className="text-[11px] text-[var(--text-secondary)]">
              Avant remise :{' '}
              {formatCurrencyEUR(line.originalUnitPriceCents, { minimumFractionDigits: 0 })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Pricing fields */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          label="Qté"
          type="number"
          min={1}
          value={draft.quantity}
          onChange={(e) => onDraftChange({ quantity: e.target.value })}
          onInput={onClearError}
          disabled={!isAdmin || isLineSaving}
        />
        <Input
          label="Prix unitaire (€)"
          type="text"
          inputMode="decimal"
          value={draft.price}
          onChange={(e) => onDraftChange({ price: sanitizeEuroInput(e.target.value) })}
          onInput={onClearError}
          disabled={!isAdmin || isLineSaving}
        />
        <Input
          label="Libellé (optionnel)"
          value={draft.title}
          onChange={(e) => onDraftChange({ title: e.target.value })}
          disabled={!isAdmin || isLineSaving}
        />
      </div>

      {/* Actions row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onSave} disabled={!isAdmin || isLineSaving}>
          {isLineSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        <Button size="sm" variant="outline" onClick={onToggleTasks}>
          {tasksOpen ? 'Masquer tâches' : `Tâches (${serviceTasks.length})`}
        </Button>
        <KebabMenu
          ariaLabel="Options du service"
          items={[
            { label: notesOpen ? 'Masquer description' : 'Description', onClick: onToggleNotes },
            { label: showAdvanced ? 'Masquer options' : 'Remise / Rythme', onClick: () => setShowAdvanced((v) => !v) },
            ...(draft.billingUnit === 'MONTHLY'
              ? [{
                  label: isRecurringGenerating ? 'Création…' : 'Générer facture mensuelle',
                  onClick: onGenerateRecurring,
                  disabled: !isAdmin || isRecurringGenerating,
                }]
              : []),
            { label: 'Supprimer', onClick: onDelete, disabled: !isAdmin || isLineSaving, tone: 'danger' as const },
          ]}
        />
      </div>

      {/* Discount / billing unit (collapsed by default) */}
      {showAdvanced && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Remise"
            value={draft.discountType}
            onChange={(e) => onDraftChange({ discountType: e.target.value })}
            disabled={!isAdmin || isLineSaving}
          >
            <option value="NONE">Aucune</option>
            <option value="PERCENT">%</option>
            <option value="AMOUNT">€</option>
          </Select>
          <Input
            label={draft.discountType === 'PERCENT' ? 'Valeur (%)' : 'Valeur (€)'}
            type={draft.discountType === 'PERCENT' ? 'number' : 'text'}
            inputMode={draft.discountType === 'PERCENT' ? 'numeric' : 'decimal'}
            min={draft.discountType === 'PERCENT' ? 0 : undefined}
            step={draft.discountType === 'PERCENT' ? '1' : undefined}
            value={draft.discountValue}
            onChange={(e) =>
              onDraftChange({
                discountValue:
                  draft.discountType === 'PERCENT' ? e.target.value : sanitizeEuroInput(e.target.value),
              })
            }
            disabled={!isAdmin || isLineSaving || draft.discountType === 'NONE'}
          />
          <Select
            label="Rythme"
            value={draft.billingUnit}
            onChange={(e) => onDraftChange({ billingUnit: e.target.value })}
            disabled={!isAdmin || isLineSaving}
          >
            <option value="ONE_OFF">Ponctuel</option>
            <option value="MONTHLY">Mensuel</option>
          </Select>
          <Input
            label="Unité"
            value={draft.unitLabel}
            onChange={(e) => onDraftChange({ unitLabel: e.target.value })}
            placeholder="/mois"
            disabled={!isAdmin || isLineSaving || draft.billingUnit !== 'MONTHLY'}
          />
        </div>
      )}

      {/* Description panel */}
      {notesOpen ? (
        <div className="mt-3 space-y-2">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={draft.description}
            onChange={(e) => onDraftChange({ description: e.target.value })}
            onInput={onClearError}
            disabled={!isAdmin || isLineSaving}
          />
        </div>
      ) : null}

      {/* Tasks panel */}
      {tasksOpen ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">Tâches liées</p>
            {serviceTasks.length === 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onApplyTemplates}
                disabled={!isAdmin || applyingTemplates}
              >
                {applyingTemplates ? 'Génération…' : 'Appliquer templates'}
              </Button>
            ) : null}
          </div>
          {serviceTasks.length ? (
            <div className="mt-3 space-y-2">
              {serviceTasks.map((task) => {
                const isTaskSaving = taskUpdating[task.id];
                return (
                  <div
                    key={task.id}
                    className="rounded-xl border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {task.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={task.status}
                          onChange={(e) => void onUpdateTask(task.id, { status: e.target.value })}
                          disabled={!isAdmin || isTaskSaving}
                        >
                          {TASK_STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                        <Select
                          value={task.assigneeUserId ?? ''}
                          onChange={(e) =>
                            void onUpdateTask(task.id, { assigneeUserId: e.target.value || null })
                          }
                          disabled={!isAdmin || isTaskSaving}
                        >
                          <option value="">Non assigné</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.email}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Aucune tâche liée à ce service.
            </p>
          )}
        </div>
      ) : null}

      {lineError ? <p className="mt-2 text-xs text-[var(--danger)]">{lineError}</p> : null}
    </div>
  );
}
