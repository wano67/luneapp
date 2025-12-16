'use client';

import { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/ui/section-header';
import { fetchJson } from '@/lib/apiClient';

type MeResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};

export function AccountHeader() {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const res = await fetchJson<MeResponse>('/api/auth/me', {}, controller.signal);
      if (!controller.signal.aborted && res.ok && res.data?.user) {
        setName(res.data.user.name ?? null);
        setEmail(res.data.user.email ?? null);
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <SectionHeader
      title={name ? `Compte — ${name}` : 'Compte'}
      description={email ?? 'Paramètres et informations du compte.'}
    />
  );
}
