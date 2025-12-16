import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Cookies • Lune',
  description: 'Informations sur les cookies utilisés par Lune.',
};

export default function CookiesPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Cookies" description="Cookies techniques uniquement." />
      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-6 text-sm leading-relaxed text-[var(--text-secondary)]">
        <p>
          Lune utilise des cookies essentiels pour l’authentification (HttpOnly) et la sécurité
          (CSRF). Aucun cookie publicitaire n’est déposé.
        </p>
        <p>
          Le site marketing utilise des cookies minimaux pour la session et la protection CSRF. Vous
          pouvez bloquer les cookies tiers dans votre navigateur sans impacter l’app.
        </p>
      </Card>
    </div>
  );
}
