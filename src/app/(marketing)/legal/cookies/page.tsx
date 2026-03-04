import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Cookies • Pivot',
  description: 'Informations sur les cookies utilisés par Pivot.',
};

export default function CookiesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Cookies" description="Cookies techniques uniquement." />
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p>
          Pivot utilise des cookies essentiels pour l&apos;authentification (HttpOnly) et la sécurité
          (CSRF). Aucun cookie publicitaire n&apos;est déposé.
        </p>
        <p>
          Le site marketing utilise des cookies minimaux pour la session et la protection CSRF. Vous
          pouvez bloquer les cookies tiers dans votre navigateur sans impacter l&apos;app.
        </p>
      </Card>
    </div>
  );
}
