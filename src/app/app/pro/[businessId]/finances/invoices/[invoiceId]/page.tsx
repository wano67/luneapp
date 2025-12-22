// src/app/app/pro/[businessId]/finances/invoices/[invoiceId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../../ActiveBusinessProvider';

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';

type InvoiceItem = {
  id: string;
  serviceId: string | null;
  productId: string | null;
  label: string;
  quantity: number;
  unitPriceCents: string;
  totalCents: string;
  createdAt: string;
  updatedAt: string;
};

type InvoiceDetail = {
  id: string;
  businessId: string;
  projectId: string;
  clientId: string | null;
  quoteId: string | null;
  status: InvoiceStatus;
  reservationStatus?: 'ACTIVE' | 'RELEASED' | 'CONSUMED' | null;
  depositPercent: number;
  currency: string;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
};

type InvoiceResponse = { invoice: InvoiceDetail };

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCents(value: string | null | undefined, currency = 'EUR') {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num / 100);
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const invoiceId = (params?.invoiceId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  async function load(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<InvoiceResponse>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Facture introuvable.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setInvoice(null);
        return;
      }
      setInvoice(res.data.invoice);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
      setInvoice(null);
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, invoiceId]);

  async function updateStatus(nextStatus: InvoiceStatus) {
    if (!isAdmin) {
      setActionError(readOnlyMessage);
      return;
    }
    if (!invoice) return;
    setUpdating(true);
    setActionError(null);
    setInfo(null);

    const res = await fetchJson<InvoiceResponse>(`/api/pro/businesses/${businessId}/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    setRequestId(res.requestId);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setUpdating(false);
      return;
    }

    setInvoice(res.data.invoice);
    setInfo(`Statut mis à jour (${STATUS_LABELS[nextStatus]}).`);
    setUpdating(false);
  }

  const requestHint = requestId ? `Ref: ${requestId}` : null;
  const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoiceId}/pdf`;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Facture
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Facture #{invoiceId}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Détail facture : montant, statut, échéance et lignes.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/app/pro/${businessId}/finances`}>Retour finances</Link>
          </Button>
        </div>
        {requestHint ? <p className="text-xs text-[var(--text-secondary)]">{requestHint}</p> : null}
      </Card>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement de la facture…</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 border border-rose-200/60 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-500">{error}</p>
          <p className="text-xs text-rose-400">Vérifie l&apos;identifiant ou tes droits.</p>
        </Card>
      ) : invoice ? (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Statut: {STATUS_LABELS[invoice.status]}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Réservation stock: {invoice.reservationStatus ?? '—'}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  <span>Projet: {invoice.projectId}</span>
                  <span>Client: {invoice.clientId ?? '—'}</span>
                  <span>Devis: {invoice.quoteId ?? '—'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">
                  Total {formatCents(invoice.totalCents, invoice.currency)} · Acompte{' '}
                  {formatCents(invoice.depositCents, invoice.currency)}
                </Badge>
                <Badge variant="neutral">
                  Solde {formatCents(invoice.balanceCents, invoice.currency)} · {invoice.depositPercent}%
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Card className="space-y-1 border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Émission</p>
                <p className="text-sm text-[var(--text-primary)]">{formatDate(invoice.issuedAt ?? invoice.createdAt)}</p>
              </Card>
              <Card className="space-y-1 border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Échéance</p>
                <p className="text-sm text-[var(--text-primary)]">{formatDate(invoice.dueAt)}</p>
              </Card>
              <Card className="space-y-1 border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Payée le</p>
                <p className="text-sm text-[var(--text-primary)]">{formatDateTime(invoice.paidAt)}</p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  Télécharger le PDF
                </a>
              </Button>
              {isAdmin ? (
                <>
                  {invoice.status === 'DRAFT' ? (
                    <Button onClick={() => updateStatus('SENT')} disabled={updating}>
                      {updating ? 'Mise à jour…' : 'Marquer envoyée'}
                    </Button>
                  ) : null}
                  {invoice.status === 'SENT' ? (
                    <Button onClick={() => updateStatus('PAID')} disabled={updating}>
                      {updating ? 'Mise à jour…' : 'Marquer payée'}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Badge variant="neutral">Lecture seule</Badge>
              )}
            </div>
            {actionError ? <p className="text-sm font-semibold text-rose-500">{actionError}</p> : null}
            {info ? <p className="text-sm text-emerald-600">{info}</p> : null}
          </Card>

          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes de facture</p>
              <Badge variant="neutral">{invoice.items.length} ligne(s)</Badge>
            </div>
            {invoice.items.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucune ligne.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <table className="min-w-full divide-y divide-[var(--border)]">
                  <thead className="bg-[var(--surface)]">
                    <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">PU</th>
                      <th className="px-4 py-3">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="text-sm text-[var(--text-primary)]">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-xs text-[var(--text-secondary)]">
                              Service: {item.serviceId ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{item.quantity}</td>
                        <td className="px-4 py-3">{formatCents(item.unitPriceCents, invoice.currency)}</td>
                        <td className="px-4 py-3">{formatCents(item.totalCents, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Facture introuvable.</p>
        </Card>
      )}
    </div>
  );
}
