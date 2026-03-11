'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Copy, Eye, Trash2, Pencil, FolderOpen, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { revalidate, useRevalidationKey } from '@/lib/revalidate';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { VaultItemModal } from '@/components/pro/vault/VaultItemModal';

type VaultItemMeta = {
  id: string;
  title: string;
  identifier: string | null;
  email: string | null;
  note: string | null;
  projectId: string | null;
  createdAt: string;
};

type ProjectSummary = {
  projectId: string;
  projectName: string;
  count: number;
};

// ─── VaultItemRow ───────────────────────────────────────────────────────────
function VaultItemRow({
  item,
  isAdmin,
  revealedPassword,
  isRevealing,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: {
  item: VaultItemMeta;
  isAdmin: boolean;
  revealedPassword: string | undefined;
  isRevealing: boolean;
  onReveal: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit: (item: VaultItemMeta) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {item.identifier ?? ''}
          {item.identifier && item.email ? ' · ' : ''}
          {item.email ?? ''}
        </p>
        {revealedPassword ? (
          <p className="text-xs font-mono text-[var(--text-primary)] mt-1 bg-[var(--surface-2)] rounded px-2 py-1 inline-block">
            {revealedPassword}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReveal(item.id)}
          disabled={isRevealing}
          title={revealedPassword ? 'Masquer' : 'Révéler'}
        >
          <Eye size={14} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCopy(item.id)}
          title="Copier le mot de passe"
        >
          <Copy size={14} />
        </Button>
        {isAdmin ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(item)}
              title="Modifier"
            >
              <Pencil size={14} />
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(item.id)}
              title="Supprimer"
            >
              <Trash2 size={14} />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function VaultPage() {
  const active = useActiveBusiness({ optional: true });
  const businessId = active?.activeBusiness?.id;
  const role = active?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const isMember = role === 'ADMIN' || role === 'OWNER' || role === 'MEMBER';

  const toast = useToast();
  const [items, setItems] = useState<VaultItemMeta[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItemMeta | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  // Project navigation
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [projectItems, setProjectItems] = useState<VaultItemMeta[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const vaultRv = useRevalidationKey(['pro:vault']);

  // ─── Load summary (business items + project summaries) ──────────────────
  const loadSummary = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: VaultItemMeta[]; projectSummaries: ProjectSummary[] }>(
        `/api/pro/businesses/${businessId}/vault?scope=summary`
      );
      if (res.ok && res.data) {
        setItems(res.data.items ?? []);
        setProjectSummaries(res.data.projectSummaries ?? []);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger le trousseau.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void loadSummary(); }, [loadSummary, vaultRv]);

  // ─── Load project items ─────────────────────────────────────────────────
  const loadProjectItems = useCallback(async (projectId: string) => {
    if (!businessId) return;
    setProjectLoading(true);
    try {
      const res = await fetchJson<{ items: VaultItemMeta[] }>(
        `/api/pro/businesses/${businessId}/vault?projectId=${projectId}`
      );
      if (res.ok && res.data) {
        setProjectItems(res.data.items ?? []);
      }
    } catch { /* empty */ } finally {
      setProjectLoading(false);
    }
  }, [businessId]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  async function handleReveal(itemId: string) {
    if (revealedPasswords[itemId]) {
      setRevealedPasswords((prev) => { const next = { ...prev }; delete next[itemId]; return next; });
      return;
    }
    setRevealingId(itemId);
    try {
      const res = await fetchJson<{ item: { password: string } }>(
        `/api/pro/businesses/${businessId}/vault/${itemId}`
      );
      if (res.ok && res.data) {
        setRevealedPasswords((prev) => ({ ...prev, [itemId]: res.data!.item.password }));
      }
    } catch {
      toast.error('Impossible de révéler le mot de passe.');
    } finally {
      setRevealingId(null);
    }
  }

  async function handleCopy(itemId: string) {
    let password = revealedPasswords[itemId];
    if (!password) {
      try {
        const res = await fetchJson<{ item: { password: string } }>(
          `/api/pro/businesses/${businessId}/vault/${itemId}`
        );
        if (res.ok && res.data) password = res.data.item.password;
      } catch { /* empty */ }
    }
    if (!password) { toast.error('Impossible de copier.'); return; }
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Mot de passe copié.');
    } catch {
      toast.error('Copie impossible.');
    }
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm('Supprimer cet identifiant ?')) return;
    const res = await fetchJson(`/api/pro/businesses/${businessId}/vault/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Identifiant supprimé.');
      revalidate('pro:vault');
      if (selectedProject) {
        void loadProjectItems(selectedProject.id);
      }
      void loadSummary();
    } else {
      toast.error(res.error ?? 'Suppression impossible.');
    }
  }

  function handleSaved() {
    setModalOpen(false);
    setEditingItem(null);
    if (selectedProject) {
      void loadProjectItems(selectedProject.id);
    }
    void loadSummary();
  }

  function selectProject(projectId: string, projectName: string) {
    setSelectedProject({ id: projectId, name: projectName });
    setRevealedPasswords({});
    void loadProjectItems(projectId);
  }

  function goBack() {
    setSelectedProject(null);
    setProjectItems([]);
    setRevealedPasswords({});
  }

  // ─── Guards ─────────────────────────────────────────────────────────────
  if (!businessId) {
    return <p className="text-sm text-[var(--text-secondary)]">Aucune entreprise active.</p>;
  }

  if (!isMember) {
    return (
      <ProPageShell backHref={`/app/pro/${businessId}`} backLabel="Dashboard" title="Trousseau">
        <p className="text-sm text-[var(--text-secondary)]">Accès réservé aux membres.</p>
      </ProPageShell>
    );
  }

  // ─── Project view ───────────────────────────────────────────────────────
  if (selectedProject) {
    return (
      <ProPageShell
        backHref={`/app/pro/${businessId}`}
        backLabel="Dashboard"
        title="Trousseau"
        subtitle={selectedProject.name}
        actions={
          isAdmin ? (
            <Button onClick={() => { setEditingItem(null); setModalOpen(true); }}>
              Ajouter
            </Button>
          ) : null
        }
      >
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          Trousseau
        </button>

        <div className="flex items-center gap-2">
          <KeyRound size={18} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {selectedProject.name} · {projectItems.length} identifiant{projectItems.length !== 1 ? 's' : ''}
          </span>
        </div>

        {projectLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 space-y-2">
                <Skeleton width="40%" height="14px" />
                <Skeleton width="70%" height="12px" />
              </div>
            ))}
          </div>
        ) : projectItems.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun identifiant pour ce projet.</p>
        ) : (
          <div className="space-y-2">
            {projectItems.map((item) => (
              <VaultItemRow
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                revealedPassword={revealedPasswords[item.id]}
                isRevealing={revealingId === item.id}
                onReveal={(id) => void handleReveal(id)}
                onCopy={(id) => void handleCopy(id)}
                onEdit={(it) => { setEditingItem(it); setModalOpen(true); }}
                onDelete={(id) => void handleDelete(id)}
              />
            ))}
          </div>
        )}

        <VaultItemModal
          open={modalOpen}
          onCloseAction={() => { setModalOpen(false); setEditingItem(null); }}
          businessId={businessId}
          projectId={selectedProject.id}
          editingItem={editingItem}
          onSaved={handleSaved}
        />
      </ProPageShell>
    );
  }

  // ─── Root view ──────────────────────────────────────────────────────────
  const totalCount = items.length + projectSummaries.reduce((s, p) => s + p.count, 0);
  const filteredProjects = projectSearch
    ? projectSummaries.filter((p) => p.projectName.toLowerCase().includes(projectSearch.toLowerCase()))
    : projectSummaries;

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Trousseau"
      subtitle="Identifiants et mots de passe de l&apos;entreprise."
      actions={
        isAdmin ? (
          <Button onClick={() => { setEditingItem(null); setModalOpen(true); }}>
            Nouvel identifiant
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label="Identifiants" value={totalCount} delay={0} />
      </div>

      {/* ─── Business-level items ─────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <KeyRound size={18} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Trousseau entreprise</span>
        <span className="text-xs text-[var(--text-secondary)]">· {items.length}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 space-y-2">
              <Skeleton width="40%" height="14px" />
              <Skeleton width="70%" height="12px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void loadSummary()}>Réessayer</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Aucun identifiant entreprise.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <VaultItemRow
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              revealedPassword={revealedPasswords[item.id]}
              isRevealing={revealingId === item.id}
              onReveal={(id) => void handleReveal(id)}
              onCopy={(id) => void handleCopy(id)}
              onEdit={(it) => { setEditingItem(it); setModalOpen(true); }}
              onDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}

      {/* ─── Projects section ─────────────────────────────────────────── */}
      {!loading && !error && (
        <>
          <div className="flex items-center gap-2 mt-4">
            <FolderOpen size={18} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Projets</span>
            <span className="text-xs text-[var(--text-secondary)]">· {projectSummaries.length}</span>
          </div>

          {projectSummaries.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Aucun projet avec des identifiants.</p>
          ) : (
            <>
              {projectSummaries.length > 5 && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    placeholder="Rechercher un projet…"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                {filteredProjects.map((p) => (
                  <button
                    key={p.projectId}
                    onClick={() => selectProject(p.projectId, p.projectName)}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderOpen size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{p.projectName}</span>
                    </div>
                    <span className="text-xs text-[var(--text-secondary)] shrink-0 ml-2">
                      {p.count} identifiant{p.count !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
                {filteredProjects.length === 0 && projectSearch && (
                  <p className="text-sm text-[var(--text-secondary)]">Aucun projet trouvé.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      <VaultItemModal
        open={modalOpen}
        onCloseAction={() => { setModalOpen(false); setEditingItem(null); }}
        businessId={businessId}
        editingItem={editingItem}
        onSaved={handleSaved}
      />
    </ProPageShell>
  );
}
