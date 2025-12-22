// src/app/app/pro/SwitchBusinessModal.tsx
'use client';

import Link from 'next/link';
import { Modal } from '@/components/ui/modal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveBusiness } from './ActiveBusinessProvider';
import { FaviconAvatar } from '../components/FaviconAvatar';

export default function SwitchBusinessModal() {
  const ctx = useActiveBusiness({ optional: true });
  if (!ctx) return null;

  const {
    switchOpen,
    closeSwitchModal,
    businesses,
    loadingBusinesses,
    businessesError,
    refreshBusinesses,
    setActiveBusiness,
  } = ctx;

  return (
    <Modal
      open={switchOpen}
      onCloseAction={() => (loadingBusinesses ? null : closeSwitchModal())}
      title="Changer d’entreprise"
      description="Sélectionne une entreprise pour basculer le contexte."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/pro?create=1" onClick={closeSwitchModal}>
              Créer une entreprise
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/pro?join=1" onClick={closeSwitchModal}>
              Rejoindre via invitation
            </Link>
          </Button>
          <Button size="sm" onClick={refreshBusinesses} disabled={loadingBusinesses}>
            {loadingBusinesses ? 'Chargement…' : 'Rafraîchir'}
          </Button>
        </div>

        {businessesError ? (
          <p className="text-sm text-rose-400">{businessesError}</p>
        ) : null}

        {loadingBusinesses ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des entreprises…</p>
        ) : businesses.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Aucune entreprise accessible. Crée ou rejoins-en une.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {businesses.map((item) => (
              <Card key={item.business.id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <FaviconAvatar
                      name={item.business.name}
                      websiteUrl={item.business.websiteUrl}
                      size={32}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-primary)]">
                        {item.business.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        ID {item.business.id}
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral">{item.role}</Badge>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setActiveBusiness({
                      id: item.business.id,
                      name: item.business.name,
                      role: item.role,
                      websiteUrl: item.business.websiteUrl,
                    });
                    closeSwitchModal();
                    window.location.href = `/app/pro/${item.business.id}`;
                  }}
                >
                  Basculer ici
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
