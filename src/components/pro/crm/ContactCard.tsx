import Link from 'next/link';
import { LogoAvatar } from '@/components/pro/LogoAvatar';
import { normalizeWebsiteUrl } from '@/lib/website';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { cn } from '@/lib/cn';
import { ArrowRight } from 'lucide-react';

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
  status: 'active' | 'inactive' | 'neutral';
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

const STATUS_BORDER: Record<Props['status'], string> = {
  active: 'border border-emerald-400/80',
  inactive: 'border border-rose-400/80',
  neutral: 'border border-[var(--border)]/60',
};

export function ContactCard({ href, contact, stats, status }: Props) {
  const normalized = normalizeWebsiteUrl(contact.websiteUrl).value;

  const rows = [
    { label: 'Projets', value: stats?.projects ?? 0 },
    { label: 'En cours', value: stats?.active ?? 0 },
    { label: 'Valeur', value: formatCurrencyEUR(stats?.valueCents) },
    { label: 'Dernière', value: formatDate(contact.lastContactAt ?? stats?.lastInteraction) },
  ];

  return (
    <Link
      href={href}
      className={cn(
        'group card-interactive relative block min-h-[220px] rounded-3xl bg-[var(--surface)] p-4 pb-14 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]',
        STATUS_BORDER[status],
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <LogoAvatar name={contact.name || contact.company || 'Contact'} websiteUrl={normalized ?? undefined} size={48} />
          <div className="min-w-0 space-y-1">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {contact.name || 'Sans nom'}
            </p>
            {contact.company ? (
              <p className="truncate text-[12px] text-[var(--text-secondary)]">{contact.company}</p>
            ) : null}
            {contact.email ? (
              <p className="truncate text-[12px] text-[var(--text-secondary)]">{contact.email}</p>
            ) : null}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-3 text-[13px] text-[var(--text-secondary)] sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span>{row.label}</span>
              <span className="text-[var(--text-primary)] font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-5 right-5">
        <ArrowRight
          strokeWidth={2.75}
          className="text-[var(--text-secondary)] transition group-hover:translate-x-1 group-hover:text-[var(--text-primary)]"
        />
      </div>
    </Link>
  );
}
