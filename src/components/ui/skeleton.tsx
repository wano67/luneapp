import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
  /** Render a circle instead of a rectangle. */
  circle?: boolean;
  /** Fixed width (e.g. "80px", "6rem"). Defaults to full width. */
  width?: string;
  /** Fixed height (e.g. "16px"). Defaults to 16px. */
  height?: string;
};

/**
 * Animated placeholder shown while content is loading.
 * Uses a shimmer pulse animation that follows the design system.
 */
export function Skeleton({ className, circle, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-skeleton-pulse bg-[var(--surface-2)]',
        circle ? 'rounded-full' : 'rounded-xl',
        className
      )}
      style={{
        width: circle ? (width ?? height ?? '40px') : (width ?? '100%'),
        height: height ?? (circle ? (width ?? '40px') : '16px'),
      }}
      aria-hidden="true"
    />
  );
}

// ─── Preset layouts ──────────────────────────────────────────────────────────

type SkeletonCardProps = { className?: string };

/** Skeleton for a KPI card (label + value + delta). */
export function SkeletonKpiCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm',
        className
      )}
    >
      <Skeleton width="60%" height="14px" />
      <div className="mt-3">
        <Skeleton width="45%" height="28px" />
      </div>
      <div className="mt-3">
        <Skeleton width="30%" height="12px" />
      </div>
    </div>
  );
}

/** Skeleton for a table row. */
export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton width={i === 0 ? '70%' : '50%'} height="14px" />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for a full page (header + grid of KPIs + content). */
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton width="200px" height="24px" />
        <Skeleton width="300px" height="14px" />
      </div>
      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
      </div>
      {/* Content card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
        <Skeleton width="40%" height="18px" />
        <Skeleton height="14px" />
        <Skeleton height="14px" />
        <Skeleton width="80%" height="14px" />
      </div>
    </div>
  );
}
