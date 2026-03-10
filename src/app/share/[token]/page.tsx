'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LogoAvatar } from '@/components/pro/LogoAvatar';

/* ═══ Types ═══ */

type TasksSummary = { total: number; done: number; open?: number; progressPct: number };

type ServiceData = {
  name: string;
  description: string | null;
  steps: { name: string; phaseName: string | null }[];
  tasksSummary: TasksSummary;
};

type QuoteData = {
  number: string | null;
  status: string;
  totalCents: string;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
};

type InvoiceData = {
  number: string | null;
  status: string;
  totalCents: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
};

type PaymentData = {
  amountCents: string;
  paidAt: string;
  method: string;
};

type DocumentData = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
};

type ShareData = {
  business: { name: string; websiteUrl: string | null };
  project: {
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    prestationsText: string | null;
    progressPct: number;
    tasksSummary: TasksSummary;
  };
  services: ServiceData[];
  quotes: QuoteData[];
  invoices: InvoiceData[];
  payments: PaymentData[];
  documents: DocumentData[];
};

/* ═══ Helpers ═══ */

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifi\u00e9',
  ACTIVE: 'En cours',
  ON_HOLD: 'En pause',
  COMPLETED: 'Termin\u00e9',
  CANCELLED: 'Annul\u00e9',
  SENT: 'Envoy\u00e9',
  SIGNED: 'Sign\u00e9',
  PAID: 'Pay\u00e9e',
  DRAFT: 'Brouillon',
  EXPIRED: 'Expir\u00e9',
};

function fmtCents(cents: string | number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(cents) / 100
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '\u2014';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/* ═══ Page ═══ */

export default function ShareProjectPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError((body as { error?: string } | null)?.error ?? 'Lien invalide ou expir\u00e9.');
          return;
        }
        const json = await res.json();
        setData(json);
      })
      .catch(() => setError('Erreur de connexion.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-48 rounded bg-[var(--surface-hover)]" />
        <div className="h-4 w-64 rounded bg-[var(--surface-hover)]" />
        <div className="h-6 w-full rounded-full bg-[var(--surface-hover)]" />
        <div className="h-40 rounded-xl bg-[var(--surface-hover)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="rounded-full p-4" style={{ background: 'var(--danger-bg)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{error ?? 'Lien invalide'}</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ce lien de suivi de projet n&apos;est plus valide.
        </p>
      </div>
    );
  }

  const { business, project, services, quotes, invoices, payments, documents } = data;
  const pct = project.progressPct;

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LogoAvatar name={business.name} websiteUrl={business.websiteUrl} size={40} />
        <div>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{business.name}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Suivi de projet</p>
        </div>
      </div>

      {/* Project title + status */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-barlow), sans-serif' }}>
          {project.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: project.status === 'COMPLETED' ? 'var(--success-bg)' : project.status === 'ACTIVE' ? 'var(--shell-accent)' : 'var(--surface-hover)',
              color: project.status === 'COMPLETED' ? 'var(--success)' : project.status === 'ACTIVE' ? 'white' : 'var(--text-secondary)',
            }}
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
          {project.startDate && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {fmtDate(project.startDate)} \u2192 {fmtDate(project.endDate)}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Avancement global</span>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--shell-accent)' }}
          />
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
          {project.tasksSummary.done}/{project.tasksSummary.total} t\u00e2ches termin\u00e9es
        </p>
      </div>

      {/* Scope */}
      {project.prestationsText && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>P\u00e9rim\u00e8tre du projet</h2>
          <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {project.prestationsText}
          </p>
        </div>
      )}

      {/* Services */}
      {services.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Services</h2>
          <div className="flex flex-col gap-4">
            {services.map((svc, i) => {
              const sp = svc.tasksSummary.progressPct;
              const isDone = sp === 100 && svc.tasksSummary.total > 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: isDone ? 'var(--success)' : 'var(--text-primary)' }}>
                        {isDone ? '\u2713' : '\u25cb'}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{svc.name}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {svc.tasksSummary.total > 0 ? `${sp}%` : '\u2014'}
                    </span>
                  </div>
                  {svc.tasksSummary.total > 0 && (
                    <div className="ml-6 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${sp}%`, background: isDone ? 'var(--success)' : 'var(--shell-accent)' }}
                      />
                    </div>
                  )}
                  {svc.description && (
                    <p className="ml-6 mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>{svc.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Facturation */}
      {(quotes.length > 0 || invoices.length > 0) && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Facturation</h2>
          <div className="flex flex-col gap-2">
            {quotes.map((q, i) => (
              <div key={`q-${i}`} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-hover)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Devis</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{q.number ?? '\u2014'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <BillingBadge status={q.status} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtCents(q.totalCents, q.currency)}</span>
                </div>
              </div>
            ))}
            {invoices.map((inv, i) => (
              <div key={`i-${i}`} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-hover)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Facture</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{inv.number ?? '\u2014'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <BillingBadge status={inv.status} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtCents(inv.totalCents, inv.currency)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Payments summary */}
          {payments.length > 0 && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {payments.length} paiement{payments.length > 1 ? 's' : ''} re\u00e7u{payments.length > 1 ? 's' : ''} \u2014{' '}
                <span className="font-semibold" style={{ color: 'var(--success)' }}>
                  {fmtCents(payments.reduce((sum, p) => sum + Number(p.amountCents), 0).toString())}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Documents</h2>
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-hover)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <DocIcon kind={doc.kind} />
                  <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>{doc.title || doc.filename}</span>
                </div>
                <span className="shrink-0 text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(doc.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Sub-components ═══ */

function BillingBadge({ status }: { status: string }) {
  const isPaid = status === 'PAID';
  const isSigned = status === 'SIGNED';
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: isPaid ? 'var(--success-bg)' : isSigned ? 'var(--success-bg)' : 'var(--surface)',
        color: isPaid ? 'var(--success)' : isSigned ? 'var(--success)' : 'var(--text-secondary)',
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DocIcon({ kind }: { kind: string }) {
  const isInvoice = kind === 'INVOICE';
  const isQuote = kind === 'QUOTE';
  return (
    <span className="shrink-0 text-xs" style={{ color: 'var(--text-faint)' }}>
      {isInvoice ? '\ud83d\udcc4' : isQuote ? '\ud83d\udcdd' : '\ud83d\udcc1'}
    </span>
  );
}
