'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, ChevronRight, Settings, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Modal from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

type BusinessItem = {
  id: string;
  name: string;
  role: string;
  joinedAt: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MEMBER: 'Membre',
  VIEWER: 'Lecteur',
};

export function ProBusinessSection() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [target, setTarget] = useState<BusinessItem | null>(null);
  const [modalType, setModalType] = useState<'leave' | 'delete' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<{ items: Array<{ business?: { id?: string | bigint; name?: string }; role?: string; joinedAt?: string }> }>(
        '/api/pro/businesses', {}, ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data) {
        setBusinesses(
          (res.data.items ?? [])
            .map((i) => ({
              id: String(i.business?.id ?? ''),
              name: i.business?.name ?? '',
              role: i.role ?? 'MEMBER',
              joinedAt: i.joinedAt ?? null,
            }))
            .filter((b) => b.id && b.id !== '0'),
        );
      } else {
        setError(res.error ?? 'Impossible de charger vos business.');
      }
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  function openLeave(b: BusinessItem) {
    setTarget(b);
    setModalType('leave');
    setActionError(null);
  }

  function openDelete(b: BusinessItem) {
    setTarget(b);
    setModalType('delete');
    setActionError(null);
  }

  function closeModal() {
    if (actionLoading) return;
    setTarget(null);
    setModalType(null);
    setActionError(null);
  }

  async function handleLeave() {
    if (!target) return;
    setActionLoading(true);
    setActionError(null);
    const res = await fetchJson<{ left: boolean }>(
      `/api/pro/businesses/${encodeURIComponent(target.id)}/leave`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    );
    setActionLoading(false);
    if (!res.ok) {
      setActionError(res.error ?? 'Impossible de quitter ce business.');
      return;
    }
    setBusinesses((prev) => prev.filter((b) => b.id !== target.id));
    closeModal();
  }

  async function handleDelete() {
    if (!target) return;
    setActionLoading(true);
    setActionError(null);
    const res = await fetchJson<{ deleted: boolean }>(
      `/api/pro/businesses/${encodeURIComponent(target.id)}`,
      { method: 'DELETE' },
    );
    setActionLoading(false);
    if (!res.ok) {
      setActionError(res.error ?? 'Suppression impossible.');
      return;
    }
    setBusinesses((prev) => prev.filter((b) => b.id !== target.id));
    try {
      const stored = localStorage.getItem('activeProBusinessId') || localStorage.getItem('lastProBusinessId');
      if (stored === target.id) {
        localStorage.removeItem('activeProBusinessId');
        localStorage.removeItem('lastProBusinessId');
      }
    } catch { /* ignore */ }
    closeModal();
    router.refresh();
  }

  return (
    <>
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
        <div>
          <p className="text-base font-semibold text-[var(--text-primary)]">Espace PRO</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Vos entreprises et votre rôle dans chacune. Accédez aux paramètres, quittez ou supprimez un business.
          </p>
        </div>

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
        ) : businesses.length > 0 ? (
          <div className="space-y-2">
            {businesses.map((b) => {
              const isOwner = b.role === 'OWNER';
              const canLeave = b.role !== 'OWNER';

              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 size={18} className="shrink-0 text-[var(--text-secondary)]" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{b.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="neutral" className="text-[10px]">
                          {ROLE_LABELS[b.role] ?? b.role}
                        </Badge>
                        {b.joinedAt && (
                          <span className="text-[10px] text-[var(--text-faint)]">
                            Depuis le {new Date(b.joinedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/app/pro/${b.id}/settings`}
                      className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                      title="Paramètres"
                    >
                      <Settings size={16} />
                    </Link>
                    {canLeave && (
                      <button
                        type="button"
                        onClick={() => openLeave(b)}
                        className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--warning)]"
                        title="Quitter"
                      >
                        <LogOut size={16} />
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => openDelete(b)}
                        className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <Link
                      href={`/app/pro/${b.id}`}
                      className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                      title="Accéder"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            Aucun espace PRO. Créez un business depuis l&apos;accueil pour commencer.
          </p>
        )}
      </Card>

      {/* Leave modal */}
      <Modal
        open={modalType === 'leave'}
        onCloseAction={closeModal}
        title="Quitter le business"
        description="Tu perdras l'accès à ce business."
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Confirme que tu veux quitter « {target?.name ?? 'ce business'} ». Tu pourras y revenir seulement si un admin te rajoute.
          </p>
          {actionError && <p className="text-sm text-[var(--danger)]">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal} disabled={actionLoading}>Annuler</Button>
            <Button variant="danger" onClick={handleLeave} disabled={actionLoading}>
              {actionLoading ? 'Traitement…' : 'Quitter'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={modalType === 'delete'}
        onCloseAction={closeModal}
        title="Supprimer le business"
        description="Cette action est irréversible."
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Supprimer « {target?.name ?? 'ce business'} » supprimera les membres, prospects, clients et projets associés. Action réservée aux owners.
          </p>
          {actionError && <p className="text-sm text-[var(--danger)]">{actionError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal} disabled={actionLoading}>Annuler</Button>
            <Button variant="danger" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
