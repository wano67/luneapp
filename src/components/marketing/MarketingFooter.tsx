import Link from 'next/link';
import { LogoMark } from './LogoMark';

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
    <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:px-6">
        <div className="space-y-4">
          <LogoMark />
          <p className="max-w-md text-sm text-[var(--text-secondary)]">
            Lune, l’OS calme pour orchestrer vos finances personnelles et votre activité
            professionnelle, en toute sécurité.
          </p>
          <div className="text-xs text-[var(--text-faint)]">© {new Date().getFullYear()} Lune</div>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm text-[var(--text)] sm:grid-cols-3">
          <div className="space-y-3">
            <div className="font-semibold">Produit</div>
            <div className="space-y-2">
              {primaryLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-semibold">Légal</div>
            <div className="space-y-2">
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-[var(--text-secondary)] hover:text-[var(--text)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-semibold">Ressources</div>
            <div className="space-y-2">
              <span className="block text-[var(--text-secondary)]">Statut (bientôt)</span>
              <span className="block text-[var(--text-secondary)]">Blog (bientôt)</span>
              <Link
                href="/login"
                className="block text-[var(--text-secondary)] hover:text-[var(--text)]"
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
