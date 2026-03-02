import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { normalizeWebsiteUrl } from '@/lib/website';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';

export type Contact = {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
  websiteUrl?: string | null;
  lastContactAt?: string | null;
};

export type ContactStats = {
  projects: number;
  active: number;
  valueCents: number;
  lastInteraction?: string | null;
};

type Props = {
  href: string;
  contact: Contact;
  stats?: ContactStats;
  index?: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export function ContactCard({ href, contact, stats, index = 0 }: Props) {
  const normalized = normalizeWebsiteUrl(contact.websiteUrl).value;

  const rows = [
    { label: 'Projets', value: String(stats?.projects ?? 0) },
    { label: 'Actifs', value: String(stats?.active ?? 0) },
    { label: 'Valeur', value: formatCurrencyEUR(stats?.valueCents) },
    { label: 'Dernière', value: formatDate(contact.lastContactAt ?? stats?.lastInteraction) },
  ];

  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-xl p-3 transition hover:-translate-y-1 hover:shadow-lg animate-fade-in-up"
      style={{
        background: 'var(--shell-accent)',
        height: 200,
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Top: avatar + name */}
      <div className="flex items-start gap-3">
        <LogoAvatar
          name={contact.name || contact.company || 'Contact'}
          websiteUrl={normalized ?? undefined}
          size={32}
          className="ring-1 ring-white/20"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{contact.name || 'Sans nom'}</p>
          <p className="text-xs text-white/70 truncate mt-0.5">
            {contact.company || contact.email || '—'}
          </p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Stats */}
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-white/70">{row.label}</span>
            <span className="text-white font-semibold">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Ouvrir */}
      <div className="mt-2 flex justify-end">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="!bg-white !text-black !border-0 pointer-events-none"
        >
          <span>
            <span style={{ fontFamily: 'var(--font-barlow), sans-serif', fontWeight: 600, fontSize: 13 }}>
              Ouvrir
            </span>
            <ChevronRight size={12} />
          </span>
        </Button>
      </div>
    </Link>
  );
}
