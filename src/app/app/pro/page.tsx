// src/app/app/pro/page.tsx
import { AppShell } from '../AppShell';
import ProHomeClient from './ProHomeClient';

export default function ProHomePage() {
  return (
    <AppShell
      title="Espace PRO"
      description="Crée ou rejoins une entreprise pour piloter tes clients, projets et finances."
    >
      <ProHomeClient />
    </AppShell>
  );
}
