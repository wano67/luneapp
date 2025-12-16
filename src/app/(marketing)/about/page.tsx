import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos • Lune',
  description: 'Pourquoi Lune : un produit calme pour orchestrer finances perso et business pro.',
};

export default function AboutPage() {
  return (
    <div className="space-y-10">
      <SectionHeader
        title="Notre vision"
        description="Construire un OS calme pour les indépendants, agences et personnes qui jonglent entre pro et perso."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Calme par design',
            desc: 'Moins de bruit, plus de lisibilité. Des cockpits clairs pour aller droit au but.',
          },
          {
            title: 'Fiable au quotidien',
            desc: 'AbortController, pas de boucles de fetch, request-id visibles, redirections legacy gérées.',
          },
          {
            title: 'Mobile-first',
            desc: 'Navigation et modals testées sur mobile. Les CTA principaux restent accessibles.',
          },
        ].map((item) => (
          <Card key={item.title} className="border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{item.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text)]">Envie de rejoindre l’aventure ?</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Lune évolue avec ses utilisateurs. Partagez vos besoins et vos cas d’usage.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/contact">Nous écrire</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Créer un compte</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
