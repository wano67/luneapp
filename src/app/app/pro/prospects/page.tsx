'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIVE_KEY = 'activeProBusinessId';
const LAST_KEY = 'lastProBusinessId';

export default function ProspectsRedirectPage() {
  const router = useRouter();
  const [targetLabel, setTargetLabel] = useState('le CRM');

  useEffect(() => {
    let target = '/app/pro';
    let label = 'le CRM';
    try {
      const active = localStorage.getItem(ACTIVE_KEY);
      const last = localStorage.getItem(LAST_KEY);
      const businessId = active || last;
      if (businessId) {
        target = `/app/pro/${businessId}/prospects`;
        label = 'la liste des prospects';
      }
    } catch {
      // ignore storage issues
    }
    setTargetLabel(label);
    router.replace(target);
  }, [router]);

  return (
    <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers {targetLabel}…</div>
  );
}
