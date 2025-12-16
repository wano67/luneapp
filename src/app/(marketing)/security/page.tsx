import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Sécurité • Lune',
  description: 'Auth unifiée, CSRF, rate-limit, request-id, no-store : la sécurité est native.',
};

const controls = [
  {
    title: 'Auth & middleware',
    desc: 'Auth unifiée avec cookies HttpOnly, middleware qui protège toutes les routes sensibles.',
  },
  {
    title: 'CSRF & mutateurs',
    desc: 'CSRF enforced sur les mutations, vérification des origines autorisées.',
  },
  {
    title: 'Rate limiting',
    desc: 'Limitation des appels pour éviter l’abus et protéger les endpoints sensibles.',
  },
  {
    title: 'Request-id sur erreurs',
    desc: 'Toutes les erreurs surfacent un x-request-id pour diagnostiquer côté client.',
  },
  {
    title: 'No-store',
    desc: 'Réponses sensibles marquées no-store pour éviter la mise en cache non voulue.',
  },
  {
    title: 'Prisma & BigInt',
    desc: 'Sérialisation sécurisée (BigInt → string) pour éviter les corruptions côté client.',
  },
];

export default function SecurityPage() {
  return (
    <div className="space-y-10">
      <SectionHeader
        title="Sécurité native"
        description="Les garde-fous de l’app interne sont pensés dès le départ."
      />

      <Alert
        variant="info"
        title="Pas d’effet vitrine"
        description="Le site marketing décrit exactement les protections déjà présentes dans l’app : CSRF, auth, rate-limit, request-id, no-store."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {controls.map((control) => (
          <Card key={control.title} className="border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{control.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{control.desc}</p>
          </Card>
        ))}
      </div>

      <SectionHeader
        title="Transparence"
        description="Les appels côté client affichent le request-id en cas d’erreur. Les mutations sont protégées par CSRF. Les endpoints critiques sont no-store et rate-limited."
      />
    </div>
  );
}
