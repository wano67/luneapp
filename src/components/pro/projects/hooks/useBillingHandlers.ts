import { useEffect, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';
import type { StagedInvoiceModalState } from '@/components/pro/projects/modals/StagedInvoiceModal';
import type { QuoteDateEditorState } from '@/components/pro/projects/modals/QuoteDateModal';
import type { CancelQuoteEditorState } from '@/components/pro/projects/modals/CancelQuoteModal';
import type { InvoiceDateEditorState } from '@/components/pro/projects/modals/InvoiceDateModal';

// ─── Local types ──────────────────────────────────────────────────────────────

type EditableLine = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
  serviceId?: string | null;
  productId?: string | null;
};

export type QuoteEditorState = {
  quoteId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  expiresAt: string;
  note: string;
  lines: EditableLine[];
};

export type InvoiceEditorState = {
  invoiceId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  dueAt: string;
  note: string;
  lines: EditableLine[];
};

type InvoiceLineItem = {
  id: string;
  serviceId: string | null;
  productId: string | null;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  totalCents: string;
};

type InvoiceDetailLocal = {
  id: string;
  status: string;
  number: string | null;
  note: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items: InvoiceLineItem[];
};

type QuoteItemLocal = {
  id: string;
  status: string;
  number: string | null;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  note: string | null;
  items?: Array<{
    id: string;
    serviceId: string | null;
    label: string;
    description?: string | null;
    quantity: number;
    unitPriceCents: string;
    totalCents: string;
  }>;
};

type InvoiceItemLocal = {
  id: string;
  status: string;
  number: string | null;
  paidAt: string | null;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toEditableLine(item: {
  id: string;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  serviceId?: string | null;
  productId?: string | null;
}): EditableLine {
  return {
    id: item.id,
    label: item.label,
    description: item.description ?? '',
    quantity: String(item.quantity),
    unitPrice: formatCentsToEuroInput(item.unitPriceCents),
    serviceId: item.serviceId ?? null,
    productId: item.productId ?? null,
  };
}

function createNewLine(): EditableLine {
  return { id: `new-${Date.now()}`, label: '', description: '', quantity: '1', unitPrice: '', serviceId: null, productId: null };
}

type ParsedLineItem = {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unitPriceCents: number;
  serviceId: string | null;
  productId: string | null;
};

function validateLineItems(lines: EditableLine[], onError: (msg: string) => void): ParsedLineItem[] | null {
  if (!lines.length) { onError('Ajoute au moins une ligne.'); return null; }
  const items: ParsedLineItem[] = [];
  for (const line of lines) {
    const label = line.label.trim();
    if (!label) { onError('Chaque ligne doit avoir un libellé.'); return null; }
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) { onError('Quantité invalide.'); return null; }
    const unitPriceCents = parseEuroInputCents(line.unitPrice);
    if (unitPriceCents == null) { onError('Prix unitaire invalide.'); return null; }
    items.push({
      id: line.id, label, description: line.description.trim() || null,
      quantity: Math.max(1, Math.trunc(qty)), unitPriceCents,
      serviceId: line.serviceId ?? null, productId: line.productId ?? null,
    });
  }
  return items;
}

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseBillingHandlersOptions = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  projectDepositPaidAt: string | null | undefined;
  servicesLength: number;
  pricingMissingCount: number;
  summaryTotals: { depositPercent: number; totalCents: number };
  remainingToInvoiceCents: number;
  loadQuotes: () => Promise<void>;
  loadInvoices: () => Promise<void>;
  loadProject: () => Promise<string | null>;
  refetchAll: () => Promise<void>;
  onBillingError: (msg: string | null) => void;
  onBillingInfo: (msg: string | null) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBillingHandlers({
  businessId,
  projectId,
  isAdmin,
  projectDepositPaidAt,
  servicesLength,
  pricingMissingCount,
  summaryTotals,
  remainingToInvoiceCents,
  loadQuotes,
  loadInvoices,
  loadProject,
  refetchAll,
  onBillingError,
  onBillingInfo,
}: UseBillingHandlersOptions) {
  // ─── Quote / Invoice editors ───────────────────────────────────────────────
  const [quoteEditor, setQuoteEditor] = useState<QuoteEditorState | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null);
  const [quoteEditError, setQuoteEditError] = useState<string | null>(null);
  const [invoiceEditError, setInvoiceEditError] = useState<string | null>(null);
  const [quoteEditing, setQuoteEditing] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState(false);

  // ─── Staged invoice ────────────────────────────────────────────────────────
  const [stagedInvoiceModal, setStagedInvoiceModal] = useState<StagedInvoiceModalState | null>(null);
  const [stagedInvoiceError, setStagedInvoiceError] = useState<string | null>(null);
  const [stagedInvoiceLoading, setStagedInvoiceLoading] = useState(false);

  // ─── Quote actions ─────────────────────────────────────────────────────────
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteActionId, setQuoteActionId] = useState<string | null>(null);
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [recurringInvoiceActionId, setRecurringInvoiceActionId] = useState<string | null>(null);
  const [referenceUpdatingId, setReferenceUpdatingId] = useState<string | null>(null);

  // ─── Date modals ───────────────────────────────────────────────────────────
  const [quoteDateEditor, setQuoteDateEditor] = useState<QuoteDateEditorState | null>(null);
  const [cancelQuoteEditor, setCancelQuoteEditor] = useState<CancelQuoteEditorState | null>(null);
  const [cancelQuoteError, setCancelQuoteError] = useState<string | null>(null);
  const [cancelQuoteSaving, setCancelQuoteSaving] = useState(false);
  const [invoiceDateEditor, setInvoiceDateEditor] = useState<InvoiceDateEditorState | null>(null);
  const [depositDateEditorOpen, setDepositDateEditorOpen] = useState(false);
  const [depositPaidDraft, setDepositPaidDraft] = useState('');
  const [dateModalError, setDateModalError] = useState<string | null>(null);
  const [dateModalSaving, setDateModalSaving] = useState(false);

  // Sync deposit draft from project
  useEffect(() => {
    setDepositPaidDraft(projectDepositPaidAt ? projectDepositPaidAt.slice(0, 10) : '');
  }, [projectDepositPaidAt]);

  // ─── Admin guard ─────────────────────────────────────────────────────────
  function requireAdmin(onError: (msg: string) => void): boolean {
    if (!isAdmin) { onError('Réservé aux admins/owners.'); return false; }
    return true;
  }

  // ─── Generic delete ──────────────────────────────────────────────────────
  async function handleDeleteDocument(
    docId: string,
    endpoint: string,
    confirmMsg: string,
    setActionId: (id: string | null) => void,
    reloadFn: () => Promise<unknown>,
    successMsg: string,
  ) {
    if (!requireAdmin(onBillingError)) return;
    if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;
    onBillingError(null);
    onBillingInfo(null);
    setActionId(docId);
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/${endpoint}/${docId}`, { method: 'DELETE' });
      if (!res.ok) { onBillingError(res.error ?? 'Suppression impossible.'); return; }
      await reloadFn();
      onBillingInfo(successMsg);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  // ─── Quote CRUD ────────────────────────────────────────────────────────────

  async function handleCreateQuote() {
    if (!requireAdmin(onBillingError)) return;
    if (!servicesLength) {
      onBillingError('Ajoute au moins un service avant de créer un devis.');
      return;
    }
    if (pricingMissingCount > 0) {
      onBillingError('Renseigne les tarifs manquants avant de créer un devis.');
      return;
    }
    setCreatingQuote(true);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
        { method: 'POST' }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Création du devis impossible.');
        return;
      }
      onBillingInfo('Devis créé.');
      await Promise.all([loadQuotes(), loadInvoices(), loadProject()]);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setCreatingQuote(false);
    }
  }

  function openCancelQuoteModal(quote: QuoteItemLocal) {
    if (!requireAdmin(onBillingError)) return;
    setCancelQuoteError(null);
    setCancelQuoteEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      reason: '',
    });
  }

  async function handleCancelQuote() {
    if (!cancelQuoteEditor) return;
    if (!requireAdmin(setCancelQuoteError)) return;
    const reason = cancelQuoteEditor.reason.trim();
    if (!reason) {
      setCancelQuoteError('La raison est requise.');
      return;
    }
    if (cancelQuoteSaving) return;
    setCancelQuoteSaving(true);
    setCancelQuoteError(null);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItemLocal }>(
        `/api/pro/businesses/${businessId}/quotes/${cancelQuoteEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED', cancelReason: reason }),
        }
      );
      if (!res.ok) {
        setCancelQuoteError(res.error ?? 'Annulation impossible.');
        return;
      }
      setCancelQuoteEditor(null);
      await refetchAll();
    } catch (err) {
      setCancelQuoteError(getErrorMessage(err));
    } finally {
      setCancelQuoteSaving(false);
    }
  }

  async function handleSetBillingReference(quoteId: string) {
    if (!requireAdmin(onBillingError)) return;
    setReferenceUpdatingId(quoteId);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingQuoteId: quoteId }),
        }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Impossible de définir le devis de référence.');
        return;
      }
      onBillingInfo('Devis de référence mis à jour.');
      await loadProject();
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setReferenceUpdatingId(null);
    }
  }

  async function handleQuoteStatus(quoteId: string, nextStatus: 'SENT' | 'SIGNED' | 'EXPIRED') {
    if (!requireAdmin(onBillingError)) return;
    setQuoteActionId(quoteId);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItemLocal }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Mise à jour du devis impossible.');
        return;
      }
      await Promise.all([loadQuotes(), loadProject()]);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setQuoteActionId(null);
    }
  }

  async function handleCreateInvoice(quoteId: string) {
    if (!requireAdmin(onBillingError)) return;
    setInvoiceActionId(quoteId);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ item: { id: string } }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
        { method: 'POST' }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      onBillingInfo('Facture créée.');
      await Promise.all([loadInvoices(), loadProject()]);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  async function handleGenerateRecurringInvoice(projectServiceId: string) {
    if (!requireAdmin(onBillingError)) return;
    setRecurringInvoiceActionId(projectServiceId);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${projectServiceId}/recurring-invoices`,
        { method: 'POST' }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Création de la facture mensuelle impossible.');
        return;
      }
      onBillingInfo('Facture mensuelle créée.');
      await Promise.all([loadInvoices(), loadProject()]);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setRecurringInvoiceActionId(null);
    }
  }

  // ─── Staged invoice ────────────────────────────────────────────────────────

  function openStagedInvoiceModal(kind: 'DEPOSIT' | 'MID' | 'FINAL') {
    if (!requireAdmin(onBillingError)) return;
    const defaultValue =
      kind === 'DEPOSIT' && Number.isFinite(summaryTotals.depositPercent)
        ? String(summaryTotals.depositPercent)
        : '';
    setStagedInvoiceModal({ kind, mode: 'PERCENT', value: defaultValue });
    setStagedInvoiceError(null);
  }

  function closeStagedInvoiceModal() {
    setStagedInvoiceModal(null);
    setStagedInvoiceError(null);
  }

  async function handleCreateStagedInvoice() {
    if (!stagedInvoiceModal) return;
    if (!requireAdmin(setStagedInvoiceError)) return;
    if (remainingToInvoiceCents <= 0) {
      setStagedInvoiceError('Aucun montant restant à facturer.');
      return;
    }

    const mode = stagedInvoiceModal.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal.mode;
    let value: number | undefined;
    if (mode === 'PERCENT') {
      const percent = Number(stagedInvoiceModal.value);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        setStagedInvoiceError('Pourcentage invalide.');
        return;
      }
      value = percent;
    } else if (mode === 'AMOUNT') {
      const cents = parseEuroInputCents(stagedInvoiceModal.value);
      if (cents == null || cents <= 0) {
        setStagedInvoiceError('Montant invalide.');
        return;
      }
      value = cents;
    }

    const previewAmount =
      mode === 'FINAL'
        ? remainingToInvoiceCents
        : mode === 'PERCENT' && value != null
          ? Math.round(summaryTotals.totalCents * (value / 100))
          : value ?? 0;

    if (previewAmount > remainingToInvoiceCents) {
      setStagedInvoiceError('Le montant dépasse le reste à facturer.');
      return;
    }

    setStagedInvoiceLoading(true);
    setStagedInvoiceError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/invoices/staged`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'FINAL' ? { mode } : { mode, value }),
        }
      );
      if (!res.ok) {
        setStagedInvoiceError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      onBillingInfo('Facture créée.');
      closeStagedInvoiceModal();
      await Promise.all([loadInvoices(), loadProject()]);
    } catch (err) {
      setStagedInvoiceError(getErrorMessage(err));
    } finally {
      setStagedInvoiceLoading(false);
    }
  }

  async function handleInvoiceStatus(invoiceId: string, nextStatus: 'SENT' | 'CANCELLED') {
    if (!requireAdmin(onBillingError)) return;
    setInvoiceActionId(invoiceId);
    onBillingError(null);
    onBillingInfo(null);
    try {
      const res = await fetchJson<{ item: InvoiceItemLocal }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        onBillingError(res.error ?? 'Mise à jour de la facture impossible.');
        return;
      }
      await Promise.all([loadInvoices(), loadProject()]);
    } catch (err) {
      onBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  // ─── Date modals ───────────────────────────────────────────────────────────

  function openQuoteDateModal(quote: QuoteItemLocal) {
    if (!requireAdmin(onBillingError)) return;
    setDateModalError(null);
    setQuoteDateEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      signedAt: quote.signedAt ? quote.signedAt.slice(0, 10) : '',
    });
  }

  function openInvoiceDateModal(invoice: InvoiceItemLocal) {
    if (!requireAdmin(onBillingError)) return;
    setDateModalError(null);
    setInvoiceDateEditor({
      invoiceId: invoice.id,
      number: invoice.number ?? null,
      status: invoice.status,
      paidAt: invoice.paidAt ? invoice.paidAt.slice(0, 10) : '',
    });
  }

  async function handleSaveQuoteDate() {
    if (!quoteDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItemLocal }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteDateEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signedAt: quoteDateEditor.signedAt ? new Date(quoteDateEditor.signedAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadQuotes();
      setQuoteDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveInvoiceDate() {
    if (!invoiceDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ item: InvoiceItemLocal }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceDateEditor.invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paidAt: invoiceDateEditor.paidAt ? new Date(invoiceDateEditor.paidAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await Promise.all([loadInvoices(), loadProject()]);
      setInvoiceDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveDepositDate() {
    if (!projectDepositPaidAt && projectDepositPaidAt !== null) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depositPaidAt: depositPaidDraft ? new Date(depositPaidDraft).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await refetchAll();
      setDepositDateEditorOpen(false);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  // ─── Quote editor ──────────────────────────────────────────────────────────

  function openQuoteEditor(quote: QuoteItemLocal) {
    if (!requireAdmin(onBillingError)) return;
    const lines = (quote.items ?? []).map(toEditableLine);
    setQuoteEditError(null);
    setQuoteEditor({
      quoteId: quote.id,
      status: quote.status,
      number: quote.number ?? null,
      issuedAt: toDateInput(quote.issuedAt ?? quote.createdAt),
      expiresAt: toDateInput(quote.expiresAt),
      note: quote.note ?? '',
      lines,
    });
  }

  function closeQuoteEditor() {
    setQuoteEditor(null);
    setQuoteEditError(null);
  }

  function addQuoteLine() {
    if (!quoteEditor) return;
    setQuoteEditor({ ...quoteEditor, lines: [...quoteEditor.lines, createNewLine()] });
  }

  function removeQuoteLine(lineId: string) {
    if (!quoteEditor) return;
    setQuoteEditor({ ...quoteEditor, lines: quoteEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveQuoteEdit() {
    if (!quoteEditor || quoteEditing) return;
    if (!requireAdmin(setQuoteEditError)) return;

    const editableStatus = quoteEditor.status === 'DRAFT' || quoteEditor.status === 'SENT';
    if (!editableStatus) {
      setQuoteEditError('Devis signé/annulé: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {
      issuedAt: quoteEditor.issuedAt ? new Date(quoteEditor.issuedAt).toISOString() : null,
      expiresAt: quoteEditor.expiresAt ? new Date(quoteEditor.expiresAt).toISOString() : null,
      note: quoteEditor.note.trim() || null,
    };

    if (quoteEditor.status === 'DRAFT') {
      const items = validateLineItems(quoteEditor.lines, setQuoteEditError);
      if (!items) return;
      payload.items = items.map(({ productId: _productId, ...rest }) => rest);
    }

    setQuoteEditing(true);
    setQuoteEditError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItemLocal }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteEditor.quoteId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (!res.ok) { setQuoteEditError(res.error ?? 'Mise à jour impossible.'); return; }
      await loadQuotes();
      onBillingInfo('Devis mis à jour.');
      closeQuoteEditor();
    } catch (err) {
      setQuoteEditError(getErrorMessage(err));
    } finally {
      setQuoteEditing(false);
    }
  }

  async function handleDeleteQuote(quoteId: string) {
    await handleDeleteDocument(
      quoteId, 'quotes',
      'Supprimer ce devis ? Cette action est irréversible.',
      setQuoteActionId, () => loadQuotes(), 'Devis supprimé.',
    );
  }

  // ─── Invoice editor ────────────────────────────────────────────────────────

  async function openInvoiceEditor(invoiceId: string) {
    if (!requireAdmin(onBillingError)) return;
    setInvoiceEditError(null);
    setInvoiceEditor(null);
    try {
      const res = await fetchJson<{ item: InvoiceDetailLocal }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
        { cache: 'no-store' }
      );
      if (!res.ok || !res.data) {
        setInvoiceEditError(res.error ?? 'Facture introuvable.');
        return;
      }
      const invoice = res.data.item;
      setInvoiceEditor({
        invoiceId: invoice.id,
        status: invoice.status,
        number: invoice.number ?? null,
        issuedAt: toDateInput(invoice.issuedAt ?? invoice.createdAt),
        dueAt: toDateInput(invoice.dueAt),
        note: invoice.note ?? '',
        lines: invoice.items.map(toEditableLine),
      });
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    }
  }

  function closeInvoiceEditor() {
    setInvoiceEditor(null);
    setInvoiceEditError(null);
  }

  function addInvoiceLine() {
    if (!invoiceEditor) return;
    setInvoiceEditor({ ...invoiceEditor, lines: [...invoiceEditor.lines, createNewLine()] });
  }

  function removeInvoiceLine(lineId: string) {
    if (!invoiceEditor) return;
    setInvoiceEditor({ ...invoiceEditor, lines: invoiceEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveInvoiceEdit() {
    if (!invoiceEditor || invoiceEditing) return;
    if (!requireAdmin(setInvoiceEditError)) return;

    const editableStatus = invoiceEditor.status === 'DRAFT' || invoiceEditor.status === 'SENT';
    if (!editableStatus) {
      setInvoiceEditError('Facture payée/annulée: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {
      issuedAt: invoiceEditor.issuedAt ? new Date(invoiceEditor.issuedAt).toISOString() : null,
      dueAt: invoiceEditor.dueAt ? new Date(invoiceEditor.dueAt).toISOString() : null,
      note: invoiceEditor.note.trim() || null,
    };

    if (invoiceEditor.status === 'DRAFT') {
      const items = validateLineItems(invoiceEditor.lines, setInvoiceEditError);
      if (!items) return;
      payload.lineItems = items;
    }

    setInvoiceEditing(true);
    setInvoiceEditError(null);
    try {
      const res = await fetchJson<{ item: InvoiceItemLocal }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceEditor.invoiceId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (!res.ok) { setInvoiceEditError(res.error ?? 'Mise à jour impossible.'); return; }
      await Promise.all([loadInvoices(), loadProject()]);
      onBillingInfo('Facture mise à jour.');
      closeInvoiceEditor();
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    } finally {
      setInvoiceEditing(false);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    await handleDeleteDocument(
      invoiceId, 'invoices',
      'Supprimer cette facture ? Cette action est irréversible.',
      setInvoiceActionId, () => Promise.all([loadInvoices(), loadProject()]).then(() => {}), 'Facture supprimée.',
    );
  }

  return {
    // State
    quoteEditor,
    setQuoteEditor,
    invoiceEditor,
    setInvoiceEditor,
    quoteEditError,
    invoiceEditError,
    quoteEditing,
    invoiceEditing,
    stagedInvoiceModal,
    setStagedInvoiceModal,
    stagedInvoiceError,
    stagedInvoiceLoading,
    creatingQuote,
    quoteActionId,
    invoiceActionId,
    recurringInvoiceActionId,
    referenceUpdatingId,
    quoteDateEditor,
    setQuoteDateEditor,
    cancelQuoteEditor,
    setCancelQuoteEditor,
    cancelQuoteError,
    cancelQuoteSaving,
    invoiceDateEditor,
    setInvoiceDateEditor,
    depositDateEditorOpen,
    setDepositDateEditorOpen,
    depositPaidDraft,
    setDepositPaidDraft,
    dateModalError,
    setDateModalError,
    dateModalSaving,
    // Handlers
    handleCreateQuote,
    openCancelQuoteModal,
    handleCancelQuote,
    handleSetBillingReference,
    handleQuoteStatus,
    handleCreateInvoice,
    handleGenerateRecurringInvoice,
    openStagedInvoiceModal,
    closeStagedInvoiceModal,
    handleCreateStagedInvoice,
    handleInvoiceStatus,
    openQuoteDateModal,
    openInvoiceDateModal,
    handleSaveQuoteDate,
    handleSaveInvoiceDate,
    handleSaveDepositDate,
    openQuoteEditor,
    closeQuoteEditor,
    addQuoteLine,
    removeQuoteLine,
    handleSaveQuoteEdit,
    handleDeleteQuote,
    openInvoiceEditor,
    closeInvoiceEditor,
    addInvoiceLine,
    removeInvoiceLine,
    handleSaveInvoiceEdit,
    handleDeleteInvoice,
  };
}
