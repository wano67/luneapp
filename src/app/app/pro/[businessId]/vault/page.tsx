'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Copy, Eye, Trash2, Pencil } from 'lucide-react';
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

export default function VaultPage() {
  const active = useActiveBusiness({ optional: true });
  const businessId = active?.activeBusiness?.id;
  const role = active?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const isMember = role === 'ADMIN' || role === 'OWNER' || role === 'MEMBER';

  const toast = useToast();
  const [items, setItems] = useState<VaultItemMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItemMeta | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const vaultRv = useRevalidationKey(['pro:vault']);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: VaultItemMeta[] }>(
        `/api/pro/businesses/${businessId}/vault`
      );
      if (res.ok && res.data) {
        setItems(res.data.items ?? []);
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

  useEffect(() => { void load(); }, [load, vaultRv]);

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
      void load();
    } else {
      toast.error(res.error ?? 'Suppression impossible.');
    }
  }

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

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Trousseau"
      subtitle="Identifiants et mots de passe de l'entreprise."
      actions={
        isAdmin ? (
          <Button onClick={() => { setEditingItem(null); setModalOpen(true); }}>
            Nouvel identifiant
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label="Identifiants" value={items.length} delay={0} />
      </div>

      <div className="flex items-center gap-2">
        <KeyRound size={18} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Trousseau entreprise</span>
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
          <Button size="sm" variant="outline" onClick={() => void load()}>Réessayer</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Aucun identifiant enregistré.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {item.identifier ?? ''}
                  {item.identifier && item.email ? ' · ' : ''}
                  {item.email ?? ''}
                </p>
                {revealedPasswords[item.id] ? (
                  <p className="text-xs font-mono text-[var(--text-primary)] mt-1 bg-[var(--surface-2)] rounded px-2 py-1 inline-block">
                    {revealedPasswords[item.id]}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleReveal(item.id)}
                  disabled={revealingId === item.id}
                  title={revealedPasswords[item.id] ? 'Masquer' : 'Révéler'}
                >
                  <Eye size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleCopy(item.id)}
                  title="Copier le mot de passe"
                >
                  <Copy size={14} />
                </Button>
                {isAdmin ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingItem(item); setModalOpen(true); }}
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void handleDelete(item.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <VaultItemModal
        open={modalOpen}
        onCloseAction={() => { setModalOpen(false); setEditingItem(null); }}
        businessId={businessId}
        editingItem={editingItem}
        onSaved={() => { setModalOpen(false); setEditingItem(null); void load(); }}
      />
    </ProPageShell>
  );
}
