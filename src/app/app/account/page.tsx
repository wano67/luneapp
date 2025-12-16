// src/app/app/account/page.tsx
'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';

export default function AccountPage() {
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
      </div>
    </div>
  );
}
