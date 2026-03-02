import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
  businessId: string;
  projectId: string;
  projectName: string | null;
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
};

export function ProjectHeaderSection({
  businessId,
  projectId,
  projectName,
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
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/pro/${businessId}/projects`}>
              <ChevronLeft size={16} />
              <span style={{ fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, fontSize: 18 }}>
                Retour
              </span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <h1
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: '40px',
                color: 'var(--text)',
              }}
            >
              {projectName ?? `Projet #${projectId}`}
            </h1>
            <span
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: '#5B3B3B' }}
            >
              {statusLabel}
            </span>
            {showScopeBadge && <Badge variant={scopeVariant}>{scopeLabel}</Badge>}
            {archivedAt && <Badge variant="performance">Archivé</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-3">
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
