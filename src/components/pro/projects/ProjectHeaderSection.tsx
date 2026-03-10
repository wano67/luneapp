import Link from 'next/link';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  businessId: string;
  projectId: string;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  archivedAt: string | null;
  statusLabel: string;
  scopeLabel: string;
  scopeVariant: 'neutral' | 'pro' | 'personal' | 'performance';
  showScopeBadge: boolean;
  isOverdue: boolean;
  isAdmin: boolean;
  markingCompleted: boolean;
  actionError: string | null;
  latestPdf: { url: string; label: string } | null;
  onMarkCompleted: () => void;
  onPostpone: () => void;
  onBillingClick?: () => void;
  onShareClick?: () => void;
};

export function ProjectHeaderSection({
  businessId,
  projectId,
  projectName,
  clientId,
  clientName,
  archivedAt,
  statusLabel,
  scopeLabel,
  scopeVariant,
  showScopeBadge,
  isOverdue,
  isAdmin,
  markingCompleted,
  actionError,
  latestPdf,
  onMarkCompleted,
  onPostpone,
  onBillingClick,
  onShareClick,
}: Props) {
  return (
    <>
      <div className="space-y-3">
        {/* Back button */}
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/pro/${businessId}/projects`}>
            <ChevronLeft size={16} />
            <span style={{ fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, fontSize: 18 }}>
              Retour
            </span>
          </Link>
        </Button>

        {/* Title + badges */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1
            className="min-w-0 break-words"
            style={{
              fontSize: 'clamp(24px, 5vw, 40px)',
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--text)',
            }}
          >
            {projectName ?? `Projet #${projectId}`}
          </h1>
          <span
            className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium"
            style={{ background: 'var(--surface-2)', color: 'var(--shell-accent-dark)' }}
          >
            {statusLabel}
          </span>
          {showScopeBadge && <Badge variant={scopeVariant}>{scopeLabel}</Badge>}
          {archivedAt && <Badge variant="performance">Archivé</Badge>}
          {clientId && clientName && (
            <Link
              href={`/app/pro/${businessId}/clients/${clientId}`}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition hover:opacity-80 shrink-0"
              style={{ background: 'var(--shell-accent)', color: 'white' }}
            >
              {clientName}
              <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className="!rounded-xl !border-0"
            style={{ background: 'var(--shell-accent-dark)', color: 'white' }}
          >
            <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>
              Modifier
            </Link>
          </Button>
          <button
            type="button"
            onClick={onBillingClick}
            className="rounded-full px-3 py-2 text-sm font-medium transition hover:opacity-80"
            style={{ background: 'white', color: 'rgba(0,0,0,0.6)' }}
          >
            Facturation
          </button>
          {isAdmin && onShareClick && (
            <button
              type="button"
              onClick={onShareClick}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ background: 'white', color: 'rgba(0,0,0,0.6)' }}
            >
              <Share2 size={14} />
              Partager
            </button>
          )}
          {latestPdf && (
            <a
              href={latestPdf.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-2 text-sm font-medium transition hover:opacity-80"
              style={{ background: 'white', color: 'rgba(0,0,0,0.6)' }}
            >
              Dernier pdf
            </a>
          )}
        </div>
      </div>

      {isOverdue && (
        <div
          className="flex flex-col gap-3 rounded-xl p-4"
          style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Date de fin dépassée</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Terminer le projet ou repousser la fin.
              </p>
            </div>
            <Badge variant="performance">En retard</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onMarkCompleted}
              disabled={!isAdmin || markingCompleted}
            >
              {markingCompleted ? 'Traitement\u2026' : 'Marquer terminé'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPostpone}
              disabled={!isAdmin || markingCompleted}
            >
              Repousser
            </Button>
          </div>
          {!isAdmin && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Réservé aux admins/owners.</p>
          )}
          {actionError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{actionError}</p>}
        </div>
      )}
    </>
  );
}
