'use client';

import Link from 'next/link';
import { ChevronRight, TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

/* ═══ Design Tokens (brand colors — same light/dark) ═══ */

export const FIGMA = {
  rose: 'var(--shell-accent)',
  roseDark: 'var(--shell-accent-dark)',
  rosePink: '#FF808B',
} as const;

/* ═══ Format Helpers ═══ */

export function fmtKpi(cents: string | number | null | undefined): string {
  if (!cents) return '0 €';
  const n = Number(cents);
  if (!Number.isFinite(n)) return '0 €';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n / 100);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ═══ KPI Card ═══ */

export function FigmaKpiCard({
  label,
  value,
  badge,
  loading,
  hasArrow,
  delay = 0,
}: {
  label: string;
  value: string;
  badge?: string;
  loading?: boolean;
  hasArrow?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="flex flex-col justify-between p-3 rounded-xl animate-fade-in-up"
      style={{
        height: 200,
        background: 'var(--surface)',
        outline: '0.5px solid var(--border)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {label}
        </span>
        {badge && <FigmaBadge text={badge} />}
      </div>
      <div>
        {loading ? (
          <div
            className="h-10 w-32 rounded-lg animate-skeleton-pulse"
            style={{ background: 'var(--surface-2)' }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              style={{
                color: 'var(--shell-accent)',
                fontSize: 40,
                fontWeight: 800,
                lineHeight: '40px',
              }}
            >
              {value}
            </span>
            {hasArrow && <ChevronRight size={24} style={{ color: 'var(--shell-accent)' }} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Badge (+11%) ═══ */

export function FigmaBadge({ text, down }: { text: string; down?: boolean }) {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2 rounded-xl"
      style={{ background: 'var(--shell-accent-dark)' }}
    >
      <span
        className="text-white font-bold"
        style={{
          fontFamily: 'var(--font-roboto-mono), monospace',
          fontSize: 18,
          lineHeight: '18px',
        }}
      >
        {text}
      </span>
      {down ? (
        <TrendingDown size={18} className="text-white" />
      ) : (
        <TrendingUp size={18} className="text-white" />
      )}
    </div>
  );
}

/* ═══ Space Card (Home) ═══ */

export function FigmaSpaceCard({
  icon,
  title,
  buttonLabel,
  href,
  amount,
  loading,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  buttonLabel: string;
  href: string;
  amount: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="flex flex-col justify-between p-3 rounded-xl animate-fade-in-up"
      style={{
        height: 200,
        background: 'var(--shell-accent)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/30">
          {icon}
        </div>
        <span className="text-white text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <FigmaButton href={href}>
          {buttonLabel}
          <ChevronRight size={14} />
        </FigmaButton>
        {loading ? (
          <div
            className="h-6 w-20 rounded-lg animate-skeleton-pulse"
            style={{ background: 'rgba(255,255,255,0.3)' }}
          />
        ) : (
          <span className="text-white text-xl font-extrabold shrink-0">
            {amount}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══ Business Card (Pro) ═══ */

export function FigmaBusinessCard({
  name,
  stats,
  href,
  delay = 0,
}: {
  name: string;
  stats: { ca: string; salaries: number; clients: number };
  href: string;
  delay?: number;
}) {
  return (
    <div
      className="flex-1 min-w-[240px] max-w-[300px] p-3 rounded-xl flex flex-col justify-between animate-fade-in-up"
      style={{
        height: 200,
        background: 'var(--shell-accent)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg" style={{ background: 'var(--shell-accent-dark)' }} />
          <span className="text-white text-sm font-medium">{name}</span>
        </div>
        <button
          className="p-2 rounded-xl hover:opacity-90 transition-opacity"
          style={{ background: 'var(--surface)' }}
          aria-label="Options"
        >
          <MoreHorizontal size={12} style={{ color: 'var(--text)' }} />
        </button>
      </div>
      <div className="space-y-1">
        <StatRow label="CA" value={stats.ca} />
        <StatRow label="Membres" value={String(stats.salaries)} />
        <StatRow label="Clients" value={String(stats.clients)} />
        <div className="pt-2">
          <FigmaButton href={href}>
            Ouvrir
            <ChevronRight size={14} />
          </FigmaButton>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white text-sm font-medium">{label}</span>
      <span className="text-white text-xs font-extrabold">{value}</span>
    </div>
  );
}

/* ═══ Button (Barlow Condensed) ═══ */

export function FigmaButton({
  children,
  href,
  onClick,
  variant = 'white',
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'white' | 'cream';
}) {
  const cls =
    'inline-flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold hover:opacity-90 transition-opacity';
  const style = {
    background: variant === 'cream' ? 'var(--shell-sidebar-text)' : 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'var(--font-barlow), sans-serif',
    fontSize: 18,
    lineHeight: '18px',
  };

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

/* ═══ Time Filter Pills ═══ */

export function FigmaTimeFilters({
  active,
  onChange,
}: {
  active: string;
  onChange: (v: string) => void;
}) {
  const options = ['30 jours', '60 jours', '90 jours', '6 mois', '12 mois'];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="px-3 py-2 text-sm font-medium transition-colors"
          style={{
            background: active === opt ? 'var(--shell-accent-dark)' : 'var(--surface)',
            color: active === opt ? 'white' : 'var(--text-faint)',
            borderRadius: active === opt ? 12 : 100,
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/* ═══ Donut Chart (data-driven) ═══ */

export function FigmaDonut({
  segments,
  centerLabel,
  centerValue,
  size = 220,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let cumPct = 0;
  const gradientParts: string[] = [];
  for (const seg of segments) {
    const pct = (seg.value / total) * 100;
    gradientParts.push(`${seg.color} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  }
  if (cumPct < 100) {
    gradientParts.push(`var(--surface) ${cumPct}% 100%`);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="rounded-full relative flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${gradientParts.join(', ')})`,
        }}
      >
        <div
          className="rounded-full flex items-center justify-center flex-col"
          style={{
            width: size * 0.65,
            height: size * 0.65,
            background: 'var(--shell-accent)',
          }}
        >
          {centerValue && (
            <span className="text-white font-extrabold" style={{ fontSize: 38 }}>
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-white text-xs">{centerLabel}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs flex-wrap justify-center" style={{ color: 'var(--text-faint)' }}>
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full" style={{ background: seg.color }} />
            <span>{seg.label} ({seg.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ Progress Bar ═══ */

export function FigmaProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color || 'var(--shell-accent)' }}
      />
    </div>
  );
}

/* ═══ Section Title ═══ */

export function FigmaSectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2
        style={{
          color: 'var(--text)',
          fontSize: 18,
          fontWeight: 600,
          fontFamily: 'var(--font-barlow), sans-serif',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ═══ Data List Row ═══ */

export function FigmaListRow({
  left,
  right,
  sub,
  href,
}: {
  left: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between py-3 px-1 gap-4">
      <div className="flex-1 min-w-0">
        <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{left}</div>
        {sub && <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)]">
        {inner}
      </Link>
    );
  }

  return <div className="border-b border-[var(--border)]">{inner}</div>;
}

/* ═══ Status Pill ═══ */

export function FigmaStatusPill({ status, label }: { status: 'success' | 'warning' | 'danger' | 'neutral'; label: string }) {
  const colors = {
    success: { bg: '#dcfce7', text: '#166534' },
    warning: { bg: '#fef9c3', text: '#854d0e' },
    danger: { bg: '#fee2e2', text: '#991b1b' },
    neutral: { bg: 'var(--surface-2)', text: 'var(--text)' },
  };
  const c = colors[status];
  return (
    <span
      className="px-2 py-1 rounded-md text-xs font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {label}
    </span>
  );
}

/* ═══ Empty State ═══ */

export function FigmaEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm" style={{ color: 'var(--text-faint)' }}>
      {message}
    </div>
  );
}
