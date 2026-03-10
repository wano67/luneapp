'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import type { ProjectListItem } from '@/lib/hooks/useProjects';
import {
  getProjectStatusLabelFR,
  isProjectOverdue,
  shouldWarnProjectCompletion,
} from '@/lib/projectStatusUi';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type Props = {
  businessId: string;
  project: ProjectListItem;
  onMutate?: () => void | Promise<void>;
  index?: number;
};

export function ProjectCard({ businessId, project, onMutate, index = 0 }: Props) {
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
  const isOverdue = isProjectOverdue(project.endDate, project.status, project.archivedAt);

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

    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetchJson<{ item?: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${project.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
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
      className="group relative flex flex-col rounded-xl p-3 transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up"
      style={{
        background: 'var(--shell-accent)',
        height: 200,
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Top row: name + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate underline">{project.name || 'Sans nom'}</p>
          <p className="text-xs text-white/70 truncate mt-0.5">{project.clientName ?? 'Sans client'}</p>
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Actions"
            className="flex items-center justify-center rounded-xl transition hover:opacity-80"
            style={{ width: 28, height: 28, background: 'white' }}
            onClick={toggleMenu}
          >
            <MoreVertical size={14} style={{ color: 'var(--shell-accent)' }} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-sm shadow-lg">
              <Link
                href={`/app/pro/${businessId}/projects/${project.id}/edit`}
                className="flex items-center rounded-lg px-3 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              >
                Paramètres
              </Link>
              <button
                type="button"
                className={cn(
                  'flex w-full items-center rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-hover)]',
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
                  'flex w-full items-center rounded-lg px-3 py-2 text-left hover:bg-[var(--surface-hover)]',
                  !isAdmin ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-60' : 'text-[var(--danger)]'
                )}
                disabled={!isAdmin || actionLoading}
                onClick={handleArchiveToggle}
              >
                {project.archivedAt ? 'Désarchiver' : 'Archiver'}
              </button>
              {actionError && (
                <p className="px-3 py-2 text-xs text-[var(--danger)]">{actionError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Badge row */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ background: 'white', color: '#1a1a1a' }}
        >
          {statusLabel}
        </span>
        {isOverdue && (
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(255,255,255,0.3)', color: 'white' }}
          >
            En retard
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stats + progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/70">Valeur</span>
          <span className="text-white font-semibold">{value}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/70">Avancement</span>
          <span className="text-white font-semibold">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <div
            className="h-1.5 rounded-full bg-white transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Ouvrir button */}
      <div className="mt-2 flex justify-end">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="!bg-white !text-black !border-0 pointer-events-none"
        >
          <span>
            <span style={{ fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, fontSize: 13 }}>
              Ouvrir
            </span>
            <ChevronRight size={12} />
          </span>
        </Button>
      </div>
    </Link>
  );
}
