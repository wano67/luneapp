import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Pivot',
  description: 'Comment Pivot traite et protège vos données personnelles.',
};

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Politique de confidentialité" description="Dernière mise à jour : 11 mars 2026" />

      <Section title="1. Responsable du traitement">
        <p>
          La société Pivot, exploitant la plateforme accessible à l&apos;adresse <strong>diwanbg.work</strong>,
          est responsable du traitement de vos données personnelles au sens du Règlement Général sur la
          Protection des Données (RGPD) et de la loi Informatique et Libertés.
        </p>
        <p>
          Contact DPO : <a href="mailto:privacy@diwanbg.work" className="text-[var(--accent-strong)] hover:underline">privacy@diwanbg.work</a>
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons les catégories de données suivantes :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Données d&apos;identification</strong> : nom, prénom, adresse email, mot de passe (hashé).</li>
          <li><strong>Données financières</strong> : transactions bancaires, soldes de comptes, budgets, objectifs d&apos;épargne (via Powens/Budget Insight pour la synchronisation bancaire).</li>
          <li><strong>Données professionnelles</strong> : clients, projets, devis, factures, paiements, documents, identifiants de trousseau (chiffrés AES-256-GCM).</li>
          <li><strong>Données techniques</strong> : adresse IP, type de navigateur, pages visitées, durée de session.</li>
          <li><strong>Données de consentement</strong> : date et heure d&apos;acceptation des CGV, de la politique de confidentialité, et du consentement marketing.</li>
        </ul>
      </Section>

      <Section title="3. Bases légales du traitement">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 text-left font-semibold">Finalité</th>
                <th className="py-2 text-left font-semibold">Base légale</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Fourniture du service (gestion de comptes, finances, projets)', 'Exécution du contrat (art. 6.1.b RGPD)'],
                ['Synchronisation bancaire via Powens', 'Consentement explicite (art. 6.1.a RGPD)'],
                ['Envoi de communications commerciales', 'Consentement (art. 6.1.a RGPD)'],
                ['Sécurité et prévention des fraudes', 'Intérêt légitime (art. 6.1.f RGPD)'],
                ['Conservation des factures et documents comptables', 'Obligation légale (art. 6.1.c RGPD)'],
              ].map(([purpose, basis], i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4">{purpose}</td>
                  <td className="py-2">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="4. Sous-traitants et transferts de données">
        <p>Nous faisons appel aux sous-traitants suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Railway</strong> (Hébergement) — serveurs aux États-Unis, clauses contractuelles types (CCT) conformément à l&apos;art. 46 RGPD.</li>
          <li><strong>Powens / Budget Insight</strong> (Agrégation bancaire) — société française, données hébergées en UE, agréée ACPR.</li>
          <li><strong>Resend</strong> (Envoi d&apos;emails) — serveurs aux États-Unis, CCT en place.</li>
          <li><strong>Cloudflare</strong> (DNS, CDN, protection DDoS) — clauses contractuelles types.</li>
        </ul>
        <p>
          Aucune donnée n&apos;est vendue à des tiers. Les transferts hors UE sont encadrés par des
          clauses contractuelles types approuvées par la Commission européenne.
        </p>
      </Section>

      <Section title="5. Durées de conservation">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Données de compte</strong> : conservées pendant la durée de votre inscription, puis supprimées sous 30 jours après demande de suppression.</li>
          <li><strong>Données bancaires synchronisées</strong> : supprimées dans les 48 heures suivant la déconnexion de Powens ou la suppression du compte.</li>
          <li><strong>Factures et documents comptables</strong> : conservés 10 ans (obligation légale, art. L123-22 du Code de commerce).</li>
          <li><strong>Logs de sécurité</strong> : 90 jours.</li>
          <li><strong>Tokens expirés/révoqués</strong> : supprimés sous 1 an.</li>
          <li><strong>Données soft-deleted</strong> : purgées après 1 an.</li>
        </ul>
      </Section>

      <Section title="6. Sécurité des données">
        <p>Nous mettons en œuvre les mesures de sécurité suivantes :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Chiffrement des mots de passe avec <strong>bcrypt</strong> (cost factor 10).</li>
          <li>Chiffrement des données sensibles (trousseau, tokens Powens) avec <strong>AES-256-GCM</strong>.</li>
          <li>Communications exclusivement en <strong>HTTPS/TLS</strong>.</li>
          <li>Tokens d&apos;authentification <strong>JWT signés HS256</strong>, transmis via cookies httpOnly, Secure, SameSite=Lax.</li>
          <li>Protection <strong>CSRF</strong> par vérification d&apos;origine sur toutes les mutations.</li>
          <li><strong>Rate limiting</strong> sur toutes les routes API.</li>
          <li>Hachage SHA-256 des tokens de partage et de vérification d&apos;email.</li>
        </ul>
      </Section>

      <Section title="7. Vos droits">
        <p>Conformément au RGPD (articles 15 à 22), vous disposez des droits suivants :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données personnelles.</li>
          <li><strong>Droit de rectification</strong> : corriger vos données inexactes.</li>
          <li><strong>Droit à l&apos;effacement</strong> : demander la suppression de votre compte et de vos données.</li>
          <li><strong>Droit à la portabilité</strong> : exporter vos données dans un format structuré (JSON).</li>
          <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement fondé sur l&apos;intérêt légitime.</li>
          <li><strong>Droit de limitation</strong> : restreindre le traitement dans certains cas.</li>
          <li><strong>Retrait du consentement</strong> : à tout moment pour les traitements fondés sur le consentement (marketing, Powens).</li>
        </ul>
        <p>
          Pour exercer vos droits, contactez-nous à{' '}
          <a href="mailto:privacy@diwanbg.work" className="text-[var(--accent-strong)] hover:underline">privacy@diwanbg.work</a>.
          Nous répondons sous 30 jours maximum.
        </p>
        <p>
          Vous disposez également du droit de déposer une réclamation auprès de la CNIL
          (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-strong)] hover:underline">www.cnil.fr</a>).
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          Pivot utilise uniquement des cookies strictement nécessaires au fonctionnement du service
          (cookies d&apos;authentification httpOnly). Nous n&apos;utilisons pas de cookies de tracking,
          d&apos;analytics ou publicitaires.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment.
          En cas de modification substantielle, nous vous informerons par email ou via une notification dans l&apos;application.
          La date de dernière mise à jour est indiquée en haut de cette page.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>Pour toute question relative à la protection de vos données :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email : <a href="mailto:privacy@diwanbg.work" className="text-[var(--accent-strong)] hover:underline">privacy@diwanbg.work</a></li>
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
