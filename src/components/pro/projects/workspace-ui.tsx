"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

// ─── UI style constants ───────────────────────────────────────────────────────

export const UI = {
  page: 'mx-auto max-w-6xl space-y-6 px-4 py-6',
  section: 'rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm',
  sectionSoft: 'rounded-2xl border border-[var(--border)]/60 bg-[var(--surface-2)]/60 p-3',
  sectionTitle: 'text-sm font-semibold text-[var(--text-primary)]',
  sectionSubtitle: 'text-xs text-[var(--text-secondary)]',
  label: 'text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]',
  value: 'text-sm font-semibold text-[var(--text-primary)]',
};

// ─── Domain-neutral helpers ───────────────────────────────────────────────────

export function formatDate(value: string | null) {
  if (!value) return '\u2014';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '\u2014';
  }
}

export function formatTaskStatus(status: string) {
  if (status === 'DONE') return 'Terminée';
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'TODO') return 'À faire';
  return status || '\u2014';
}

export const STATUS_BADGE_STYLES: Record<string, string> = {
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  TODO: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function getStatusBadgeClasses(status: string) {
  return (
    STATUS_BADGE_STYLES[status] ??
    'border-[var(--border)]/60 bg-[var(--surface-2)] text-[var(--text-secondary)]'
  );
}

export function getInitials(name?: string | null, email?: string | null) {
  const base = name?.trim() || email?.split('@')[0]?.trim() || '';
  if (!base) return '??';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

// ─── Payment method labels ────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  WIRE: 'Virement',
  CARD: 'Carte',
  CHECK: 'Chèque',
  CASH: 'Espèces',
  OTHER: 'Autre',
};

// ─── Small UI components ──────────────────────────────────────────────────────

export function InitialsAvatar({
  name,
  email,
  size = 28,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const initials = getInitials(name, email);
  return (
    <span
      className="flex items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]"
      style={{ width: size, height: size }}
      aria-label={name ?? email ?? 'Utilisateur'}
    >
      {initials}
    </span>
  );
}

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn(UI.section, className)}>{children}</Card>;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className={UI.sectionTitle}>{title}</p>
        {subtitle ? <p className={UI.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  highlight,
  align = 'left',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        UI.sectionSoft,
        align === 'right' ? 'text-right' : 'text-left',
        highlight ? 'border-[var(--accent-strong)]/40 bg-[var(--surface)]' : ''
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{label}</p>
      <p className={cn('text-lg font-semibold text-[var(--text-primary)]', highlight ? 'text-xl' : '')}>{value}</p>
    </div>
  );
}

export function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span className="font-semibold uppercase tracking-[0.14em]">{label}</span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export type MenuItem = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  newTab?: boolean;
  tone?: 'default' | 'danger';
};

export function KebabMenu({ items, ariaLabel }: { items: MenuItem[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={ariaLabel ?? 'Actions'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)]/70 bg-[var(--surface-2)]/70 text-base text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
      >
        &#8942;
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 min-w-[180px] rounded-xl border border-[var(--border)]/70 bg-[var(--surface)] p-1 shadow-lg"
        >
          {items
            .filter(Boolean)
            .map((item) => {
              const baseClass = item.disabled
                ? 'cursor-not-allowed text-[var(--text-secondary)] opacity-70'
                : 'text-[var(--text-primary)] hover:bg-[var(--surface-2)]';
              const toneClass = item.tone === 'danger' ? 'text-rose-500' : '';
              const cls = `flex w-full items-center justify-start rounded-lg px-3 py-2 text-sm ${baseClass} ${toneClass}`;

              if (item.href) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noreferrer' : undefined}
                    className={cls}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                );
              }

              return (
                <button
                  key={item.label}
                  type="button"
                  className={cls}
                  onClick={() => {
                    if (item.disabled) return;
                    setOpen(false);
                    item.onClick?.();
                  }}
                  disabled={item.disabled}
                >
                  {item.label}
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}

export function MetaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function StickyHeaderActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-3 z-10 -mx-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--surface)]/90 px-3 py-2 shadow-sm backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none">
      {children}
    </div>
  );
}
