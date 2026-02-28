import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';
import type { PaymentFormState } from '@/components/pro/projects/modals/PaymentModal';

// ─── Local types ──────────────────────────────────────────────────────────────

export type InvoiceItem = {
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

export type PaymentItem = {
  id: string;
  amountCents: string;
  paidAt: string;
  method: string;
  reference: string | null;
  note: string | null;
  createdBy?: { id: string; name?: string | null; email?: string | null } | null;
  createdAt: string;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}

function getInvoiceRemainingCents(invoice: InvoiceItem): number {
  const remaining = invoice.remainingCents != null ? Number(invoice.remainingCents) : NaN;
  if (Number.isFinite(remaining)) return Math.max(0, remaining);
  const paid = getInvoicePaidCents(invoice);
  return Math.max(0, Number(invoice.totalCents) - paid);
}

// ─── Hook types ───────────────────────────────────────────────────────────────

type UsePaymentModalOptions = {
  businessId: string;
  isAdmin: boolean;
  invoices: InvoiceItem[];
  loadInvoices: () => Promise<void>;
  onBillingInfo: (msg: string | null) => void;
  onBillingError: (msg: string) => void;
};

const defaultForm: PaymentFormState = {
  amount: '',
  paidAt: '',
  method: 'WIRE',
  reference: '',
  note: '',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaymentModal({
  businessId,
  isAdmin,
  invoices,
  loadInvoices,
  onBillingInfo,
  onBillingError,
}: UsePaymentModalOptions) {
  const [paymentModal, setPaymentModal] = useState<{ invoice: InvoiceItem } | null>(null);
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentDeletingId, setPaymentDeletingId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(defaultForm);

  // Auto-dismiss notice after 3s
  useEffect(() => {
    if (!paymentNotice) return;
    const timer = setTimeout(() => setPaymentNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [paymentNotice]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activePaymentInvoice = useMemo(() => {
    if (!paymentModal) return null;
    return invoices.find((inv) => inv.id === paymentModal.invoice.id) ?? paymentModal.invoice;
  }, [paymentModal, invoices]);

  const paymentTotalCents = activePaymentInvoice ? Number(activePaymentInvoice.totalCents) : 0;
  const paymentPaidCents = activePaymentInvoice ? getInvoicePaidCents(activePaymentInvoice) : 0;
  const paymentRemainingCents = activePaymentInvoice ? getInvoiceRemainingCents(activePaymentInvoice) : 0;

  const applyPaymentShortcut = useCallback(
    (ratio: number) => {
      if (!Number.isFinite(paymentRemainingCents) || paymentRemainingCents <= 0) return;
      const cents = Math.max(0, Math.round(paymentRemainingCents * ratio));
      setPaymentForm((prev) => ({ ...prev, amount: formatCentsToEuroInput(String(cents)) }));
    },
    [paymentRemainingCents]
  );

  // ─── Loaders ────────────────────────────────────────────────────────────────

  const loadPayments = useCallback(
    async (invoiceId: string) => {
      if (!invoiceId) return;
      setPaymentLoading(true);
      setPaymentError(null);
      try {
        const res = await fetchJson<{ items: PaymentItem[] }>(
          `/api/pro/businesses/${businessId}/invoices/${invoiceId}/payments`,
          { cache: 'no-store' }
        );
        if (!res.ok || !res.data) {
          setPaymentError(res.error ?? 'Paiements indisponibles.');
          setPaymentItems([]);
          return;
        }
        setPaymentItems(res.data.items ?? []);
      } catch (err) {
        setPaymentError(getErrorMessage(err));
        setPaymentItems([]);
      } finally {
        setPaymentLoading(false);
      }
    },
    [businessId]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const openPaymentModal = useCallback(
    async (invoice: InvoiceItem, presetAmountCents?: number) => {
      if (!isAdmin) {
        onBillingError('Réservé aux admins/owners.');
        return;
      }
      setPaymentError(null);
      setPaymentNotice(null);
      setPaymentItems([]);
      setPaymentModal({ invoice });
      setPaymentForm({
        amount: presetAmountCents != null ? formatCentsToEuroInput(String(presetAmountCents)) : '',
        paidAt: new Date().toISOString().slice(0, 10),
        method: 'WIRE',
        reference: '',
        note: '',
      });
      await loadPayments(invoice.id);
    },
    [isAdmin, loadPayments, onBillingError]
  );

  const closePaymentModal = useCallback(() => {
    setPaymentModal(null);
    setPaymentItems([]);
    setPaymentError(null);
    setPaymentNotice(null);
    setPaymentLoading(false);
    setPaymentSaving(false);
    setPaymentDeletingId(null);
  }, []);

  const handleSavePayment = useCallback(async () => {
    if (!paymentModal) return;
    if (!isAdmin) {
      setPaymentError('Réservé aux admins/owners.');
      return;
    }
    const amountCents = parseEuroInputCents(paymentForm.amount);
    if (!amountCents || amountCents <= 0) {
      setPaymentError('Montant invalide.');
      return;
    }
    setPaymentSaving(true);
    setPaymentError(null);
    setPaymentNotice(null);
    onBillingInfo(null);
    const invoice = paymentModal.invoice;
    const remainingBefore = getInvoiceRemainingCents(invoice);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/invoices/${invoice.id}/payments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            paidAt: paymentForm.paidAt || new Date().toISOString(),
            method: paymentForm.method,
            reference: paymentForm.reference || null,
            note: paymentForm.note || null,
          }),
        }
      );
      if (!res.ok) {
        setPaymentError(res.error ?? "Impossible d'ajouter le paiement.");
        return;
      }
      const message = amountCents >= remainingBefore ? 'Facture soldée' : 'Paiement ajouté';
      onBillingInfo(message);
      setPaymentNotice(message);
      setPaymentForm((prev) => ({ ...prev, amount: '', reference: '', note: '' }));
      await Promise.all([loadInvoices(), loadPayments(invoice.id)]);
    } catch (err) {
      setPaymentError(getErrorMessage(err));
    } finally {
      setPaymentSaving(false);
    }
  }, [paymentModal, isAdmin, paymentForm, businessId, loadInvoices, loadPayments, onBillingInfo]);

  const handleDeletePayment = useCallback(
    async (paymentId: string) => {
      if (!paymentModal) return;
      if (!isAdmin) {
        setPaymentError('Réservé aux admins/owners.');
        return;
      }
      if (!window.confirm('Supprimer ce paiement ?')) return;
      setPaymentDeletingId(paymentId);
      setPaymentError(null);
      setPaymentNotice(null);
      try {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/invoices/${paymentModal.invoice.id}/payments/${paymentId}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          setPaymentError(res.error ?? 'Suppression du paiement impossible.');
          return;
        }
        onBillingInfo('Paiement supprimé');
        setPaymentNotice('Paiement supprimé');
        await Promise.all([loadInvoices(), loadPayments(paymentModal.invoice.id)]);
      } catch (err) {
        setPaymentError(getErrorMessage(err));
      } finally {
        setPaymentDeletingId(null);
      }
    },
    [paymentModal, isAdmin, businessId, loadInvoices, loadPayments, onBillingInfo]
  );

  return {
    // State
    paymentModal,
    paymentItems,
    paymentLoading,
    paymentError,
    paymentNotice,
    paymentSaving,
    paymentDeletingId,
    paymentForm,
    setPaymentForm,
    // Derived
    activePaymentInvoice,
    paymentTotalCents,
    paymentPaidCents,
    paymentRemainingCents,
    applyPaymentShortcut,
    // Actions
    openPaymentModal,
    closePaymentModal,
    handleSavePayment,
    handleDeletePayment,
  };
}
