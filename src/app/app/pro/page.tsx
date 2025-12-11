import { AppShell } from '../AppShell';
import ProHomeClient from './ProHomeClient';

export default function ProHomePage() {
  const sidebarItems = [
    { href: '/app/pro', label: 'Vue d’ensemble' },
    // Tu pourras ajouter ici: /app/pro/clients, /app/pro/projects, etc.
  ];

  return (
    <AppShell
      currentSection="pro"
      title="Espace PRO"
      description="Crée ou rejoins une entreprise pour piloter tes clients, projets et finances."
      sidebarItems={sidebarItems}
    >
      <ProHomeClient />
    </AppShell>
  );
}
