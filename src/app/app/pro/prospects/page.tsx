'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ACTIVE_KEY = 'activeProBusinessId';
const LAST_KEY = 'lastProBusinessId';

export default function ProspectsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let target = '/app/pro';
    try {
      const active = localStorage.getItem(ACTIVE_KEY);
      const last = localStorage.getItem(LAST_KEY);
      const businessId = active || last;
      if (businessId) {
        target = `/app/pro/${businessId}/prospects`;
      }
    } catch {
      // ignore storage issues
    }
    router.replace(target);
  }, [router]);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers le CRM…</div>;
}
