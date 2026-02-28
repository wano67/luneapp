'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import type { ProjectListItem } from '@/lib/hooks/useProjects';
import { isProjectActive, isProjectInactive, isProjectPlanned } from '@/lib/projectStatus';
import {
  getProjectScopeLabelFR,
  getProjectScopeVariant,
  getProjectStatusLabelFR,
  isProjectOverdue,
  shouldWarnProjectCompletion,
} from '@/lib/projectStatusUi';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type Props = {
  businessId: string;
  project: ProjectListItem;
  onMutate?: () => void | Promise<void>;
};

function projectStatusToCardStatus(project: ProjectListItem): 'active' | 'inactive' | 'neutral' {
  if (isProjectInactive(project.status, project.archivedAt)) return 'inactive';
  if (isProjectActive(project.status, project.archivedAt)) return 'active';
  if (isProjectPlanned(project.status, project.archivedAt)) return 'neutral';
  return 'neutral';
}

const STATUS_BORDER: Record<'active' | 'inactive' | 'neutral', string> = {
  active: 'border border-[var(--success-border)]',
  inactive: 'border border-[var(--danger-border)]',
  neutral: 'border border-[var(--border)]/60',
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="h-2 w-full rounded-full bg-[var(--surface-2)]">
      <div className="h-2 rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProjectCard({ businessId, project, onMutate }: Props) {
  const status = projectStatusToCardStatus(project);
  const progress = project.progress ?? project.tasksSummary?.progressPct ?? 0;
  const amountRaw = project.amountCents;
  const hasAmount = amountRaw !== undefined && amountRaw !== null;
  const amountCents =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? Number(amountRaw)
        : null;
  const value =
    hasAmount && typeof amountCents === 'number' && Number.isFinite(amountCents)
      ? formatCurrencyEUR(amountCents, { minimumFractionDigits: 0 })
      : '—';
  const progressPct = Math.min(100, Math.max(0, Number.isFinite(progress) ? Number(progress) : 0));
  const statusLabel = getProjectStatusLabelFR(project.status);
  const scopeLabel = getProjectScopeLabelFR(project.status, project.archivedAt);
  const scopeVariant = getProjectScopeVariant(project.status, project.archivedAt);
  const isOverdue = isProjectOverdue(project.endDate, project.status, project.archivedAt);
  const showScopeBadge = scopeLabel.toLowerCase() !== statusLabel.toLowerCase();

  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;

  const [menuOpen, setMenuOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleArchiveToggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (actionLoading) return;
    if (!isAdmin) {
      setActionError('Réservé aux admins/owners.');
      return;
    }
    const archiving = !project.archivedAt;
    const confirmMessage = archiving
      ? 'Archiver ce projet ? Il sera considéré comme inactif.'
      : 'Désarchiver ce projet ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    setActionLoading(true);
    setActionError(null);
    try {
      const endpoint = archiving ? 'archive' : 'unarchive';
      const res = await fetchJson<{ id: string; archivedAt: string | null }>(
        `/api/pro/businesses/${businessId}/projects/${project.id}/${endpoint}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const msg = res.error ?? 'Action impossible.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setMenuOpen(false);
      await onMutate?.();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkCompleted(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (actionLoading) return;
    if (!isAdmin) {
      setActionError('Réservé aux admins/owners.');
      return;
    }
    const warning = shouldWarnProjectCompletion(project.quoteStatus, project.depositStatus);
    const confirmMessage = warning
      ? 'Devis non signé ou acompte non validé. Marquer terminé quand même ?'
      : 'Marquer ce projet comme terminé ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    const payload: Record<string, unknown> = { status: 'COMPLETED' };

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchJson<{ item?: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${project.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const msg = res.error ?? 'Impossible de mettre à jour le projet.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setMenuOpen(false);
      await onMutate?.();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen((prev) => !prev);
    setActionError(null);
  }

  return (
    <Link
      href={`/app/pro/${businessId}/projects/${project.id}`}
      className={cn(
        'group card-interactive relative block min-h-[220px] rounded-3xl bg-[var(--surface)] p-4 pb-14 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        STATUS_BORDER[status]
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">Projet</p>
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                aria-label="Actions"
                className="rounded-full p-1 text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                onClick={toggleMenu}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-sm shadow-lg">
                  <Link
                    href={`/app/pro/${businessId}/projects/${project.id}/edit`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuOpen(false);
                    }}
                  >
                    Paramètres
                  </Link>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-hover)]',
                      !isAdmin ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-60' : 'text-[var(--text-primary)]'
                    )}
                    disabled={!isAdmin || actionLoading}
                    onClick={handleMarkCompleted}
                  >
                    Marquer terminé
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-hover)]',
                      !isAdmin ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-60' : 'text-[var(--danger)]'
                    )}
                    disabled={!isAdmin || actionLoading}
                    onClick={handleArchiveToggle}
                  >
                    {project.archivedAt ? 'Désarchiver' : 'Archiver'}
                  </button>
                  {actionError ? (
                    <p className="px-3 py-2 text-xs text-[var(--danger)]">{actionError}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <p className="line-clamp-2 text-base font-semibold leading-tight text-[var(--text-primary)]">
            {project.name || 'Sans nom'}
          </p>
          <p className="truncate text-[13px] text-[var(--text-secondary)]">
            {project.clientName ?? 'Sans client'}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant="neutral">{statusLabel}</Badge>
            {showScopeBadge ? <Badge variant={scopeVariant}>{scopeLabel}</Badge> : null}
            {isOverdue ? <Badge variant="performance">En retard</Badge> : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 text-[13px] text-[var(--text-secondary)]">
          <div className="flex items-center justify-between">
            <span>Valeur</span>
            <span className="text-[var(--text-primary)] font-medium">{value}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Avancement</span>
            <span className="text-[var(--text-primary)] font-medium">{progressPct.toFixed(0)}%</span>
          </div>
          <ProgressBar value={progressPct} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5">
        <ArrowRight
          strokeWidth={2.75}
          className="text-[var(--text-secondary)] transition group-hover:translate-x-1 group-hover:text-[var(--text-primary)]"
        />
      </div>
    </Link>
  );
}
