// src/app/app/account/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import Modal from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

type BusinessDetail = {
  id: string;
  name: string;
  role?: string | null;
};

export default function AccountPage() {
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [businessRole, setBusinessRole] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const ACTIVE_KEY = 'activeProBusinessId';
  const LAST_KEY = 'lastProBusinessId';

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_KEY) || localStorage.getItem(LAST_KEY);
      if (stored) setBusinessId(stored);
    } catch {
      // ignore storage
    }
  }, []);

  useEffect(() => {
    if (!businessId) return;
    setBusinessError(null);
    void (async () => {
      const res = await fetchJson<BusinessDetail>(
        `/api/pro/businesses/${encodeURIComponent(businessId)}`
      );
      if (!res.ok || !res.data) {
        setBusinessError(res.error ?? 'Impossible de charger le business actif.');
        return;
      }
      setBusinessName(res.data.name);
      setBusinessRole(res.data.role ?? null);
    })();
  }, [businessId]);

  const isOwner = businessRole === 'OWNER';
  const canLeave = businessRole != null && businessRole !== 'OWNER';

  const businessLabel = useMemo(() => {
    if (!businessId) return 'Aucun business actif';
    return `${businessName ?? 'Business'}${businessRole ? ` · ${businessRole}` : ''}`;
  }, [businessId, businessName, businessRole]);

  function clearActiveBusiness() {
    try {
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.removeItem(LAST_KEY);
    } catch {
      // ignore
    }
    setBusinessId(null);
    setBusinessName(null);
    setBusinessRole(null);
  }

  async function handleLogout() {
    setLogoutLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setLogoutLoading(false);
        return;
      }
      clearActiveBusiness();
      router.push('/login');
    } finally {
      setLogoutLoading(false);
    }
  }

  async function handleLeave() {
    if (!businessId) return;
    setActionLoading(true);
    setActionError(null);
    const res = await fetchJson<{ left: boolean }>(
      `/api/pro/businesses/${encodeURIComponent(businessId)}/leave`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) {
      setActionError(res.error ?? 'Impossible de quitter ce business.');
      setActionLoading(false);
      return;
    }
    clearActiveBusiness();
    setConfirmLeave(false);
    router.push('/app/pro');
  }

  async function handleDelete() {
    if (!businessId) return;
    setActionLoading(true);
    setActionError(null);
    const res = await fetchJson<{ deleted: boolean }>(
      `/api/pro/businesses/${encodeURIComponent(businessId)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setActionError(res.error ?? 'Suppression impossible.');
      setActionLoading(false);
      return;
    }
    clearActiveBusiness();
    setConfirmDelete(false);
    router.push('/app/pro');
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Compte"
        description="Gérez votre profil, votre sécurité et vos préférences."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-base font-semibold text-[var(--text)]">Profil</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Prénom, nom et email de contact.
          </p>
          <Button asChild variant="outline">
            <Link href="/app/account/profile">Ouvrir</Link>
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-base font-semibold text-[var(--text)]">Sécurité</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Mot de passe et informations de connexion.
          </p>
          <Button asChild variant="outline">
            <Link href="/app/account/security">Ouvrir</Link>
          </Button>
        </Card>
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-base font-semibold text-[var(--text)]">Préférences</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Langue et thème de l’interface.
          </p>
          <Button asChild variant="outline">
            <Link href="/app/account/preferences">Ouvrir</Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="text-base font-semibold text-[var(--text)]">Session</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Déconnecte-toi de l’app interne.
          </p>
          <Button variant="danger" onClick={handleLogout} disabled={logoutLoading}>
            {logoutLoading ? 'Déconnexion…' : 'Se déconnecter'}
          </Button>
        </Card>
      </div>

      <Card className="space-y-3 border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Espace PRO</div>
            <p className="text-xs text-[var(--text-secondary)]">{businessLabel}</p>
            {businessError ? (
              <p className="text-xs text-[var(--danger)]">{businessError}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!canLeave || actionLoading || !businessId}
              onClick={() => setConfirmLeave(true)}
            >
              Quitter le business
            </Button>
            <Button
              variant="danger"
              disabled={!isOwner || actionLoading || !businessId}
              onClick={() => setConfirmDelete(true)}
            >
              Supprimer le business
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>Rôle actuel :</span>
          <span className="font-semibold text-[var(--text)]">{businessRole ?? '—'}</span>
          <Button variant="outline" disabled size="sm">
            Renommer le business (bientôt)
          </Button>
        </div>

        {actionError ? (
          <p className="text-sm text-[var(--danger)]">{actionError}</p>
        ) : null}
      </Card>

      <Modal
        open={confirmLeave}
        onCloseAction={() => (actionLoading ? null : setConfirmLeave(false))}
        title="Quitter le business"
        description="Tu perdras l’accès à ce business."
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Confirme que tu veux quitter « {businessName ?? 'ce business'} ». Tu pourras y revenir
            seulement si un admin te rajoute.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmLeave(false)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleLeave} disabled={actionLoading}>
              {actionLoading ? 'Traitement…' : 'Quitter'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onCloseAction={() => (actionLoading ? null : setConfirmDelete(false))}
        title="Supprimer le business"
        description="Cette action est irréversible."
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Supprimer « {businessName ?? 'ce business'} » supprimera les membres, prospects, clients
            et projets associés. Action réservée aux owners.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
