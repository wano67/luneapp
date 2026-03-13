// src/app/app/pro/[businessId]/finances/invoices/[invoiceId]/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle, AlertTriangle, XCircle, FileText, Download, Pencil, Plus, Trash2, Save, X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { getInvoiceStatusLabelFR, getPaymentStatusLabelFR } from '@/lib/billingStatus';
import { useActiveBusiness } from '../../../../ActiveBusinessProvider';
import { revalidate } from '@/lib/revalidate';

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

type InvoiceComplianceIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  label: string;
  detail: string;
};

type InvoiceComplianceReport = {
  checkedAt: string;
  isCompliant: boolean;
  required: { total: number; completed: number };
  recommended: { total: number; completed: number };
  issues: InvoiceComplianceIssue[];
};

type InvoiceDetail = {
  id: string;
  businessId: string;
  projectId: string;
  clientId: string | null;
  quoteId: string | null;
  number: string | null;
  note: string | null;
  status: InvoiceStatus;
  paymentStatus?: string | null;
  paidCents?: string | null;
  remainingCents?: string | null;
  lastPaidAt?: string | null;
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
  consumptionLedgerEntryId?: string | null;
  cashSaleLedgerEntryId?: string | null;
  compliance?: InvoiceComplianceReport;
  items: InvoiceItem[];
};

type InvoiceResponse = { item: InvoiceDetail };

type EditableLineItem = {
  id?: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
};

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function fmtCents(value: string | number | null | undefined, currency = 'EUR') {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(num / 100);
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const invoiceId = (params?.invoiceId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Editing states
  const [editingDates, setEditingDates] = useState(false);
  const [editIssuedAt, setEditIssuedAt] = useState('');
  const [editDueAt, setEditDueAt] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [editItems, setEditItems] = useState<EditableLineItem[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
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
      setInvoice(res.data.item);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
      setInvoice(null);
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }, [businessId, invoiceId]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  async function patchInvoice(body: Record<string, unknown>) {
    if (!isAdmin || !invoice) return false;
    setUpdating(true);
    setActionError(null);
    setInfo(null);

    const res = await fetchJson<InvoiceResponse>(`/api/pro/businesses/${businessId}/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setRequestId(res.requestId);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setUpdating(false);
      return false;
    }
    setInvoice(res.data.item);
    setUpdating(false);
    revalidate('pro:billing');
    return true;
  }

  async function updateStatus(nextStatus: InvoiceStatus) {
    if (!isAdmin) { setActionError('Action réservée aux admins/owners.'); return; }
    const ok = await patchInvoice({ status: nextStatus });
    if (ok) {
      setInfo(`Statut mis à jour (${getInvoiceStatusLabelFR(nextStatus)}).`);
      router.refresh();
    }
  }

  async function markPaid() {
    if (!isAdmin || !invoice) return;
    setUpdating(true);
    setActionError(null);
    setInfo(null);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/invoices/${invoice.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paidAt: new Date().toISOString() }),
    });
    setRequestId(res.requestId);
    if (!res.ok) {
      const msg = res.error ?? 'Paiement impossible.';
      setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setUpdating(false);
      return;
    }
    await load();
    setInfo('Facture soldée.');
    setUpdating(false);
    revalidate('pro:billing');
    router.refresh();
  }

  async function saveDates() {
    const body: Record<string, unknown> = {};
    if (editIssuedAt) body.issuedAt = new Date(editIssuedAt).toISOString();
    if (editDueAt) body.dueAt = new Date(editDueAt).toISOString();
    const ok = await patchInvoice(body);
    if (ok) { setEditingDates(false); setInfo('Dates mises à jour.'); }
  }

  async function saveNote() {
    const ok = await patchInvoice({ note: editNote.trim() || null });
    if (ok) { setEditingNote(false); setInfo('Note mise à jour.'); }
  }

  async function saveLineItems() {
    const lineItems = editItems.map((it) => ({
      label: it.label,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
    }));
    const ok = await patchInvoice({ lineItems });
    if (ok) { setEditingItems(false); setInfo('Lignes mises à jour.'); }
  }

  function startEditDates() {
    if (!invoice) return;
    setEditIssuedAt(toInputDate(invoice.issuedAt ?? invoice.createdAt));
    setEditDueAt(toInputDate(invoice.dueAt));
    setEditingDates(true);
  }

  function startEditNote() {
    setEditNote(invoice?.note ?? '');
    setEditingNote(true);
  }

  function startEditItems() {
    if (!invoice) return;
    setEditItems(invoice.items.map((it) => ({
      id: it.id,
      label: it.label,
      quantity: it.quantity,
      unitPriceCents: Number(it.unitPriceCents),
    })));
    setEditingItems(true);
  }

  function addLineItem() {
    setEditItems((prev) => [...prev, { label: '', quantity: 1, unitPriceCents: 0 }]);
  }

  function removeLineItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(index: number, field: keyof EditableLineItem, value: string | number) {
    setEditItems((prev) => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }

  const canEdit = invoice && (invoice.status === 'DRAFT' || invoice.status === 'SENT');
  const pdfUrl = `/api/pro/businesses/${businessId}/invoices/${invoiceId}/pdf`;
  const compliance = invoice?.compliance;

  return (
    <PageContainer>
      <div className="space-y-5">
        <PageHeader
          title={invoice?.number ?? `Facture #${invoiceId}`}
          subtitle="Détail, conformité et modification de la facture."
          backHref={`/app/pro/${businessId}/finances`}
          backLabel="Finances"
        />

        {loading ? (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-secondary)]">Chargement de la facture…</p>
          </Card>
        ) : error ? (
          <Card className="space-y-2 border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
            <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
            <p className="text-xs text-[var(--danger)]">Vérifie l&apos;identifiant ou tes droits.</p>
          </Card>
        ) : invoice ? (
          <div className="space-y-4">
            {/* ═══ Compliance Banner ═══ */}
            {compliance && (
              <div
                className="flex items-start gap-3 rounded-xl border p-4"
                style={{
                  borderColor: compliance.isCompliant ? 'var(--success-border, var(--success))' : 'var(--danger-border, var(--danger))',
                  background: compliance.isCompliant ? 'var(--success-bg)' : 'var(--danger-bg)',
                }}
              >
                {compliance.isCompliant ? (
                  <CheckCircle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                ) : (
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: compliance.isCompliant ? 'var(--success)' : 'var(--danger)' }}>
                    {compliance.isCompliant ? 'Facture conforme' : 'Facture non conforme'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: compliance.isCompliant ? 'var(--success)' : 'var(--danger)', opacity: 0.85 }}>
                    {compliance.required.completed}/{compliance.required.total} mentions obligatoires
                    {' · '}
                    {compliance.recommended.completed}/{compliance.recommended.total} recommandées
                  </p>
                  {compliance.issues.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {compliance.issues.map((issue) => (
                        <div key={issue.code} className="flex items-start gap-2">
                          {issue.severity === 'error' ? (
                            <XCircle size={14} className="shrink-0 mt-0.5 text-[var(--danger)]" />
                          ) : issue.severity === 'warning' ? (
                            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-[var(--warning)]" />
                          ) : (
                            <CheckCircle size={14} className="shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                          )}
                          <div>
                            <p className="text-xs font-medium text-[var(--text-primary)]">{issue.label}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">{issue.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!compliance.isCompliant && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/app/pro/${businessId}/settings?section=facturation`}>Compléter les paramètres</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ Status & Summary ═══ */}
            <Card className="space-y-4 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={invoice.status === 'PAID' ? 'pro' : invoice.status === 'CANCELLED' ? 'danger' : 'neutral'}>
                    {getInvoiceStatusLabelFR(invoice.status)}
                  </Badge>
                  <Badge variant="neutral">
                    {getPaymentStatusLabelFR(invoice.paymentStatus ?? null)}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{fmtCents(invoice.totalCents, invoice.currency)}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Payé {fmtCents(invoice.paidCents ?? '0', invoice.currency)} · Reste {fmtCents(invoice.remainingCents ?? invoice.totalCents, invoice.currency)}
                  </p>
                </div>
              </div>

              {/* Dates */}
              {!editingDates ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Émission</p>
                    <p className="text-sm text-[var(--text-primary)]">{fmtDate(invoice.issuedAt ?? invoice.createdAt)}</p>
                  </div>
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Échéance</p>
                    <p className="text-sm text-[var(--text-primary)]">{fmtDate(invoice.dueAt)}</p>
                  </div>
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">Payée le</p>
                    <p className="text-sm text-[var(--text-primary)]">{fmtDateTime(invoice.paidAt)}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Modifier les dates</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input label="Date d'émission" type="date" value={editIssuedAt} onChange={(e) => setEditIssuedAt(e.target.value)} />
                    <Input label="Date d'échéance" type="date" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditingDates(false)} disabled={updating}>
                      <X size={14} className="mr-1" /> Annuler
                    </Button>
                    <Button size="sm" onClick={saveDates} disabled={updating}>
                      <Save size={14} className="mr-1" /> {updating ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={pdfUrl} target="_blank" rel="noreferrer">
                    <Download size={14} className="mr-1" /> PDF
                  </a>
                </Button>
                {isAdmin && canEdit && !editingDates && (
                  <Button variant="outline" size="sm" onClick={startEditDates}>
                    <Pencil size={14} className="mr-1" /> Dates
                  </Button>
                )}
                {isAdmin && invoice.status === 'DRAFT' && (
                  <Button size="sm" onClick={() => updateStatus('SENT')} disabled={updating}>
                    {updating ? 'Mise à jour…' : 'Marquer envoyée'}
                  </Button>
                )}
                {isAdmin && invoice.status === 'SENT' && (
                  <Button size="sm" onClick={markPaid} disabled={updating || Number(invoice.remainingCents ?? 0) <= 0}>
                    {updating ? 'Mise à jour…' : 'Solder la facture'}
                  </Button>
                )}
                {!isAdmin && <Badge variant="neutral">Lecture seule</Badge>}
              </div>
              {actionError && <p className="text-sm font-semibold text-[var(--danger)]">{actionError}</p>}
              {info && <p className="text-sm text-[var(--success)]">{info}</p>}
            </Card>

            {/* ═══ Note ═══ */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Note</p>
                {isAdmin && canEdit && !editingNote && (
                  <Button variant="outline" size="sm" onClick={startEditNote}>
                    <Pencil size={14} className="mr-1" /> Modifier
                  </Button>
                )}
              </div>
              {editingNote ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                    rows={3}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Note interne ou mentions spéciales…"
                    maxLength={2000}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditingNote(false)} disabled={updating}>
                      <X size={14} className="mr-1" /> Annuler
                    </Button>
                    <Button size="sm" onClick={saveNote} disabled={updating}>
                      <Save size={14} className="mr-1" /> {updating ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {invoice.note || 'Aucune note.'}
                </p>
              )}
            </Card>

            {/* ═══ Line Items ═══ */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[var(--text-secondary)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Lignes de facture</p>
                  <Badge variant="neutral">{invoice.items.length}</Badge>
                </div>
                {isAdmin && canEdit && !editingItems && (
                  <Button variant="outline" size="sm" onClick={startEditItems}>
                    <Pencil size={14} className="mr-1" /> Modifier
                  </Button>
                )}
              </div>

              {editingItems ? (
                <div className="space-y-3">
                  {editItems.map((item, index) => (
                    <div key={index} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 md:flex-row md:items-end md:gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Désignation</label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                          value={item.label}
                          onChange={(e) => updateLineItem(index, 'label', e.target.value)}
                          placeholder="Nom du service…"
                        />
                      </div>
                      <div className="w-20">
                        <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Qté</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Prix unitaire (EUR)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded-md border border-[var(--border)] bg-transparent px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                          value={(item.unitPriceCents / 100).toFixed(2)}
                          onChange={(e) => updateLineItem(index, 'unitPriceCents', Math.round(parseFloat(e.target.value || '0') * 100))}
                        />
                      </div>
                      <div className="w-24 text-right">
                        <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Total</label>
                        <p className="py-1.5 text-sm font-medium text-[var(--text-primary)]">
                          {fmtCents(item.quantity * item.unitPriceCents, invoice.currency)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => removeLineItem(index)} className="shrink-0 !text-[var(--danger)]">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addLineItem}>
                    <Plus size={14} className="mr-1" /> Ajouter une ligne
                  </Button>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditingItems(false)} disabled={updating}>
                      <X size={14} className="mr-1" /> Annuler
                    </Button>
                    <Button size="sm" onClick={saveLineItems} disabled={updating || editItems.some((it) => !it.label.trim())}>
                      <Save size={14} className="mr-1" /> {updating ? 'Enregistrement…' : 'Enregistrer les lignes'}
                    </Button>
                  </div>
                </div>
              ) : invoice.items.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Aucune ligne.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="min-w-full divide-y divide-[var(--border)]">
                    <thead className="bg-[var(--surface)]">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                        <th className="px-4 py-3">Désignation</th>
                        <th className="px-4 py-3">Qté</th>
                        <th className="px-4 py-3">Prix unitaire</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="text-sm text-[var(--text-primary)]">
                          <td className="px-4 py-3 font-medium">{item.label}</td>
                          <td className="px-4 py-3">{item.quantity}</td>
                          <td className="px-4 py-3">{fmtCents(item.unitPriceCents, invoice.currency)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtCents(item.totalCents, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[var(--surface)]">
                      <tr className="text-sm font-semibold text-[var(--text-primary)]">
                        <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                        <td className="px-4 py-3 text-right">{fmtCents(invoice.totalCents, invoice.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            {/* ═══ Technical Info ═══ */}
            <Card className="p-4">
              <details>
                <summary className="cursor-pointer text-xs font-medium text-[var(--text-secondary)]">Informations techniques</summary>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                  <span>ID: {invoice.id}</span>
                  <span>Projet: {invoice.projectId}</span>
                  <span>Client: {invoice.clientId ?? '—'}</span>
                  <span>Devis: {invoice.quoteId ?? '—'}</span>
                  <span>Acompte: {invoice.depositPercent}% ({fmtCents(invoice.depositCents, invoice.currency)})</span>
                  <span>Solde: {fmtCents(invoice.balanceCents, invoice.currency)}</span>
                  <span>Stock: {invoice.reservationStatus ?? '—'}</span>
                  {invoice.consumptionLedgerEntryId && (
                    <Link href={`/api/pro/businesses/${businessId}/ledger/${invoice.consumptionLedgerEntryId}`} className="underline">
                      Écriture comptable
                    </Link>
                  )}
                  {invoice.cashSaleLedgerEntryId && (
                    <Link href={`/api/pro/businesses/${businessId}/ledger/${invoice.cashSaleLedgerEntryId}`} className="underline">
                      Écriture vente
                    </Link>
                  )}
                  {compliance && (
                    <span>Contrôle: {fmtDateTime(compliance.checkedAt)}</span>
                  )}
                  {requestId && <span>Ref: {requestId}</span>}
                </div>
              </details>
            </Card>
          </div>
        ) : (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-secondary)]">Facture introuvable.</p>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
