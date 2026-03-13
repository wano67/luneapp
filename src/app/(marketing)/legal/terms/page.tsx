import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionHeader } from '@/components/ui/section-header';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — Pivot',
  description: "Conditions d'utilisation du service Pivot.",
};

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Conditions Générales de Vente" description="Dernière mise à jour : 11 mars 2026" />

      <Section title="1. Objet">
        <p>
          Les présentes conditions générales de vente (ci-après « CGV ») régissent l&apos;utilisation
          de la plateforme Pivot, accessible à l&apos;adresse <strong>diwanbg.work</strong>, éditée par la société Pivot.
        </p>
        <p>La création d&apos;un compte implique l&apos;acceptation pleine et entière des présentes CGV.</p>
      </Section>

      <Section title="2. Description du service">
        <p>Pivot est une plateforme SaaS de gestion financière et professionnelle permettant :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>La gestion des finances personnelles (comptes, transactions, budgets, objectifs d&apos;épargne).</li>
          <li>La synchronisation bancaire automatique via Powens (agrégateur agréé ACPR).</li>
          <li>La gestion d&apos;activité professionnelle (clients, projets, devis, factures, paiements, équipe).</li>
          <li>Le stockage sécurisé d&apos;identifiants (trousseau chiffré).</li>
          <li>Le partage de suivi de projet avec des clients.</li>
        </ul>
      </Section>

      <Section title="3. Inscription et compte">
        <p>
          L&apos;utilisateur doit créer un compte en fournissant une adresse email valide et un mot de passe sécurisé.
          L&apos;adresse email doit être vérifiée pour accéder à l&apos;ensemble des fonctionnalités.
        </p>
        <p>
          L&apos;utilisateur est responsable de la confidentialité de ses identifiants de connexion et de toute
          activité réalisée depuis son compte.
        </p>
      </Section>

      <Section title="4. Tarifs et paiement">
        <p>
          L&apos;utilisation de base de Pivot est gratuite. Des fonctionnalités premium pourront être proposées
          à l&apos;avenir, moyennant un abonnement dont les tarifs seront communiqués avant toute souscription.
        </p>
        <p>Tout changement de tarification sera notifié au moins 30 jours avant son entrée en vigueur.</p>
      </Section>

      <Section title="5. Obligations de l'utilisateur">
        <p>L&apos;utilisateur s&apos;engage à :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Fournir des informations exactes et à jour.</li>
          <li>Ne pas utiliser le service à des fins illicites ou frauduleuses.</li>
          <li>Ne pas tenter de contourner les mesures de sécurité de la plateforme.</li>
          <li>Ne pas accéder ou tenter d&apos;accéder aux données d&apos;autres utilisateurs.</li>
          <li>Respecter la législation applicable, notamment en matière de facturation et de comptabilité.</li>
        </ul>
      </Section>

      <Section title="6. Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments de la plateforme (code, design, marques, logos) est protégé
          par le droit de la propriété intellectuelle et reste la propriété exclusive de Pivot.
        </p>
        <p>
          L&apos;utilisateur conserve la propriété de ses données et contenus. Il accorde à Pivot
          une licence limitée, non exclusive, pour héberger et traiter ces données aux seules fins
          de fournir le service.
        </p>
      </Section>

      <Section title="7. Responsabilités et limitations">
        <p>
          Pivot s&apos;engage à fournir le service avec diligence et dans le respect des standards de sécurité
          de l&apos;industrie. Cependant :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Le service est fourni « en l&apos;état », sans garantie de disponibilité permanente.</li>
          <li>Pivot ne saurait être tenu responsable des dommages indirects (perte de chiffre d&apos;affaires, perte de données).</li>
          <li>La responsabilité de Pivot est limitée au montant des sommes effectivement versées par l&apos;utilisateur au cours des 12 derniers mois.</li>
          <li>Pivot n&apos;est pas responsable des interruptions liées aux prestataires tiers (Powens, Railway, Cloudflare).</li>
        </ul>
      </Section>

      <Section title="8. Données personnelles">
        <p>
          Le traitement des données personnelles est régi par notre{' '}
          <Link href="/legal/privacy" className="text-[var(--accent-strong)] hover:underline">
            politique de confidentialité
          </Link>
          , qui fait partie intégrante des présentes CGV.
        </p>
      </Section>

      <Section title="9. Suspension et résiliation">
        <p>
          L&apos;utilisateur peut supprimer son compte à tout moment depuis les paramètres de l&apos;application.
          La suppression entraîne la destruction irréversible de ses données, sous réserve des
          obligations légales de conservation (cf. politique de confidentialité).
        </p>
        <p>
          Pivot se réserve le droit de suspendre ou résilier un compte en cas de violation des présentes
          CGV, après notification par email et un délai de 15 jours pour régulariser la situation.
        </p>
      </Section>

      <Section title="10. Droit applicable et litiges">
        <p>Les présentes CGV sont régies par le droit français.</p>
        <p>
          En cas de litige, les parties s&apos;efforceront de trouver une solution amiable. À défaut,
          le litige sera porté devant les tribunaux compétents du ressort du siège social de Pivot.
        </p>
        <p>
          Conformément à l&apos;article L.612-1 du Code de la consommation, le consommateur peut recourir
          à un médiateur de la consommation en cas de litige non résolu.
        </p>
      </Section>

      <Section title="11. Modifications des CGV">
        <p>
          Pivot se réserve le droit de modifier les présentes CGV à tout moment.
          Les modifications substantielles seront notifiées par email ou via l&apos;application au moins 30 jours
          avant leur entrée en vigueur. La poursuite de l&apos;utilisation du service après cette période
          vaut acceptation des nouvelles CGV.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>Pour toute question relative aux présentes CGV :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email : <a href="mailto:contact@diwanbg.work" className="text-[var(--accent-strong)] hover:underline">contact@diwanbg.work</a></li>
          <li>Plateforme : diwanbg.work</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="text-base font-semibold text-[var(--text)] mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        {children}
      </div>
    </div>
  );
}
