"use client";

import type { Dispatch, SetStateAction, DragEvent } from 'react';
import Link from 'next/link';
import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { cn } from '@/lib/cn';
import {
  SectionCard,
  SectionHeader,
  StatCard,
  StatusPill,
  UI,
} from '@/components/pro/projects/workspace-ui';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { sanitizeEuroInput } from '@/lib/money';
import {
  getProjectDepositStatusLabelFR,
  getProjectQuoteStatusLabelFR,
} from '@/lib/billingStatus';
import { BillingQuotesSection } from '@/components/pro/projects/billing/BillingQuotesSection';
import { BillingInvoicesSection } from '@/components/pro/projects/billing/BillingInvoicesSection';

// ─── Local types (minimal shapes for this tab) ────────────────────────────────

type ServiceDraft = {
  quantity: string;
  price: string;
  title: string;
  description: string;
  discountType: string;
  discountValue: string;
  billingUnit: string;
  unitLabel: string;
};

type ServiceItem = {
  id: string;
  serviceId: string;
  priceCents: string | null;
  quantity: number;
  notes: string | null;
  titleOverride?: string | null;
  description?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  billingUnit?: string | null;
  unitLabel?: string | null;
  service: { id: string; code: string; name: string };
};

type PricingLine = {
  id: string;
  totalCents: number;
  originalUnitPriceCents: number | null;
  billingUnit: string;
  unitLabel: string;
  missingPrice: boolean;
  priceSource: string;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeUserId: string | null;
};

type MemberItem = {
  userId: string;
  email: string;
};

type QuoteItem = {
  id: string;
  status: string;
  number: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  depositPercent: number;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
};

type InvoiceItem = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidCents?: string;
  remainingCents?: string;
  paymentStatus?: string | null;
  lastPaidAt?: string | null;
  createdAt: string;
  quoteId: string | null;
};

type SummaryTotals = {
  totalCents: number;
  totalTtcCents: number;
  vatCents: number;
  depositCents: number;
  balanceCents: number;
  depositPercent: number;
  sourceLabel: string;
};

type LegalBlocks = {
  filled: number;
  total: number;
  blocks: Array<{ label: string; value?: string | null }>;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type BillingTabProps = {
  // Status
  billingError: string | null;
  billingInfo: string | null;
  isAdmin: boolean;
  isBillingEmpty: boolean;
  businessId: string;

  // Summary
  summaryTotals: SummaryTotals;
  depositPercentLabel: string;
  depositPaidLabel: string;
  canEditDepositPaidDate: boolean;
  alreadyPaidCents: number;
  alreadyInvoicedCents: number;
  remainingToInvoiceCents: number;
  remainingToCollectCents: number;
  vatEnabled: boolean;
  billingSettingsPaymentTermsDays: number | null | undefined;
  showSummaryDetails: boolean;
  projectQuoteStatus: string | null | undefined;
  projectDepositStatus: string | null | undefined;
  creatingQuote: boolean;

  // Prestations
  prestationsDraft: string;
  prestationsSaving: boolean;
  prestationsDirty: boolean;
  prestationsError: string | null;

  // Services
  services: ServiceItem[];
  pricingTotals: { missingCount: number; totalCents: number };
  missingPriceNames: string[];
  serviceDrafts: Record<string, ServiceDraft>;
  lineErrors: Record<string, string>;
  lineSavingId: string | null;
  dragOverServiceId: string | null;
  draggingServiceId: string | null;
  pricingByServiceId: Map<string, PricingLine>;
  catalogDurationById: Map<string, number | null>;
  tasksByServiceId: Map<string, TaskItem[]>;
  openServiceTasks: Record<string, boolean>;
  openNotes: Record<string, boolean>;
  templatesApplying: Record<string, boolean>;
  recurringInvoiceActionId: string | null;
  reordering: boolean;
  members: MemberItem[];
  taskUpdating: Record<string, boolean>;
  setServiceDrafts: Dispatch<SetStateAction<Record<string, ServiceDraft>>>;
  setLineErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setOpenNotes: Dispatch<SetStateAction<Record<string, boolean>>>;
  setOpenServiceTasks: Dispatch<SetStateAction<Record<string, boolean>>>;

  // Quotes
  quotes: QuoteItem[];
  quoteActionId: string | null;
  invoiceActionId: string | null;
  invoiceByQuoteId: Map<string, string>;
  billingReferenceId: string | null;
  referenceUpdatingId: string | null;

  // Invoices
  invoices: InvoiceItem[];

  // Legal
  legalConfigured: boolean;
  legalBlocks: LegalBlocks;

  // Handlers — summary
  onCreateQuote: () => void;
  onOpenStagedInvoiceModal: (kind: 'DEPOSIT' | 'MID' | 'FINAL') => void;
  onToggleSummaryDetails: () => void;
  onOpenDepositDateModal: () => void;

  // Handlers — prestations
  onPrestationsDraftChange: (value: string) => void;
  onSavePrestations: () => void;

  // Handlers — services
  onServiceDragStart: (e: DragEvent<HTMLButtonElement>, id: string) => void;
  onServiceDragOver: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onServiceDrop: (e: DragEvent<HTMLDivElement>, id: string) => void;
  onServiceDragEnd: () => void;
  onDeleteService: (id: string) => void;
  onUpdateService: (id: string) => void;
  onApplyServiceTemplates: (id: string) => void;
  onGenerateRecurringInvoice: (id: string) => void;
  onUpdateTask: (taskId: string, patch: { status?: string; assigneeUserId?: string | null; dueDate?: string | null }) => void;
  onOpenQuoteWizard: () => void;
  onOpenAddServicesModal: () => void;

  // Handlers — quotes
  onOpenQuoteEditor: (quote: QuoteItem) => void;
  onOpenQuoteDateModal: (quote: QuoteItem) => void;
  onSetBillingReference: (quoteId: string) => void;
  onQuoteStatus: (quoteId: string, status: 'SENT' | 'SIGNED' | 'EXPIRED') => void;
  onOpenCancelQuoteModal: (quote: QuoteItem) => void;
  onCreateInvoice: (quoteId: string) => void;
  onDeleteQuote: (quoteId: string) => void;

  // Handlers — invoices
  onOpenPaymentModal: (invoice: InvoiceItem, remainingCents?: number) => void;
  onOpenInvoiceEditor: (invoiceId: string) => void;
  onOpenInvoiceDateModal: (invoice: InvoiceItem) => void;
  onInvoiceStatus: (invoiceId: string, status: 'SENT' | 'CANCELLED') => void;
  onDeleteInvoice: (invoiceId: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BillingTab({
  billingError,
  billingInfo,
  isAdmin,
  isBillingEmpty,
  businessId,
  summaryTotals,
  depositPercentLabel,
  depositPaidLabel,
  canEditDepositPaidDate,
  alreadyPaidCents,
  alreadyInvoicedCents,
  remainingToInvoiceCents,
  remainingToCollectCents,
  vatEnabled,
  billingSettingsPaymentTermsDays,
  showSummaryDetails,
  projectQuoteStatus,
  projectDepositStatus,
  creatingQuote,
  prestationsDraft,
  prestationsSaving,
  prestationsDirty,
  prestationsError,
  services,
  pricingTotals,
  missingPriceNames,
  serviceDrafts,
  lineErrors,
  lineSavingId,
  dragOverServiceId,
  draggingServiceId,
  pricingByServiceId,
  catalogDurationById,
  tasksByServiceId,
  openServiceTasks,
  openNotes,
  templatesApplying,
  recurringInvoiceActionId,
  reordering,
  members,
  taskUpdating,
  setServiceDrafts,
  setLineErrors,
  setOpenNotes,
  setOpenServiceTasks,
  quotes,
  quoteActionId,
  invoiceActionId,
  invoiceByQuoteId,
  billingReferenceId,
  referenceUpdatingId,
  invoices,
  legalConfigured,
  legalBlocks,
  onCreateQuote,
  onOpenStagedInvoiceModal,
  onToggleSummaryDetails,
  onOpenDepositDateModal,
  onPrestationsDraftChange,
  onSavePrestations,
  onServiceDragStart,
  onServiceDragOver,
  onServiceDrop,
  onServiceDragEnd,
  onDeleteService,
  onUpdateService,
  onApplyServiceTemplates,
  onGenerateRecurringInvoice,
  onUpdateTask,
  onOpenQuoteWizard,
  onOpenAddServicesModal,
  onOpenQuoteEditor,
  onOpenQuoteDateModal,
  onSetBillingReference,
  onQuoteStatus,
  onOpenCancelQuoteModal,
  onCreateInvoice,
  onDeleteQuote,
  onOpenPaymentModal,
  onOpenInvoiceEditor,
  onOpenInvoiceDateModal,
  onInvoiceStatus,
  onDeleteInvoice,
}: BillingTabProps) {
  return (
    <div className="space-y-5">
      {billingError ? (
        <SectionCard className="border-rose-200/60 bg-rose-50/70 text-sm text-rose-500">
          {billingError}
        </SectionCard>
      ) : null}
      {billingInfo ? <p className="text-sm text-emerald-500">{billingInfo}</p> : null}
      {!isAdmin ? (
        <div className={cn(UI.sectionSoft, 'text-xs text-[var(--text-secondary)]')}>
          Lecture seule : réservée aux admins/owners.
        </div>
      ) : null}

      {/* ── Résumé & situation ─────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          title="Résumé & situation"
          subtitle={`Acompte de référence : ${depositPercentLabel} · Source : ${summaryTotals.sourceLabel}`}
          actions={
            isBillingEmpty ? null : (
              <>
                <Button
                  size="sm"
                  onClick={onCreateQuote}
                  disabled={!services.length || pricingTotals.missingCount > 0 || creatingQuote || !isAdmin}
                >
                  {creatingQuote ? 'Création…' : 'Créer un devis'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenStagedInvoiceModal('DEPOSIT')}
                  disabled={!isAdmin || summaryTotals.totalCents <= 0}
                >
                  Facture d&apos;acompte
                </Button>
              </>
            )
          }
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill label="Devis" value={getProjectQuoteStatusLabelFR(projectQuoteStatus ?? null)} />
          <StatusPill label="Acompte" value={getProjectDepositStatusLabelFR(projectDepositStatus ?? null)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Date acompte : {depositPaidLabel}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenDepositDateModal}
            disabled={!isAdmin || !canEditDepositPaidDate}
          >
            Modifier date
          </Button>
          {!canEditDepositPaidDate ? (
            <span>Disponible une fois l&apos;acompte payé.</span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total TTC"
            value={formatCurrencyEUR(summaryTotals.totalTtcCents, { minimumFractionDigits: 0 })}
            highlight
            align="right"
          />
          <StatCard
            label="Déjà payé"
            value={formatCurrencyEUR(alreadyPaidCents, { minimumFractionDigits: 0 })}
            align="right"
          />
          <StatCard
            label="Reste à facturer"
            value={formatCurrencyEUR(remainingToInvoiceCents, { minimumFractionDigits: 0 })}
            highlight
            align="right"
          />
          <StatCard
            label="Reste à encaisser"
            value={formatCurrencyEUR(remainingToCollectCents, { minimumFractionDigits: 0 })}
            highlight
            align="right"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <span>Vue synthétique. Détails financiers en option.</span>
          <Button size="sm" variant="ghost" onClick={onToggleSummaryDetails}>
            {showSummaryDetails ? 'Voir moins' : 'Voir +'}
          </Button>
        </div>
        {showSummaryDetails ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Déjà facturé"
                value={formatCurrencyEUR(alreadyInvoicedCents, { minimumFractionDigits: 0 })}
                align="right"
              />
              <StatCard
                label={`Acompte ${depositPercentLabel}`}
                value={formatCurrencyEUR(summaryTotals.depositCents, { minimumFractionDigits: 0 })}
                align="right"
              />
              <StatCard
                label="Solde"
                value={formatCurrencyEUR(summaryTotals.balanceCents, { minimumFractionDigits: 0 })}
                align="right"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
              <span>Total HT : {formatCurrencyEUR(summaryTotals.totalCents, { minimumFractionDigits: 0 })}</span>
              <span aria-hidden>•</span>
              <span>
                TVA : {vatEnabled ? formatCurrencyEUR(summaryTotals.vatCents, { minimumFractionDigits: 0 }) : '—'}
              </span>
              {billingSettingsPaymentTermsDays != null ? (
                <>
                  <span aria-hidden>•</span>
                  <span>Paiement sous {billingSettingsPaymentTermsDays} jours</span>
                </>
              ) : null}
            </div>
          </>
        ) : null}
      </SectionCard>

      {/* ── Détail des prestations ─────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          title="Détail des prestations"
          subtitle="Texte narratif repris dans les devis (hors lignes tarifées)."
        />
        <div className="mt-4 space-y-3">
          <textarea
            className="min-h-[180px] w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-primary)]"
            placeholder="Décris le périmètre, les livrables, les phases…"
            value={prestationsDraft}
            onChange={(e) => onPrestationsDraftChange(e.target.value)}
            disabled={!isAdmin || prestationsSaving}
          />
          {prestationsError ? <p className="text-xs text-rose-500">{prestationsError}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onSavePrestations}
              disabled={!isAdmin || prestationsSaving || !prestationsDirty}
            >
              {prestationsSaving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            {!isAdmin ? (
              <span className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</span>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {/* ── Prestations facturables ────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          title="Prestations facturables"
          subtitle="Ajuste les quantités, tarifs et remises avant de générer un devis."
          actions={
            isBillingEmpty ? null : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenAddServicesModal}
                  disabled={!isAdmin}
                >
                  Ajouter au projet
                </Button>
                <Button asChild size="sm">
                  <Link href={`/app/pro/${businessId}/services`}>Catalogue services</Link>
                </Button>
              </>
            )
          }
        />

        {pricingTotals.missingCount > 0 ? (
          <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-50/60 p-3 text-xs text-rose-500">
            Prix manquant pour {pricingTotals.missingCount} service(s)
            {missingPriceNames.length ? ` : ${missingPriceNames.join(', ')}.` : '.'}
          </div>
        ) : null}

        {services.length ? (
          <div className="mt-4 space-y-4">
            {services.map((svc) => {
              const draft = serviceDrafts[svc.id] ?? {
                quantity: String(svc.quantity ?? 1),
                price: '',
                title: svc.titleOverride ?? '',
                description: svc.description ?? svc.notes ?? '',
                discountType: svc.discountType ?? 'NONE',
                discountValue:
                  svc.discountType === 'AMOUNT'
                    ? ''
                    : svc.discountValue != null
                      ? String(svc.discountValue)
                      : '',
                billingUnit: svc.billingUnit ?? 'ONE_OFF',
                unitLabel: svc.unitLabel ?? '',
              };
              const line = pricingByServiceId.get(svc.id);
              const lineError = lineErrors[svc.id];
              const isLineSaving = lineSavingId === svc.id;
              const isDragOver = dragOverServiceId === svc.id && draggingServiceId !== svc.id;
              const durationHours = catalogDurationById.get(svc.serviceId);
              const durationLabel = durationHours != null ? `${durationHours} h` : null;
              const unitSuffix =
                line?.unitLabel ?? (line?.billingUnit === 'MONTHLY' ? '/mois' : null);
              const priceSourceLabel =
                line?.priceSource === 'project'
                  ? 'Tarif projet'
                  : line?.priceSource === 'default'
                    ? 'Catalogue'
                    : line?.priceSource === 'tjm'
                      ? 'TJM'
                      : 'Prix manquant';
              const serviceTasks = tasksByServiceId.get(svc.id) ?? [];
              const tasksOpen = openServiceTasks[svc.id];
              const applyingTemplates = templatesApplying[svc.id];
              return (
                <div
                  key={svc.id}
                  onDragOver={(event) => onServiceDragOver(event, svc.id)}
                  onDrop={(event) => void onServiceDrop(event, svc.id)}
                  className={`rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-4 ${isDragOver ? 'ring-2 ring-[var(--focus-ring)]' : ''}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <button
                        type="button"
                        className="mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        draggable={isAdmin && !reordering}
                        onDragStart={(event) => onServiceDragStart(event, svc.id)}
                        onDragEnd={onServiceDragEnd}
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
                          <p className="text-xs text-rose-500">Prix manquant</p>
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Qté"
                      type="number"
                      min={1}
                      value={draft.quantity}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), quantity: e.target.value },
                        }))
                      }
                      onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                      disabled={!isAdmin || isLineSaving}
                    />
                    <Input
                      label="Prix unitaire (€)"
                      type="text"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), price: sanitizeEuroInput(e.target.value) },
                        }))
                      }
                      onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                      disabled={!isAdmin || isLineSaving}
                    />
                    <Input
                      label="Libellé (optionnel)"
                      value={draft.title}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), title: e.target.value },
                        }))
                      }
                      disabled={!isAdmin || isLineSaving}
                    />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <Select
                      label="Remise"
                      value={draft.discountType}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), discountType: e.target.value },
                        }))
                      }
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
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: {
                            ...(prev[svc.id] ?? draft),
                            discountValue:
                              draft.discountType === 'PERCENT'
                                ? e.target.value
                                : sanitizeEuroInput(e.target.value),
                          },
                        }))
                      }
                      disabled={!isAdmin || isLineSaving || draft.discountType === 'NONE'}
                    />
                    <Select
                      label="Rythme"
                      value={draft.billingUnit}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), billingUnit: e.target.value },
                        }))
                      }
                      disabled={!isAdmin || isLineSaving}
                    >
                      <option value="ONE_OFF">Ponctuel</option>
                      <option value="MONTHLY">Mensuel</option>
                    </Select>
                    <Input
                      label="Unité"
                      value={draft.unitLabel}
                      onChange={(e) =>
                        setServiceDrafts((prev) => ({
                          ...prev,
                          [svc.id]: { ...(prev[svc.id] ?? draft), unitLabel: e.target.value },
                        }))
                      }
                      placeholder="/mois"
                      disabled={!isAdmin || isLineSaving || draft.billingUnit !== 'MONTHLY'}
                    />
                    <div className="flex flex-wrap gap-2">
                      {draft.billingUnit === 'MONTHLY' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onGenerateRecurringInvoice(svc.id)}
                          disabled={!isAdmin || recurringInvoiceActionId === svc.id}
                        >
                          {recurringInvoiceActionId === svc.id ? 'Création…' : 'Générer facture mois prochain'}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenNotes((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                      >
                        Description
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenServiceTasks((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                      >
                        {tasksOpen ? 'Masquer tâches' : `Tâches (${serviceTasks.length})`}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDeleteService(svc.id)}
                        disabled={!isAdmin || isLineSaving}
                      >
                        Supprimer
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onUpdateService(svc.id)}
                        disabled={!isAdmin || isLineSaving}
                      >
                        {isLineSaving ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>

                  {openNotes[svc.id] ? (
                    <div className="mt-3 space-y-2">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">Description</label>
                      <textarea
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        rows={3}
                        value={draft.description}
                        onChange={(e) =>
                          setServiceDrafts((prev) => ({
                            ...prev,
                            [svc.id]: { ...(prev[svc.id] ?? draft), description: e.target.value },
                          }))
                        }
                        onInput={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                        disabled={!isAdmin || isLineSaving}
                      />
                    </div>
                  ) : null}

                  {tasksOpen ? (
                    <div className="mt-4 rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Tâches liées</p>
                        {serviceTasks.length === 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onApplyServiceTemplates(svc.id)}
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
                                      <option value="TODO">À faire</option>
                                      <option value="IN_PROGRESS">En cours</option>
                                      <option value="DONE">Terminée</option>
                                    </Select>
                                    <Select
                                      value={task.assigneeUserId ?? ''}
                                      onChange={(e) =>
                                        void onUpdateTask(task.id, {
                                          assigneeUserId: e.target.value || null,
                                        })
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

                  {lineError ? <p className="mt-2 text-xs text-rose-500">{lineError}</p> : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-[var(--border)]/70 bg-[var(--surface-2)]/60 p-6 text-center">
            <p className="text-base font-semibold text-[var(--text-primary)]">Créer un devis</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Ajoutez vos prestations, générez les tâches, puis créez le devis.
            </p>
            <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button onClick={onOpenQuoteWizard} disabled={!isAdmin}>
                Créer un devis
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/app/pro/${businessId}/services`}>Créer un service dans le catalogue</Link>
              </Button>
            </div>
            {!isAdmin ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* ── Devis ──────────────────────────────────────────────────────────── */}
      <BillingQuotesSection
        quotes={quotes}
        isAdmin={isAdmin}
        isBillingEmpty={isBillingEmpty}
        servicesCount={services.length}
        missingPriceCount={pricingTotals.missingCount}
        creatingQuote={creatingQuote}
        quoteActionId={quoteActionId}
        invoiceActionId={invoiceActionId}
        invoiceByQuoteId={invoiceByQuoteId}
        billingReferenceId={billingReferenceId}
        referenceUpdatingId={referenceUpdatingId}
        businessId={businessId}
        onCreateQuote={onCreateQuote}
        onOpenQuoteEditor={onOpenQuoteEditor}
        onOpenQuoteDateModal={onOpenQuoteDateModal}
        onSetBillingReference={onSetBillingReference}
        onQuoteStatus={onQuoteStatus}
        onOpenCancelQuoteModal={onOpenCancelQuoteModal}
        onCreateInvoice={onCreateInvoice}
        onDeleteQuote={onDeleteQuote}
      />

      {/* ── Factures ───────────────────────────────────────────────────────── */}
      <BillingInvoicesSection
        invoices={invoices}
        isAdmin={isAdmin}
        isBillingEmpty={isBillingEmpty}
        summaryTotalCents={summaryTotals.totalCents}
        remainingToInvoiceCents={remainingToInvoiceCents}
        invoiceActionId={invoiceActionId}
        businessId={businessId}
        onOpenStagedInvoiceModal={onOpenStagedInvoiceModal}
        onOpenPaymentModal={onOpenPaymentModal}
        onOpenInvoiceEditor={onOpenInvoiceEditor}
        onOpenInvoiceDateModal={onOpenInvoiceDateModal}
        onInvoiceStatus={onInvoiceStatus}
        onDeleteInvoice={onDeleteInvoice}
      />

      {/* ── CGV & modalités ────────────────────────────────────────────────── */}
      <SectionCard>
        <SectionHeader
          title="CGV & modalités"
          subtitle="Ces éléments sont intégrés automatiquement aux PDF."
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/pro/${businessId}/settings/billing`}>Configurer</Link>
            </Button>
          }
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={legalConfigured ? 'personal' : 'performance'}>
            {legalConfigured ? 'Configuré' : 'À configurer'}
          </Badge>
          <span className="text-xs text-[var(--text-secondary)]">
            {legalBlocks.filled}/{legalBlocks.total} blocs renseignés
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {legalBlocks.blocks.map((block) => (
            <div key={block.label} className={cn(UI.sectionSoft, 'flex items-center justify-between')}>
              <span className="text-xs font-medium text-[var(--text-primary)]">{block.label}</span>
              <span className="text-xs text-[var(--text-secondary)]">
                {(block.value ?? '').trim() ? 'Renseigné' : 'Manquant'}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
