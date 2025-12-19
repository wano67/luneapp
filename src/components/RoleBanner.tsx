import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type RoleBannerProps = {
  role: string | null | undefined;
  className?: string;
};

export function RoleBanner({ role, className }: RoleBannerProps) {
  if (!role || role === 'OWNER' || role === 'ADMIN') return null;
  return (
    <Card className={`flex flex-col gap-2 border-[var(--border)] bg-[var(--surface)]/60 p-3 ${className ?? ''}`}>
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        Vous êtes en lecture seule (rôle : {role}).
      </p>
      <p className="text-xs text-[var(--text-secondary)]">
        Certaines actions nécessitent un rôle ADMIN ou OWNER. Demandez un accès pour tester les fonctionnalités
        complètes.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href="mailto:support@luneapp.test?subject=Demande%20accès%20admin">Demander l’accès admin</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard?.writeText('support@luneapp.test').catch(() => {});
          }}
        >
          Copier email support
        </Button>
      </div>
    </Card>
  );
}

export default RoleBanner;
