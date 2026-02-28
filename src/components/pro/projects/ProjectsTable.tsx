import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ProjectListItem } from '@/lib/hooks/useProjects';
import { getProjectScopeLabelFR, getProjectScopeVariant, getProjectStatusLabelFR } from '@/lib/projectStatusUi';

type Props = {
  businessId: string;
  items: ProjectListItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

function StatusBadge({ status, archivedAt }: { status: string; archivedAt?: string | null }) {
  const statusLabel = getProjectStatusLabelFR(status);
  const scopeLabel = getProjectScopeLabelFR(status, archivedAt ?? null);
  const scopeVariant = getProjectScopeVariant(status, archivedAt ?? null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">{statusLabel}</Badge>
      <Badge variant={scopeVariant}>{scopeLabel}</Badge>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  return (
    <div className="w-full rounded-full bg-[var(--surface-hover)]">
      <div
        className="h-2 rounded-full bg-[var(--accent)] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProjectsTable({ businessId, items, isLoading, error, onRetry }: Props) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <Table wrapperClassName="overflow-auto">
      <TableHeader>
        <TableRow>
          <TableHead>Projet</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Progression</TableHead>
          <TableHead>Dernière activité</TableHead>
          <TableHead className="w-[72px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableEmpty>
            Chargement…
          </TableEmpty>
        ) : error ? (
          <TableEmpty>
            <div className="flex flex-col items-center gap-2">
              <p>{error}</p>
              <Button onClick={onRetry} variant="outline" size="sm">
                Réessayer
              </Button>
            </div>
          </TableEmpty>
        ) : !items.length ? (
          <TableEmpty>Aucun projet</TableEmpty>
        ) : (
          items.map((project) => (
            <TableRow
              key={project.id}
              className="cursor-pointer"
              onClick={() => router.push(`/app/pro/${businessId}/projects/${project.id}`)}
            >
              <TableCell className="font-semibold">
                <div className="flex flex-col">
                  <span className="text-[var(--text)]">{project.name}</span>
                  {project.tagReferences?.length ? (
                    <span className="text-xs text-[var(--text-secondary)]">
                      {project.tagReferences.map((t) => t.name).join(' · ')}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-[var(--text-secondary)]">
                {project.clientName ?? '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={project.status} archivedAt={project.archivedAt} />
              </TableCell>
              <TableCell className="min-w-[160px]">
                <div className="flex items-center gap-2">
                  <ProgressBar value={project.progress ?? project.tasksSummary?.progressPct ?? 0} />
                  <span className="text-xs text-[var(--text-secondary)]">
                    {(project.progress ?? project.tasksSummary?.progressPct ?? 0).toFixed(0)}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-[var(--text-secondary)]">
                {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('fr-FR') : '—'}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="relative inline-block">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-haspopup="menu"
                    onClick={() => setOpenMenuId((prev) => (prev === project.id ? null : project.id))}
                  >
                    …
                  </Button>
                  {openMenuId === project.id ? (
                    <div className="absolute right-0 z-10 mt-2 w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-hover)]"
                        onClick={() => {
                          setOpenMenuId(null);
                          router.push(`/app/pro/${businessId}/projects/${project.id}`);
                        }}
                      >
                        Ouvrir
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--warning)] hover:bg-[var(--surface-hover)]"
                      >
                        Archiver (TODO)
                      </button>
                    </div>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
