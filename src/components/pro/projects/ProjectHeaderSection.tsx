import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatDate,
  SectionCard,
  StatCard,
  MetaItem,
  StickyHeaderActions,
} from '@/components/pro/projects/workspace-ui';

type Props = {
  businessId: string;
  projectId: string;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  archivedAt: string | null;
  statusLabel: string;
  scopeLabel: string;
  scopeVariant: 'neutral' | 'pro' | 'personal' | 'performance';
  showScopeBadge: boolean;
  isOverdue: boolean;
  isAdmin: boolean;
  markingCompleted: boolean;
  actionError: string | null;
  kpis: Array<{ label: string; value: string }>;
  latestPdf: { url: string; label: string } | null;
  onMarkCompleted: () => void;
  onPostpone: () => void;
};

export function ProjectHeaderSection({
  businessId,
  projectId,
  projectName,
  clientId,
  clientName,
  startDate,
  endDate,
  updatedAt,
  archivedAt,
  statusLabel,
  scopeLabel,
  scopeVariant,
  showScopeBadge,
  isOverdue,
  isAdmin,
  markingCompleted,
  actionError,
  kpis,
  latestPdf,
  onMarkCompleted,
  onPostpone,
}: Props) {
  return (
    <>
      <SectionCard>
        <div className="flex flex-col gap-5">
          <StickyHeaderActions>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/app/pro/${businessId}/projects`}>
                <ArrowLeft size={16} />
                Retour
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>Modifier</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=billing`}>Facturation</Link>
              </Button>
              {latestPdf ? (
                <Button asChild size="sm" variant="outline">
                  <a href={latestPdf.url} target="_blank" rel="noreferrer">
                    Dernier PDF
                  </a>
                </Button>
              ) : null}
            </div>
          </StickyHeaderActions>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {projectName ?? `Projet #${projectId}`}
                </h1>
                <Badge variant="neutral">{statusLabel}</Badge>
                {showScopeBadge ? <Badge variant={scopeVariant}>{scopeLabel}</Badge> : null}
                {archivedAt ? <Badge variant="performance">Archivé</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <MetaItem
                  label="Client"
                  value={
                    clientName && clientId ? (
                      <Link
                        href={`/app/pro/${businessId}/clients/${clientId}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {clientName}
                      </Link>
                    ) : (
                      clientName ?? 'Non renseigné'
                    )
                  }
                />
                <MetaItem
                  label="Dates"
                  value={`${formatDate(startDate)} → ${formatDate(endDate)}`}
                />
                <MetaItem label="Dernière mise à jour" value={formatDate(updatedAt)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {kpis.map((item) => (
                <StatCard key={item.label} label={item.label} value={String(item.value)} />
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {isOverdue ? (
        <SectionCard className="border-[var(--danger-border)] bg-[var(--danger-bg)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Date de fin dépassée</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Terminer le projet ou repousser la fin.
              </p>
            </div>
            <Badge variant="performance">En retard</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onMarkCompleted}
              disabled={!isAdmin || markingCompleted}
            >
              {markingCompleted ? 'Traitement…' : 'Marquer terminé'}
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
          {!isAdmin ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>
          ) : null}
          {actionError ? <p className="mt-2 text-xs text-[var(--danger)]">{actionError}</p> : null}
        </SectionCard>
      ) : null}
    </>
  );
}
