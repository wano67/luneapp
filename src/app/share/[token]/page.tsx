'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, Upload, CheckCircle, AlertCircle, X, Eye, KeyRound, Copy, Clock } from 'lucide-react';
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
  id: string;
  number: string | null;
  status: string;
  totalCents: string;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
};

type InvoiceData = {
  id: string;
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

type VaultItemData = {
  id: string;
  title: string;
  identifier: string | null;
  email: string | null;
  password: string;
  note: string | null;
  createdAt: string;
};

type ShareData = {
  allowClientUpload: boolean;
  allowVaultAccess: boolean;
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

type ActiveTab = 'project' | 'billing' | 'documents' | 'vault';

/* ═══ Helpers ═══ */

const STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Planifié',
  ACTIVE: 'En cours',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  SENT: 'Envoyé',
  SIGNED: 'Signé',
  PAID: 'Payée',
  DRAFT: 'Brouillon',
  EXPIRED: 'Expiré',
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const PREVIEWABLE_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

function isPreviewable(mimeType: string): boolean {
  return PREVIEWABLE_MIMES.has(mimeType);
}

/* ═══ Page ═══ */

export default function ShareProjectPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('project');
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  // Password gate
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchData = useCallback(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError((body as { error?: string } | null)?.error ?? 'Lien invalide ou expiré.');
          return;
        }
        const json = await res.json();
        if (json.requiresPassword) {
          setRequiresPassword(true);
          return;
        }
        setRequiresPassword(false);
        setData(json);
      })
      .catch(() => setError('Erreur de connexion.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      const res = await fetch(`/api/share/${token}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      if (res.ok) {
        setRequiresPassword(false);
        setPasswordInput('');
        fetchData();
      } else {
        const body = await res.json().catch(() => null);
        setPasswordError((body as { error?: string } | null)?.error ?? 'Mot de passe incorrect.');
      }
    } catch {
      setPasswordError('Erreur de connexion.');
    } finally {
      setPasswordLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[var(--surface-hover)]" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-40 rounded bg-[var(--surface-hover)]" />
            <div className="h-3 w-24 rounded bg-[var(--surface-hover)]" />
          </div>
        </div>
        <div className="h-8 w-64 rounded bg-[var(--surface-hover)]" />
        <div className="h-3 w-full rounded-full bg-[var(--surface-hover)]" />
        <div className="h-10 w-80 rounded-xl bg-[var(--surface-hover)]" />
        <div className="h-48 rounded-xl bg-[var(--surface-hover)]" />
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in-up">
        <div className="rounded-full p-4" style={{ background: 'var(--surface-hover)' }}>
          <KeyRound size={32} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Accès protégé</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ce lien est protégé par un mot de passe.
          </p>
        </div>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Mot de passe"
            autoFocus
            className="w-full rounded-xl border px-4 py-2.5 text-sm"
            style={{ borderColor: passwordError ? 'var(--danger)' : 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          {passwordError && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={passwordLoading || !passwordInput.trim()}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
          >
            {passwordLoading ? 'Vérification…' : 'Accéder'}
          </button>
        </form>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="rounded-full p-4" style={{ background: 'var(--danger-bg)' }}>
          <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{error ?? 'Lien invalide'}</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ce lien de suivi de projet n&apos;est plus valide.
        </p>
      </div>
    );
  }

  const { business, project, services, quotes, invoices, payments, documents, allowClientUpload, allowVaultAccess } = data;
  const pct = project.progressPct;
  const previewDoc = previewDocId ? documents.find((d) => d.id === previewDocId) ?? null : null;
  const isCompleted = project.status === 'COMPLETED';
  const isOverdue = project.status === 'ACTIVE' && project.endDate && new Date(project.endDate) < new Date();
  const showVaultTab = allowVaultAccess;

  return (
    <div className="flex flex-col gap-0 animate-fade-in-up">
      {/* ═══ Hero Section ═══ */}
      <div
        className="rounded-2xl border p-6 md:p-8"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {/* Business identity */}
        <div className="flex items-center gap-3 mb-6">
          <LogoAvatar name={business.name} websiteUrl={business.websiteUrl} size={44} />
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{business.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Suivi de projet</p>
          </div>
        </div>

        {/* Project name */}
        <h1
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-barlow), sans-serif' }}
        >
          {project.name}
        </h1>

        {/* Status + date range */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: isCompleted ? 'var(--success-bg)' : isOverdue ? 'var(--danger-bg)' : project.status === 'ACTIVE' ? 'var(--shell-accent)' : 'var(--surface-hover)',
              color: isCompleted ? 'var(--success)' : isOverdue ? 'var(--danger)' : project.status === 'ACTIVE' ? 'white' : 'var(--text-secondary)',
            }}
          >
            {isOverdue && <Clock size={12} />}
            {isOverdue ? 'En retard' : STATUS_LABELS[project.status] ?? project.status}
          </span>
          {project.startDate && (
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              {fmtDate(project.startDate)} &rarr; {fmtDate(project.endDate)}
            </span>
          )}
        </div>

        {/* Status message */}
        {isCompleted && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4" style={{ background: 'var(--success-bg)' }}>
            <CheckCircle size={14} style={{ color: 'var(--success)' }} />
            <p className="text-sm" style={{ color: 'var(--success)' }}>
              Projet livré — vous pouvez récupérer vos documents et identifiants.
            </p>
          </div>
        )}
        {isOverdue && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4" style={{ background: 'var(--danger-bg)' }}>
            <Clock size={14} style={{ color: 'var(--danger)' }} />
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              Ce projet a dépassé sa date de fin prévue.
            </p>
          </div>
        )}

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
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-faint)' }}>
            {project.tasksSummary.done}/{project.tasksSummary.total} tâches terminées
          </p>
        </div>
      </div>

      {/* ═══ Tab Navigation ═══ */}
      <div
        className="mt-6 flex items-center gap-1 rounded-xl border p-1"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        {([
          { key: 'project' as const, label: 'Projet' },
          { key: 'billing' as const, label: 'Facturation' },
          { key: 'documents' as const, label: 'Documents' },
          ...(showVaultTab ? [{ key: 'vault' as const, label: 'Trousseau' }] : []),
        ]).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveTab(tab.key); setPreviewDocId(null); }}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200"
            style={{
              background: activeTab === tab.key ? 'var(--surface-hover)' : 'transparent',
              color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab Content ═══ */}
      <div className="mt-6">
        {activeTab === 'project' && (
          <ProjetTab
            project={project}
            services={services}
          />
        )}
        {activeTab === 'billing' && (
          <FacturationTab
            token={token}
            quotes={quotes}
            invoices={invoices}
            payments={payments}
            onRefresh={fetchData}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            token={token}
            documents={documents}
            allowClientUpload={allowClientUpload}
            previewDoc={previewDoc}
            previewDocId={previewDocId}
            onPreview={setPreviewDocId}
            onUploadSuccess={fetchData}
          />
        )}
        {activeTab === 'vault' && showVaultTab && (
          <TrousseauTab token={token} isCompleted={isCompleted} />
        )}
      </div>
    </div>
  );
}

/* ═══ Projet Tab ═══ */

function ProjetTab({ project, services }: { project: ShareData['project']; services: ServiceData[] }) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Scope */}
      {project.prestationsText && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Périmètre du projet</h2>
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
                        {isDone ? '\u2713' : '\u25CB'}
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

      {/* Empty state */}
      {!project.prestationsText && services.length === 0 && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun détail de projet pour l&apos;instant.</p>
        </div>
      )}
    </div>
  );
}

/* ═══ Facturation Tab ═══ */

function FacturationTab({
  token,
  quotes,
  invoices,
  payments,
  onRefresh,
}: {
  token: string;
  quotes: QuoteData[];
  invoices: InvoiceData[];
  payments: PaymentData[];
  onRefresh: () => void;
}) {
  const [signingId, setSigningId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [signFeedback, setSignFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleSignQuote(quoteId: string) {
    setSigningId(quoteId);
    setSignFeedback(null);
    try {
      const res = await fetch(`/api/share/${token}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_quote', quoteId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSignFeedback({ type: 'success', message: 'Devis signé avec succès !' });
        setConfirmingId(null);
        onRefresh();
      } else {
        setSignFeedback({ type: 'error', message: data.error ?? 'Erreur lors de la signature.' });
      }
    } catch {
      setSignFeedback({ type: 'error', message: 'Erreur de connexion.' });
    } finally {
      setSigningId(null);
    }
  }

  const hasContent = quotes.length > 0 || invoices.length > 0;

  if (!hasContent) {
    return (
      <div className="rounded-xl border p-8 text-center animate-fade-in-up" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun document de facturation pour l&apos;instant.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Sign feedback */}
      {signFeedback && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{
            background: signFeedback.type === 'success' ? 'var(--success-bg, #ecfdf5)' : 'var(--error-bg, #fef2f2)',
            color: signFeedback.type === 'success' ? 'var(--success, #059669)' : 'var(--error, #dc2626)',
          }}
        >
          {signFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {signFeedback.message}
          <button onClick={() => setSignFeedback(null)} className="ml-auto" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quotes */}
      {quotes.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Devis</h2>
          <div className="flex flex-col gap-2">
            {quotes.map((q) => {
              const canSign = q.status === 'SENT';
              const isConfirming = confirmingId === q.id;
              const isSigning = signingId === q.id;
              return (
                <div key={q.id}>
                  <div
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{ background: 'var(--surface-hover)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {q.number ?? 'Devis'}
                      </span>
                      {q.issuedAt && (
                        <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(q.issuedAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <BillingBadge status={q.status} />
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtCents(q.totalCents, q.currency)}
                      </span>
                      <a
                        href={`/api/share/${token}/quotes/${q.id}/pdf`}
                        download
                        title="Télécharger le PDF"
                        className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Download size={14} />
                      </a>
                      {canSign && !isConfirming && (
                        <button
                          onClick={() => setConfirmingId(q.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                          style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
                        >
                          Signer
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Confirmation step */}
                  {isConfirming && (
                    <div
                      className="mt-2 rounded-lg border p-4"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    >
                      <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                        Confirmez-vous la signature du devis <strong>{q.number ?? ''}</strong> d&apos;un montant de <strong>{fmtCents(q.totalCents, q.currency)}</strong> ?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSignQuote(q.id)}
                          disabled={isSigning}
                          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                          style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}
                        >
                          {isSigning ? 'Signature...' : 'Je confirme la signature'}
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          disabled={isSigning}
                          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Factures</h2>
          <div className="flex flex-col gap-2">
            {invoices.map((inv, i) => (
              <div
                key={`i-${i}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: 'var(--surface-hover)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {inv.number ?? 'Facture'}
                  </span>
                  {inv.issuedAt && (
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(inv.issuedAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <BillingBadge status={inv.status} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {fmtCents(inv.totalCents, inv.currency)}
                  </span>
                  <a
                    href={`/api/share/${token}/invoices/${inv.id}/pdf`}
                    download
                    title="Télécharger le PDF"
                    className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Download size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments summary */}
      {payments.length > 0 && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Paiements</h2>
          <div className="flex flex-col gap-2">
            {payments.map((p, i) => (
              <div
                key={`p-${i}`}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: 'var(--surface-hover)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtDate(p.paidAt)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{p.method}</span>
                </div>
                <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--success)' }}>
                  {fmtCents(p.amountCents)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Total reçu :{' '}
              <span className="font-semibold" style={{ color: 'var(--success)' }}>
                {fmtCents(payments.reduce((sum, p) => sum + Number(p.amountCents), 0).toString())}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Documents Tab ═══ */

function DocumentsTab({
  token,
  documents,
  allowClientUpload,
  previewDoc,
  previewDocId,
  onPreview,
  onUploadSuccess,
}: {
  token: string;
  documents: DocumentData[];
  allowClientUpload: boolean;
  previewDoc: DocumentData | null;
  previewDocId: string | null;
  onPreview: (id: string | null) => void;
  onUploadSuccess: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      {/* Document list */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Fichiers</h2>

        {documents.length === 0 ? (
          <p className="py-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Aucun document pour l&apos;instant.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {documents.map((doc) => {
              const canPreview = isPreviewable(doc.mimeType);
              const isActive = previewDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  role={canPreview ? 'button' : undefined}
                  tabIndex={canPreview ? 0 : undefined}
                  onClick={() => {
                    if (canPreview) onPreview(isActive ? null : doc.id);
                  }}
                  onKeyDown={(e) => {
                    if (canPreview && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onPreview(isActive ? null : doc.id);
                    }
                  }}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{
                    background: isActive ? 'var(--shell-accent)' : 'var(--surface-hover)',
                    cursor: canPreview ? 'pointer' : 'default',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText
                      size={18}
                      className="shrink-0"
                      style={{ color: isActive ? 'white' : 'var(--text-secondary)' }}
                    />
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: isActive ? 'white' : 'var(--text-primary)' }}
                      >
                        {doc.title || doc.filename}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}
                      >
                        {formatBytes(doc.sizeBytes)} &middot; {fmtDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canPreview && (
                      <span
                        className="rounded-md p-1.5 transition-colors"
                        style={{
                          color: isActive ? 'white' : 'var(--text-secondary)',
                        }}
                        title="Aper\u00e7u"
                      >
                        <Eye size={14} />
                      </span>
                    )}
                    <a
                      href={`/api/share/${token}/documents/${doc.id}/download`}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                      style={{
                        color: isActive ? 'white' : 'var(--text-secondary)',
                      }}
                      title="T\u00e9l\u00e9charger"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline preview */}
      {previewDoc && (
        <div
          className="rounded-xl border overflow-hidden animate-fade-in-up"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {previewDoc.title || previewDoc.filename}
            </p>
            <button
              type="button"
              onClick={() => onPreview(null)}
              className="shrink-0 rounded-md p-1 transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-1" style={{ background: 'var(--surface-hover)' }}>
            {previewDoc.mimeType === 'application/pdf' ? (
              <iframe
                src={`/api/share/${token}/documents/${previewDoc.id}/view`}
                className="h-[70vh] w-full rounded-lg"
                title={previewDoc.title || previewDoc.filename}
                style={{ border: 'none' }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/share/${token}/documents/${previewDoc.id}/view`}
                alt={previewDoc.title || previewDoc.filename}
                className="mx-auto max-h-[70vh] rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* Upload zone */}
      {allowClientUpload && (
        <UploadZone token={token} onSuccess={onUploadSuccess} />
      )}
    </div>
  );
}

/* ═══ Upload Zone ═══ */

function UploadZone({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function handleFile(f: File) {
    setFile(f);
    setFeedback(null);
    if (!title.trim()) {
      setTitle(f.name.replace(/\.[^.]+$/, ''));
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    handleFile(files[0]);
  }

  async function handleSubmit() {
    if (!file || uploading) return;
    setUploading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title.trim()) formData.append('title', title.trim());

      const res = await fetch(`/api/share/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? 'Erreur lors de l\'envoi.');
      }

      setFeedback({ type: 'success', message: 'Document envoy\u00e9 avec succ\u00e8s.' });
      setFile(null);
      setTitle('');
      onSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erreur lors de l\'envoi.' });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Envoyer un document</h2>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer"
        style={{
          borderColor: dragOver ? 'var(--shell-accent)' : 'var(--border)',
          background: dragOver ? 'var(--surface-hover)' : 'transparent',
        }}
      >
        <Upload size={24} style={{ color: 'var(--text-faint)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {file ? file.name : 'Glissez un fichier ici ou cliquez pour s\u00e9lectionner'}
        </p>
        {file && (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {formatBytes(file.size)}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.docx,.xlsx,.zip,.txt"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
      </div>

      {/* Title + submit */}
      {file && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Titre (optionnel)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du document"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors bg-transparent"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--shell-accent)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={uploading}
            className="shrink-0 rounded-lg px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--shell-accent)' }}
          >
            {uploading ? 'Envoi en cours\u2026' : 'Envoyer'}
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{
            background: feedback.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: feedback.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {feedback.message}
        </div>
      )}
    </div>
  );
}

/* ═══ Trousseau Tab ═══ */

function TrousseauTab({ token, isCompleted }: { token: string; isCompleted: boolean }) {
  const [vaultItems, setVaultItems] = useState<VaultItemData[]>([]);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const fetchedRef = useRef<true | null>(null);

  useEffect(() => {
    if (fetchedRef.current == null) {
      fetchedRef.current = true;
    } else {
      return;
    }
    fetch(`/api/share/${token}/vault`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (json.items) setVaultItems(json.items);
      })
      .catch(() => {})
      .finally(() => setVaultLoading(false));
  }, [token]);

  async function handleCopy(password: string, id: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* empty */ }
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!isCompleted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border p-10 text-center animate-fade-in-up" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="rounded-full p-4" style={{ background: 'var(--surface-hover)' }}>
          <KeyRound size={28} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Identifiants disponibles à la livraison</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Vos identifiants et mots de passe seront accessibles une fois le projet terminé.
          </p>
        </div>
      </div>
    );
  }

  if (vaultLoading) {
    return (
      <div className="rounded-xl border p-8 animate-pulse" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="h-4 w-32 rounded bg-[var(--surface-hover)] mb-4" />
        <div className="flex flex-col gap-2">
          <div className="h-16 rounded-lg bg-[var(--surface-hover)]" />
          <div className="h-16 rounded-lg bg-[var(--surface-hover)]" />
        </div>
      </div>
    );
  }

  if (vaultItems.length === 0) {
    return (
      <div className="rounded-xl border p-8 text-center animate-fade-in-up" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aucun identifiant pour ce projet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in-up">
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Identifiants · {vaultItems.length}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          {vaultItems.map((item) => {
            const isRevealed = revealedIds.has(item.id);
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-lg px-4 py-3"
                style={{ background: 'var(--surface-hover)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                    {item.identifier && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Identifiant : <span style={{ color: 'var(--text-primary)' }}>{item.identifier}</span>
                      </p>
                    )}
                    {item.email && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Email : <span style={{ color: 'var(--text-primary)' }}>{item.email}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}>
                        {isRevealed ? item.password : '••••••••'}
                      </p>
                    </div>
                    {item.note && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>{item.note}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleReveal(item.id)}
                      className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                      style={{ color: 'var(--text-secondary)' }}
                      title={isRevealed ? 'Masquer' : 'Révéler'}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.password, item.id)}
                      className="rounded-md p-1.5 transition-colors hover:bg-black/5"
                      style={{ color: isCopied ? 'var(--success)' : 'var(--text-secondary)' }}
                      title={isCopied ? 'Copié !' : 'Copier le mot de passe'}
                    >
                      {isCopied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
        background: isPaid || isSigned ? 'var(--success-bg)' : 'var(--surface)',
        color: isPaid || isSigned ? 'var(--success)' : 'var(--text-secondary)',
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
