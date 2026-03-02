import Link from 'next/link';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';

const primaryLinks = [
  { href: '/features', label: 'Fonctionnalités' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/security', label: 'Sécurité' },
  { href: '/about', label: 'À propos' },
  { href: '/contact', label: 'Contact' },
];

const legalLinks = [
  { href: '/legal/terms', label: 'Conditions' },
  { href: '/legal/privacy', label: 'Confidentialité' },
  { href: '/legal/cookies', label: 'Cookies' },
];

export function MarketingFooter() {
  return (
    <footer style={{ background: 'var(--shell-sidebar-bg)' }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:px-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <PivotLogo size={32} color="var(--shell-accent)" />
            <PivotWordmark height={16} color="var(--shell-sidebar-text)" />
          </div>
          <p
            className="max-w-md text-sm"
            style={{ color: 'var(--shell-sidebar-text)', opacity: 0.6 }}
          >
            Pivot structure vos finances personnelles et votre activité
            professionnelle, en toute sécurité.
          </p>
          <div className="text-xs" style={{ color: 'var(--shell-sidebar-text)', opacity: 0.3 }}>
            © {new Date().getFullYear()} Pivot
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-3">
          <div className="space-y-3">
            <div
              className="font-semibold"
              style={{ color: 'var(--shell-sidebar-text)' }}
            >
              Produit
            </div>
            <div className="space-y-2">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="footer-link block"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div
              className="font-semibold"
              style={{ color: 'var(--shell-sidebar-text)' }}
            >
              Légal
            </div>
            <div className="space-y-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="footer-link block"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div
              className="font-semibold"
              style={{ color: 'var(--shell-sidebar-text)' }}
            >
              Ressources
            </div>
            <div className="space-y-2">
              <span
                className="block"
                style={{ color: 'rgba(238,237,227,0.3)' }}
              >
                Statut (bientôt)
              </span>
              <span
                className="block"
                style={{ color: 'rgba(238,237,227,0.3)' }}
              >
                Blog (bientôt)
              </span>
              <Link
                href="/login"
                className="footer-link block"
              >
                Accès app
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
