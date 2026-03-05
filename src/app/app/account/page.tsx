// src/app/app/account/page.tsx
'use client';

import { useMemo } from 'react';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { SectionNav } from '@/components/ui/section-nav';
import { ProfileSection } from './sections/ProfileSection';
import { SecuritySection } from './sections/SecuritySection';
import { PreferencesSection } from './sections/PreferencesSection';
import { FinancesSection } from './sections/FinancesSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { SessionSection } from './sections/SessionSection';
import { ProBusinessSection } from './sections/ProBusinessSection';

const SECTIONS = [
  { id: 'profil', label: 'Profil' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'preferences', label: 'Préférences' },
  { id: 'finances', label: 'Finances' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'session', label: 'Session' },
  { id: 'pro', label: 'Espace PRO' },
] as const;

export default function AccountPage() {
  const sections = useMemo(() => [...SECTIONS], []);

  return (
    <PageContainer className="gap-5">
      <PageHeader
        title="Mon compte"
        subtitle="Gérez votre profil, votre sécurité et vos préférences."
        backHref="/app"
        backLabel="Accueil"
      />

      <SectionNav items={sections} />

      <div className="space-y-8 max-w-4xl">
        <section id="profil"><ProfileSection /></section>
        <section id="securite"><SecuritySection /></section>
        <section id="preferences"><PreferencesSection /></section>
        <section id="finances"><FinancesSection /></section>
        <section id="notifications"><NotificationsSection /></section>
        <section id="session"><SessionSection /></section>
        <section id="pro"><ProBusinessSection /></section>
      </div>
    </PageContainer>
  );
}
