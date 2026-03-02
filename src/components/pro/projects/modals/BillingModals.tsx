"use client";

import type { Dispatch, SetStateAction } from 'react';
import { StagedInvoiceModal } from '@/components/pro/projects/modals/StagedInvoiceModal';
import type { StagedInvoiceModalState } from '@/components/pro/projects/modals/StagedInvoiceModal';
import { QuoteEditorModal } from '@/components/pro/projects/modals/QuoteEditorModal';
import type { QuoteEditorModalState, QuoteEditorModalLine } from '@/components/pro/projects/modals/QuoteEditorModal';
import { InvoiceEditorModal } from '@/components/pro/projects/modals/InvoiceEditorModal';
import type { InvoiceEditorModalState, InvoiceEditorModalLine } from '@/components/pro/projects/modals/InvoiceEditorModal';
import { QuoteDateModal } from '@/components/pro/projects/modals/QuoteDateModal';
import type { QuoteDateEditorState } from '@/components/pro/projects/modals/QuoteDateModal';
import { CancelQuoteModal } from '@/components/pro/projects/modals/CancelQuoteModal';
import type { CancelQuoteEditorState } from '@/components/pro/projects/modals/CancelQuoteModal';
import { InvoiceDateModal } from '@/components/pro/projects/modals/InvoiceDateModal';
import type { InvoiceDateEditorState } from '@/components/pro/projects/modals/InvoiceDateModal';
import { DepositDateModal } from '@/components/pro/projects/modals/DepositDateModal';
import { sanitizeEuroInput, parseEuroToCents } from '@/lib/money';

// ─── Props ──────────────────────────────────────────────────────────────────────

export type BillingModalsProps = {
  isAdmin: boolean;
  summaryTotalsCents: number;
  remainingToInvoiceCents: number;
  // Staged invoice
  stagedInvoiceModal: StagedInvoiceModalState | null;
  setStagedInvoiceModal: Dispatch<SetStateAction<StagedInvoiceModalState | null>>;
  stagedInvoiceError: string | null;
  stagedInvoiceLoading: boolean;
  onCloseStagedInvoice: () => void;
  onCreateStagedInvoice: () => void;
  // Quote editor
  quoteEditor: QuoteEditorModalState | null;
  setQuoteEditor: Dispatch<SetStateAction<QuoteEditorModalState | null>>;
  quoteEditing: boolean;
  quoteEditError: string | null;
  onCloseQuoteEditor: () => void;
  onSaveQuoteEdit: () => void;
  onAddQuoteLine: () => void;
  onRemoveQuoteLine: (lineId: string) => void;
  // Invoice editor
  invoiceEditor: InvoiceEditorModalState | null;
  setInvoiceEditor: Dispatch<SetStateAction<InvoiceEditorModalState | null>>;
  invoiceEditing: boolean;
  invoiceEditError: string | null;
  onCloseInvoiceEditor: () => void;
  onSaveInvoiceEdit: () => void;
  onAddInvoiceLine: () => void;
  onRemoveInvoiceLine: (lineId: string) => void;
  // Quote date
  quoteDateEditor: QuoteDateEditorState | null;
  setQuoteDateEditor: Dispatch<SetStateAction<QuoteDateEditorState | null>>;
  dateModalSaving: boolean;
  dateModalError: string | null;
  setDateModalError: Dispatch<SetStateAction<string | null>>;
  onSaveQuoteDate: () => void;
  // Cancel quote
  cancelQuoteEditor: CancelQuoteEditorState | null;
  setCancelQuoteEditor: Dispatch<SetStateAction<CancelQuoteEditorState | null>>;
  cancelQuoteSaving: boolean;
  cancelQuoteError: string | null;
  onCancelQuote: () => void;
  // Invoice date
  invoiceDateEditor: InvoiceDateEditorState | null;
  setInvoiceDateEditor: Dispatch<SetStateAction<InvoiceDateEditorState | null>>;
  onSaveInvoiceDate: () => void;
  // Deposit date
  depositDateEditorOpen: boolean;
  setDepositDateEditorOpen: Dispatch<SetStateAction<boolean>>;
  depositPaidDraft: string;
  setDepositPaidDraft: Dispatch<SetStateAction<string>>;
  projectDepositStatus: string | null | undefined;
  onSaveDepositDate: () => void;
};

export function BillingModals(props: BillingModalsProps) {
  const {
    isAdmin,
    summaryTotalsCents,
    remainingToInvoiceCents,
    stagedInvoiceModal,
    setStagedInvoiceModal,
    stagedInvoiceError,
    stagedInvoiceLoading,
    onCloseStagedInvoice,
    onCreateStagedInvoice,
    quoteEditor,
    setQuoteEditor,
    quoteEditing,
    quoteEditError,
    onCloseQuoteEditor,
    onSaveQuoteEdit,
    onAddQuoteLine,
    onRemoveQuoteLine,
    invoiceEditor,
    setInvoiceEditor,
    invoiceEditing,
    invoiceEditError,
    onCloseInvoiceEditor,
    onSaveInvoiceEdit,
    onAddInvoiceLine,
    onRemoveInvoiceLine,
    quoteDateEditor,
    setQuoteDateEditor,
    dateModalSaving,
    dateModalError,
    onSaveQuoteDate,
    cancelQuoteEditor,
    setCancelQuoteEditor,
    cancelQuoteSaving,
    cancelQuoteError,
    onCancelQuote,
    invoiceDateEditor,
    setInvoiceDateEditor,
    onSaveInvoiceDate,
    depositDateEditorOpen,
    setDepositDateEditorOpen,
    depositPaidDraft,
    setDepositPaidDraft,
    projectDepositStatus,
    onSaveDepositDate,
  } = props;

  // Staged invoice computed
  const stagedMode = stagedInvoiceModal?.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal?.mode ?? 'PERCENT';
  const stagedPercentValue =
    stagedMode === 'PERCENT' ? Number(stagedInvoiceModal?.value ?? '') : null;
  const stagedAmountValue =
    stagedMode === 'AMOUNT' ? (() => { const c = parseEuroToCents(stagedInvoiceModal?.value ?? ''); return Number.isFinite(c) ? c : null; })() : null;
  const stagedPreviewCents =
    stagedMode === 'FINAL'
      ? remainingToInvoiceCents
      : stagedMode === 'PERCENT'
        ? Number.isFinite(stagedPercentValue ?? NaN)
          ? Math.round(summaryTotalsCents * ((stagedPercentValue ?? 0) / 100))
          : 0
        : stagedAmountValue ?? 0;
  const stagedPreviewTooHigh = stagedPreviewCents > remainingToInvoiceCents;

  // Editor computed
  const quoteEditStatus = quoteEditor?.status ?? null;
  const canEditQuoteLines = quoteEditStatus === 'DRAFT';
  const canEditQuoteMeta = quoteEditStatus === 'DRAFT' || quoteEditStatus === 'SENT';
  const invoiceEditStatus = invoiceEditor?.status ?? null;
  const canEditInvoiceLines = invoiceEditStatus === 'DRAFT';
  const canEditInvoiceMeta = invoiceEditStatus === 'DRAFT' || invoiceEditStatus === 'SENT';

  return (
    <>
      <StagedInvoiceModal
        editor={stagedInvoiceModal}
        totalCents={summaryTotalsCents}
        remainingCents={remainingToInvoiceCents}
        previewCents={stagedPreviewCents}
        previewTooHigh={stagedPreviewTooHigh}
        error={stagedInvoiceError}
        loading={stagedInvoiceLoading}
        isAdmin={isAdmin}
        onClose={onCloseStagedInvoice}
        onModeChange={(mode) =>
          setStagedInvoiceModal((prev) => prev ? { ...prev, mode } : prev)
        }
        onValueChange={(value) =>
          setStagedInvoiceModal((prev) =>
            prev
              ? { ...prev, value: prev.mode === 'AMOUNT' ? sanitizeEuroInput(value) : value }
              : prev
          )
        }
        onCreate={onCreateStagedInvoice}
      />

      <QuoteEditorModal
        editor={quoteEditor}
        isAdmin={isAdmin}
        canEditMeta={canEditQuoteMeta}
        canEditLines={canEditQuoteLines}
        editing={quoteEditing}
        error={quoteEditError}
        onClose={onCloseQuoteEditor}
        onSave={onSaveQuoteEdit}
        onAddLine={onAddQuoteLine}
        onRemoveLine={onRemoveQuoteLine}
        onChangeIssuedAt={(value) => setQuoteEditor((prev) => (prev ? { ...prev, issuedAt: value } : prev))}
        onChangeExpiresAt={(value) => setQuoteEditor((prev) => (prev ? { ...prev, expiresAt: value } : prev))}
        onChangeNote={(value) => setQuoteEditor((prev) => (prev ? { ...prev, note: value } : prev))}
        onChangeLine={(lineId, patch: Partial<QuoteEditorModalLine>) =>
          setQuoteEditor((prev) =>
            prev
              ? {
                  ...prev,
                  lines: prev.lines.map((line) =>
                    line.id === lineId
                      ? { ...line, ...patch, unitPrice: patch.unitPrice != null ? sanitizeEuroInput(patch.unitPrice) : line.unitPrice }
                      : line
                  ),
                }
              : prev
          )
        }
      />

      <InvoiceEditorModal
        editor={invoiceEditor}
        isAdmin={isAdmin}
        canEditMeta={canEditInvoiceMeta}
        canEditLines={canEditInvoiceLines}
        editing={invoiceEditing}
        error={invoiceEditError}
        onClose={onCloseInvoiceEditor}
        onSave={onSaveInvoiceEdit}
        onAddLine={onAddInvoiceLine}
        onRemoveLine={onRemoveInvoiceLine}
        onChangeIssuedAt={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, issuedAt: value } : prev))}
        onChangeDueAt={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, dueAt: value } : prev))}
        onChangeNote={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, note: value } : prev))}
        onChangeLine={(lineId, patch: Partial<InvoiceEditorModalLine>) =>
          setInvoiceEditor((prev) =>
            prev
              ? {
                  ...prev,
                  lines: prev.lines.map((line) =>
                    line.id === lineId
                      ? { ...line, ...patch, unitPrice: patch.unitPrice != null ? sanitizeEuroInput(patch.unitPrice) : line.unitPrice }
                      : line
                  ),
                }
              : prev
          )
        }
      />

      <QuoteDateModal
        editor={quoteDateEditor}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangeSignedAt={(value) => setQuoteDateEditor((prev) => (prev ? { ...prev, signedAt: value } : prev))}
        onClose={() => setQuoteDateEditor(null)}
        onSave={onSaveQuoteDate}
      />

      <CancelQuoteModal
        editor={cancelQuoteEditor}
        isAdmin={isAdmin}
        saving={cancelQuoteSaving}
        error={cancelQuoteError}
        onChangeReason={(value) => setCancelQuoteEditor((prev) => (prev ? { ...prev, reason: value } : prev))}
        onClose={() => setCancelQuoteEditor(null)}
        onConfirm={onCancelQuote}
      />

      <InvoiceDateModal
        editor={invoiceDateEditor}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangePaidAt={(value) => setInvoiceDateEditor((prev) => (prev ? { ...prev, paidAt: value } : prev))}
        onClose={() => setInvoiceDateEditor(null)}
        onSave={onSaveInvoiceDate}
      />

      <DepositDateModal
        open={depositDateEditorOpen}
        depositStatus={projectDepositStatus}
        paidAt={depositPaidDraft}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangePaidAt={setDepositPaidDraft}
        onClose={() => setDepositDateEditorOpen(false)}
        onSave={onSaveDepositDate}
      />
    </>
  );
}
