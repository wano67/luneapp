import type { Metadata } from 'next';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { StaggerChildren } from '@/components/marketing/StaggerChildren';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'À propos • Pivot',
  description: 'Pourquoi Pivot : un produit calme pour les indépendants et petites équipes qui jonglent entre pro et perso.',
};

export default function AboutPage() {
  return (
    <div className="space-y-12">
      {/* Vision */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader variant="marketing"
            title="Notre vision"
            description="Un OS calme pour les indépendants, agences et petites équipes."
          />
          <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            Pivot est né d&apos;un constat simple : les freelances et gérants de petites structures
            jonglent chaque semaine entre outils pro, tableurs personnels et apps bancaires. Le résultat
            est bruyant, éparpillé et chronophage. Pivot réunit tout ça en un seul espace calme — sans
            compromis sur la sécurité.
          </p>
        </section>
      </ScrollReveal>

      {/* Mission */}
      <section className="space-y-4">
        <ScrollReveal>
          <SectionHeader title="Notre mission" />
        </ScrollReveal>
        <StaggerChildren className="grid gap-4 md:grid-cols-2">
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">Pour les indépendants</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Freelances, consultants, créatifs : Pivot leur donne un cockpit pro complet (prospects,
              clients, projets, factures) et une vue perso (comptes, budgets, épargne) sans changer
              d&apos;outil.
            </p>
          </Card>
          <Card className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">Pour les petites équipes</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Studios, agences, associations : rôles, invitations, cockpit multi-entreprises et finances
              partagées. Sans la complexité des ERP, sans les frictions des outils patchwork.
            </p>
          </Card>
        </StaggerChildren>
      </section>

      {/* Valeurs */}
      <section className="space-y-4">
        <ScrollReveal>
          <SectionHeader title="Nos valeurs" />
        </ScrollReveal>
        <StaggerChildren className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              tag: 'Calme',
              desc: 'Moins de bruit, plus de lisibilité. Des cockpits clairs qui vont droit au but.',
            },
            {
              tag: 'Fiable',
              desc: "Pas de boucles, pas de données fantômes. Des états stables qu'on peut faire confiance.",
            },
            {
              tag: 'Transparent',
              desc: 'Tarifs clairs, données privées, pas de dark patterns. Ce que vous voyez est ce que vous obtenez.',
            },
            {
              tag: 'Mobile-first',
              desc: "Navigation et modals pensées pour les petits écrans. L'app fonctionne partout.",
            },
          ].map((v) => (
            <Card key={v.tag} className="feature-card-lift border-[var(--border)] bg-[var(--surface)] p-5">
              <Badge variant="neutral" className="mb-3 w-fit">
                {v.tag}
              </Badge>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{v.desc}</p>
            </Card>
          ))}
        </StaggerChildren>
      </section>

      {/* Roadmap légère */}
      <ScrollReveal>
        <section className="space-y-4">
          <SectionHeader title="Roadmap" description="Ce qui est fait, ce qui arrive." />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--success)]">
                Disponible maintenant
              </p>
              {[
                'Espace PRO : prospects, clients, projets, finances, stock, équipe',
                'Espace PERSO : comptes, transactions, budgets, épargne',
                'Focus : vue croisée PRO + PERSO',
                'Sécurité : CSRF, auth, rate-limit, cookies HttpOnly',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--success)]">✓</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
                À venir
              </p>
              {[
                'Import bancaire automatique (PSD2 / CSV amélioré)',
                'Rapports et exports comptables',
                'Intégrations avancées (Stripe, Zapier)',
                'App mobile native',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                >
                  <span className="mt-0.5 shrink-0 text-[var(--accent)]">→</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal>
        <Card className="flex flex-col gap-3 border-[var(--border)] bg-[var(--surface-2)] p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">Envie de rejoindre l&apos;aventure ?</div>
            <p className="text-sm text-[var(--text-secondary)]">
              Pivot évolue avec ses utilisateurs. Partagez vos besoins et vos cas d&apos;usage.
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
      </ScrollReveal>
    </div>
  );
}
