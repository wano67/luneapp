'use client';

import { useEffect } from 'react';
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
import { CalendarSyncSection } from './sections/CalendarSyncSection';

const SECTION_GROUPS = [
  {
    label: 'Entreprise',
    items: [
      { id: 'identite', label: 'Identité' },
      { id: 'contact', label: 'Contact' },
      { id: 'banque', label: 'Banque' },
    ],
  },
  {
    label: 'Facturation & Taxes',
    items: [
      { id: 'facturation', label: 'Facturation' },
      { id: 'textes', label: 'Textes légaux' },
      { id: 'taxes', label: 'Taxes' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'permissions', label: 'Permissions' },
      { id: 'comptabilite', label: 'Comptabilité' },
      { id: 'integrations', label: 'Intégrations' },
    ],
  },
  {
    label: 'Organisation',
    items: [
      { id: 'calendrier', label: 'Calendrier' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'equipe', label: 'Équipe' },
    ],
  },
];

function GroupHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-[var(--text-secondary)]">{subtitle}</p>
      )}
      <hr className="border-[var(--border)]" />
    </div>
  );
}

export default function BusinessSettingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = (params?.businessId ?? '') as string;

  // Deep link: ?section=facturation → scroll to that section on mount
  useEffect(() => {
    const sectionParam = searchParams?.get('section');
    if (sectionParam) {
      const el = document.getElementById(sectionParam);
      if (el) {
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
      <SectionNav groups={SECTION_GROUPS} />

      <div className="space-y-12 max-w-4xl">
        {/* ── Entreprise ── */}
        <div className="space-y-6">
          <GroupHeader title="Entreprise" subtitle="Identité, coordonnées et informations bancaires" />
          <section id="identite"><IdentiteSection businessId={businessId} /></section>
          <section id="contact"><ContactFacturationSection businessId={businessId} /></section>
          <section id="banque"><BanqueSection businessId={businessId} /></section>
        </div>

        {/* ── Facturation & Taxes ── */}
        <div className="space-y-6">
          <GroupHeader title="Facturation & Taxes" subtitle="Paramètres de facturation, mentions légales et taux de TVA" />
          <section id="facturation"><FacturationSection businessId={businessId} /></section>
          <section id="textes"><TextesLegauxSection businessId={businessId} /></section>
          <section id="taxes"><TaxesSection businessId={businessId} /></section>
        </div>

        {/* ── Administration ── */}
        <div className="space-y-6">
          <GroupHeader title="Administration" subtitle="Rôles, comptabilité et intégrations externes" />
          <section id="permissions"><PermissionsSection businessId={businessId} /></section>
          <section id="comptabilite"><ComptabiliteSection businessId={businessId} /></section>
          <section id="integrations"><IntegrationsSection businessId={businessId} /></section>
        </div>

        {/* ── Organisation ── */}
        <div className="space-y-6">
          <GroupHeader title="Organisation" subtitle="Calendrier, notifications et gestion d'équipe" />
          <section id="calendrier"><CalendarSyncSection businessId={businessId} /></section>
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
      </div>
    </ProPageShell>
  );
}
