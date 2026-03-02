"use client";

import type { Dispatch, SetStateAction, DragEvent } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  SectionCard,
  SectionHeader,
  StatCard,
  StatusPill,
  UI,
} from '@/components/pro/projects/workspace-ui';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import {
  getProjectDepositStatusLabelFR,
  getProjectQuoteStatusLabelFR,
} from '@/lib/billingStatus';
import { BillingQuotesSection } from '@/components/pro/projects/billing/BillingQuotesSection';
import { BillingInvoicesSection } from '@/components/pro/projects/billing/BillingInvoicesSection';
import { BillingServiceCard } from '@/components/pro/projects/billing/BillingServiceCard';
import type { ServiceDraft, PricingLine } from '@/components/pro/projects/billing/BillingServiceCard';
import type { SummaryTotals } from '@/components/pro/projects/hooks/useBillingComputed';
import type {
  ServiceItem,
  TaskItem,
  MemberItem,
  QuoteItem,
  InvoiceItem,
} from '@/components/pro/projects/hooks/useProjectDataLoaders';

// ─── Local types ─────────────────────────────────────────────────────────────

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
        <SectionCard className="border-[var(--danger-border)] bg-[var(--danger-bg)] text-sm text-[var(--danger)]">
          {billingError}
        </SectionCard>
      ) : null}
      {billingInfo ? <p className="text-sm text-[var(--success)]">{billingInfo}</p> : null}
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
          {prestationsError ? <p className="text-xs text-[var(--danger)]">{prestationsError}</p> : null}
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
          <div className="mt-4 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3 text-xs text-[var(--danger)]">
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
              return (
                <BillingServiceCard
                  key={svc.id}
                  svc={svc}
                  draft={draft}
                  line={pricingByServiceId.get(svc.id)}
                  lineError={lineErrors[svc.id]}
                  isLineSaving={lineSavingId === svc.id}
                  isDragOver={dragOverServiceId === svc.id && draggingServiceId !== svc.id}
                  durationHours={catalogDurationById.get(svc.serviceId)}
                  serviceTasks={tasksByServiceId.get(svc.id) ?? []}
                  tasksOpen={!!openServiceTasks[svc.id]}
                  notesOpen={!!openNotes[svc.id]}
                  applyingTemplates={!!templatesApplying[svc.id]}
                  isRecurringGenerating={recurringInvoiceActionId === svc.id}
                  reordering={reordering}
                  members={members}
                  taskUpdating={taskUpdating}
                  isAdmin={isAdmin}
                  onDragOver={(e) => onServiceDragOver(e, svc.id)}
                  onDrop={(e) => onServiceDrop(e, svc.id)}
                  onDragStart={(e) => onServiceDragStart(e, svc.id)}
                  onDragEnd={onServiceDragEnd}
                  onDraftChange={(patch) =>
                    setServiceDrafts((prev) => ({
                      ...prev,
                      [svc.id]: { ...(prev[svc.id] ?? draft), ...patch },
                    }))
                  }
                  onClearError={() => setLineErrors((prev) => ({ ...prev, [svc.id]: '' }))}
                  onToggleNotes={() => setOpenNotes((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                  onToggleTasks={() => setOpenServiceTasks((prev) => ({ ...prev, [svc.id]: !prev[svc.id] }))}
                  onDelete={() => onDeleteService(svc.id)}
                  onSave={() => onUpdateService(svc.id)}
                  onApplyTemplates={() => onApplyServiceTemplates(svc.id)}
                  onGenerateRecurring={() => onGenerateRecurringInvoice(svc.id)}
                  onUpdateTask={onUpdateTask}
                />
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
