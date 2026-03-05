'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { SectionNav } from '@/components/ui/section-nav';
import { IdentiteSection } from './sections/IdentiteSection';
import { ContactFacturationSection } from './sections/ContactFacturationSection';
import { BanqueSection } from './sections/BanqueSection';
import { FacturationSection } from './sections/FacturationSection';
import { TextesLegauxSection } from './sections/TextesLegauxSection';
import { TaxesSection } from './sections/TaxesSection';
import { PermissionsSection } from './sections/PermissionsSection';
import { ComptabiliteSection } from './sections/ComptabiliteSection';
import { IntegrationsSection } from './sections/IntegrationsSection';
import { NotificationsSection } from './sections/NotificationsSection';

const SECTIONS = [
  { id: 'identite', label: 'Identité' },
  { id: 'contact', label: 'Contact' },
  { id: 'banque', label: 'Banque' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'textes', label: 'Textes légaux' },
  { id: 'taxes', label: 'Taxes' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'comptabilite', label: 'Comptabilité' },
  { id: 'integrations', label: 'Intégrations' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'equipe', label: 'Équipe' },
] as const;

export default function BusinessSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = (params?.businessId ?? '') as string;
  const sections = useMemo(() => [...SECTIONS], []);

  // Deep link: ?section=facturation → scroll to that section on mount
  useEffect(() => {
    const sectionParam = searchParams?.get('section');
    if (sectionParam) {
      const el = document.getElementById(sectionParam);
      if (el) {
        // Small delay to let sections render
        const timer = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
        return () => clearTimeout(timer);
      }
    }
  }, [searchParams]);

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Paramètres entreprise"
      subtitle="Configurez votre entreprise, facturation, comptabilité et notifications."
    >
      <SectionNav items={sections} />

      <div className="space-y-8 max-w-4xl">
        <section id="identite"><IdentiteSection businessId={businessId} /></section>
        <section id="contact"><ContactFacturationSection businessId={businessId} /></section>
        <section id="banque"><BanqueSection businessId={businessId} /></section>
        <section id="facturation"><FacturationSection businessId={businessId} /></section>
        <section id="textes"><TextesLegauxSection businessId={businessId} /></section>
        <section id="taxes"><TaxesSection businessId={businessId} /></section>
        <section id="permissions"><PermissionsSection businessId={businessId} /></section>
        <section id="comptabilite"><ComptabiliteSection businessId={businessId} /></section>
        <section id="integrations"><IntegrationsSection businessId={businessId} /></section>
        <section id="notifications"><NotificationsSection businessId={businessId} /></section>

        <section id="equipe">
          <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--border)] bg-[var(--surface)]/70 p-5">
            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">Équipe</p>
              <p className="text-sm text-[var(--text-secondary)]">Gérez les membres, invitations et rôles.</p>
            </div>
            <Link
              href={`/app/pro/${businessId}/team`}
              className="inline-flex items-center rounded-lg bg-[var(--shell-accent-dark)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Gérer l&apos;équipe
            </Link>
          </Card>
        </section>
      </div>
    </ProPageShell>
  );
}
