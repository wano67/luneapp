'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  FolderKanban,
  Download,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton, SkeletonKpiCard } from '@/components/ui/skeleton';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson } from '@/lib/apiClient';
import { DocumentPreviewModal } from '@/components/pro/projects/DocumentPreviewModal';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { useFilterParams } from '@/lib/hooks/useFilterParams';

// ─── Types ──────────────────────────────────────────────────────────
type DocItem = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  taskId: string | null;
  taskTitle: string | null;
  folderId: string | null;
};

type ProjectSummary = { projectId: string; projectName: string; count: number };
type ClientSummary = { clientId: string; clientName: string; count: number };

type DocsPayload = {
  items: DocItem[];
  projectSummaries: ProjectSummary[];
  clientSummaries: ClientSummary[];
  total: number;
};

type GroupFilter = 'all' | 'projects' | 'clients' | 'other';

const GROUP_TABS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'projects', label: 'Projets' },
  { value: 'clients', label: 'Clients' },
  { value: 'other', label: 'Autres' },
];

// ─── Helpers ────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Page ──────────────────────────────────────────────────────────
export default function DocumentsPage() {
  usePageTitle('Documents');
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';

  const [data, setData] = useState<DocsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  // Filters synced to URL for back-button restore
  const FILTER_DEFAULTS = { search: '', group: 'all' } as const;
  const [filters, setFilter] = useFilterParams(FILTER_DEFAULTS);
  const search = filters.search;
  const groupFilter = filters.group as GroupFilter;
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);

  useEffect(() => {
    if (!businessId) return;
    const controller = new AbortController();
    async function load() {
      const res = await fetchJson<DocsPayload>(
        `/api/pro/businesses/${businessId}/documents`,
        {},
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.ok && res.data) setData(res.data);
      setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [businessId]);

  const toggleProject = useCallback((pid: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }, []);

  const toggleClient = useCallback((cid: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
  }, []);

  // Filter items by search
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    let items = data.items;
    if (q) {
      items = items.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.filename.toLowerCase().includes(q) ||
          (d.projectName ?? '').toLowerCase().includes(q) ||
          (d.clientName ?? '').toLowerCase().includes(q) ||
          (d.taskTitle ?? '').toLowerCase().includes(q),
      );
    }
    if (groupFilter === 'projects') items = items.filter((d) => d.projectId);
    else if (groupFilter === 'clients') items = items.filter((d) => d.clientId && !d.projectId);
    else if (groupFilter === 'other') items = items.filter((d) => !d.projectId && !d.clientId);
    return items;
  }, [data, search, groupFilter]);

  // Group by project
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; docs: DocItem[] }>();
    for (const d of filtered) {
      if (!d.projectId) continue;
      const existing = map.get(d.projectId);
      if (existing) existing.docs.push(d);
      else map.set(d.projectId, { name: d.projectName ?? 'Projet', docs: [d] });
    }
    return map;
  }, [filtered]);

  // Group by client (non-project docs)
  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; docs: DocItem[] }>();
    for (const d of filtered) {
      if (d.projectId || !d.clientId) continue;
      const existing = map.get(d.clientId);
      if (existing) existing.docs.push(d);
      else map.set(d.clientId, { name: d.clientName ?? 'Client', docs: [d] });
    }
    return map;
  }, [filtered]);

  // Ungrouped docs
  const ungrouped = useMemo(() => filtered.filter((d) => !d.projectId && !d.clientId), [filtered]);

  const totalSize = useMemo(
    () => (data?.items ?? []).reduce((sum, d) => sum + d.sizeBytes, 0),
    [data],
  );

  const viewUrl = (docId: string) => `/api/pro/businesses/${businessId}/documents/${docId}/view`;
  const downloadUrl = (docId: string) => `/api/pro/businesses/${businessId}/documents/${docId}/download`;

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Documents"
      subtitle="Tous les fichiers de votre entreprise"
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          <>
            <KpiCard label="Total" value={data?.total ?? 0} delay={0} size="compact" />
            <KpiCard label="Projets" value={data?.projectSummaries.length ?? 0} delay={50} size="compact" />
            <KpiCard label="Clients" value={data?.clientSummaries.length ?? 0} delay={100} size="compact" />
            <KpiCard label="Stockage" value={formatSize(totalSize)} delay={150} size="compact" />
          </>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-faint)' }}
          />
          <Input
            placeholder="Rechercher un document..."
            value={search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--surface-2)' }}>
          {GROUP_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter('group', tab.value)}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: groupFilter === tab.value ? 'var(--surface)' : 'transparent',
                color: groupFilter === tab.value ? 'var(--text)' : 'var(--text-faint)',
                boxShadow: groupFilter === tab.value ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="p-4 space-y-3">
          <Skeleton width="40%" height="14px" />
          <Skeleton height="48px" />
          <Skeleton height="48px" />
          <Skeleton height="48px" />
        </Card>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen size={48} style={{ color: 'var(--text-faint)' }} />
          <p className="mt-4 text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {search ? 'Aucun document trouvé' : 'Aucun document'}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-faint)' }}>
            {search
              ? 'Essayez avec un autre terme de recherche.'
              : 'Les documents ajoutés à vos projets et clients apparaîtront ici.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* By project */}
          {(groupFilter === 'all' || groupFilter === 'projects') &&
            byProject.size > 0 &&
            Array.from(byProject.entries()).map(([pid, group]) => (
              <GroupSection
                key={pid}
                icon={<FolderKanban size={15} style={{ color: 'var(--shell-accent)' }} />}
                title={group.name}
                count={group.docs.length}
                expanded={expandedProjects.has(pid)}
                onToggle={() => toggleProject(pid)}
                linkHref={`/app/pro/${businessId}/projects/${pid}`}
              >
                {group.docs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    onPreview={() => setPreviewDoc(doc)}
                    downloadUrl={downloadUrl}
                  />
                ))}
              </GroupSection>
            ))}

          {/* By client */}
          {(groupFilter === 'all' || groupFilter === 'clients') &&
            byClient.size > 0 &&
            Array.from(byClient.entries()).map(([cid, group]) => (
              <GroupSection
                key={cid}
                icon={<Users size={15} style={{ color: 'var(--shell-accent)' }} />}
                title={group.name}
                count={group.docs.length}
                expanded={expandedClients.has(cid)}
                onToggle={() => toggleClient(cid)}
                linkHref={`/app/pro/${businessId}/clients/${cid}`}
              >
                {group.docs.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    onPreview={() => setPreviewDoc(doc)}
                    downloadUrl={downloadUrl}
                  />
                ))}
              </GroupSection>
            ))}

          {/* Ungrouped */}
          {(groupFilter === 'all' || groupFilter === 'other') && ungrouped.length > 0 && (
            <Card className="overflow-hidden">
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <FileText size={15} style={{ color: 'var(--text-faint)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Autres documents</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>{ungrouped.length}</span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {ungrouped.map((doc) => (
                  <DocRow
                    key={doc.id}
                    doc={doc}
                    onPreview={() => setPreviewDoc(doc)}
                    downloadUrl={downloadUrl}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Preview modal */}
      <DocumentPreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc ? { id: previewDoc.id, title: previewDoc.title, filename: previewDoc.filename, mimeType: previewDoc.mimeType, sizeBytes: previewDoc.sizeBytes } : null}
        viewUrl={viewUrl}
        downloadUrl={downloadUrl}
      />
    </ProPageShell>
  );
}

// ─── Group Section ──────────────────────────────────────────────────
function GroupSection({
  icon,
  title,
  count,
  expanded,
  onToggle,
  linkHref,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  linkHref: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2.5 px-4 py-3 w-full text-left hover:bg-[var(--surface-hover)] transition-colors"
        style={{ borderBottom: expanded ? '1px solid var(--border)' : undefined }}
      >
        {icon}
        <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
          {count} fichier{count > 1 ? 's' : ''}
        </span>
        <Link
          href={linkHref}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-medium hover:underline px-1.5"
          style={{ color: 'var(--shell-accent)' }}
        >
          Ouvrir
        </Link>
        {expanded
          ? <ChevronDown size={14} style={{ color: 'var(--text-faint)' }} />
          : <ChevronRight size={14} style={{ color: 'var(--text-faint)' }} />}
      </button>
      {expanded && (
        <div className="divide-y divide-[var(--border)]">
          {children}
        </div>
      )}
    </Card>
  );
}

// ─── Document Row ───────────────────────────────────────────────────
function DocRow({
  doc,
  onPreview,
  downloadUrl,
}: {
  doc: DocItem;
  onPreview: () => void;
  downloadUrl: (id: string) => string;
}) {
  const isPreviewable = /^(application\/pdf|image\/)/.test(doc.mimeType);

  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-[var(--surface-hover)] transition-colors">
      <FileText size={16} style={{ color: 'var(--shell-accent)' }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{doc.title || doc.filename}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {formatSize(doc.sizeBytes)}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>·</span>
          <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
            {fmtDateShort(doc.createdAt)}
          </span>
          {doc.taskTitle && (
            <>
              <span className="text-[11px]" style={{ color: 'var(--text-faint)' }}>·</span>
              <span className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>
                {doc.taskTitle}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isPreviewable && (
          <Button variant="ghost" size="sm" onClick={onPreview} title="Aperçu">
            <Eye size={14} />
          </Button>
        )}
        <Button variant="ghost" size="sm" asChild title="Télécharger">
          <a href={downloadUrl(doc.id)} download>
            <Download size={14} />
          </a>
        </Button>
      </div>
    </div>
  );
}
