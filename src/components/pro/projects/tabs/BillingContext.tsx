"use client";

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { ServiceDraft, PricingLine } from '@/components/pro/projects/billing/BillingServiceCard';
import type { SummaryTotals } from '@/components/pro/projects/hooks/useBillingComputed';
import type {
  ServiceItem,
  TaskItem,
  MemberItem,
  QuoteItem,
  InvoiceItem,
} from '@/components/pro/projects/hooks/useProjectDataLoaders';

// ─── Legal blocks type ───────────────────────────────────────────────────────

type LegalBlocks = {
  filled: number;
  total: number;
  blocks: Array<{ label: string; value?: string | null }>;
};

// ─── Context value ───────────────────────────────────────────────────────────

export type BillingContextValue = {
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
};

// ─── Context ─────────────────────────────────────────────────────────────────

const BillingContext = createContext<BillingContextValue | null>(null);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBillingContext(): BillingContextValue {
  const ctx = useContext(BillingContext);
  if (!ctx) {
    throw new Error('useBillingContext must be used within a BillingProvider');
  }
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function BillingProvider({
  value,
  children,
}: {
  value: BillingContextValue;
  children: ReactNode;
}) {
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}
