'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import { getFaviconUrl } from '@/lib/website';

type Props = {
  name: string;
  websiteUrl?: string | null;
  size?: number;
  className?: string;
};

export function FaviconAvatar({ name, websiteUrl, size = 32, className }: Props) {
  const [errored, setErrored] = useState(false);
  const favicon = useMemo(() => getFaviconUrl(websiteUrl), [websiteUrl]);
  const initials =
    name?.trim().split(/\s+/).map((part) => part[0] || '')?.join('').slice(0, 2).toUpperCase() ||
    '?';

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)] ${className ?? ''}`}
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden
    >
      {favicon && !errored ? (
        <img
          src={favicon}
          alt=""
          className="h-full w-full rounded-lg object-cover"
          onError={() => setErrored(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-xs font-semibold text-[var(--text-primary)]">{initials}</span>
      )}
    </span>
  );
}
