'use client';

import { useMemo, useState } from 'react';
import { getFaviconUrl, normalizeWebsiteUrl } from '@/lib/website';

type Props = {
  websiteUrl?: string | null;
  size?: number;
  alt?: string;
  className?: string;
  fallbackText?: string;
};

export function Favicon({ websiteUrl, size = 32, alt = '', className, fallbackText }: Props) {
  const [errored, setErrored] = useState(false);
  const normalized = useMemo(() => normalizeWebsiteUrl(websiteUrl).value, [websiteUrl]);
  const src = useMemo(() => getFaviconUrl(normalized), [normalized]);

  const fallback =
    fallbackText?.trim().slice(0, 2).toUpperCase() ||
    (normalized ? new URL(normalized).host.slice(0, 2).toUpperCase() : '?');

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] ${className ?? ''}`}
      style={{ width: size, height: size, minWidth: size }}
      aria-label={alt}
    >
      {src && !errored ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full rounded-lg object-cover"
          width={size}
          height={size}
          onError={() => setErrored(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-xs font-semibold text-[var(--text-primary)]">{fallback}</span>
      )}
    </span>
  );
}
