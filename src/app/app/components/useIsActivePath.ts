'use client';

import { usePathname } from 'next/navigation';

function matchesPath(pathname: string, target: string) {
  if (!target) return false;
  const normalized = target.endsWith('/') && target !== '/' ? target.slice(0, -1) : target;
  if (pathname === normalized) return true;
  return pathname.startsWith(`${normalized}/`);
}

export function useIsActivePath(target: string | string[]) {
  const pathname = usePathname() || '';
  if (Array.isArray(target)) {
    return target.some((t) => matchesPath(pathname, t));
  }
  return matchesPath(pathname, target);
}
