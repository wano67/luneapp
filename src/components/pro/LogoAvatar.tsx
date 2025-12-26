'use client';

import { useMemo, useState } from 'react';
import { normalizeWebsiteUrl } from '@/lib/website';

type Props = {
  name: string;
  websiteUrl?: string | null;
  size?: number;
  className?: string;
};

/**
 * Unified logo avatar for PRO surfaces.
 * Always use /api/logo, square container, object-contain, and fall back to initials.
 * We also drop banners (very wide images) to avoid distorted avatars.
 */
export function LogoAvatar({ name, websiteUrl, size = 40, className }: Props) {
  const [errored, setErrored] = useState(false);
  const [invalidRatio, setInvalidRatio] = useState(false);
  const normalized = useMemo(() => normalizeWebsiteUrl(websiteUrl).value, [websiteUrl]);
  const src = normalized ? `/api/logo?url=${encodeURIComponent(normalized)}` : null;
  const initials =
    name?.trim().split(/\s+/).map((part) => part[0] || '')?.join('').slice(0, 2).toUpperCase() ||
    '??';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] ${className ?? ''}`}
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden
    >
      {src && !errored && !invalidRatio ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-xl object-contain p-1"
          width={size}
          height={size}
          loading="lazy"
          onError={() => setErrored(true)}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (!naturalWidth || !naturalHeight) return;
            const ratio = naturalWidth / naturalHeight;
            if (ratio > 2 || ratio < 0.5) setInvalidRatio(true);
          }}
        />
      ) : (
        <span className="text-xs font-semibold text-[var(--text-primary)]">{initials}</span>
      )}
    </span>
  );
}
