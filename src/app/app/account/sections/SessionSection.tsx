'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function SessionSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      try {
        localStorage.removeItem('activeProBusinessId');
        localStorage.removeItem('lastProBusinessId');
      } catch { /* ignore */ }
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Session</p>
        <p className="text-sm text-[var(--text-secondary)]">Gérez votre session active. La déconnexion vous redirigera vers la page de connexion.</p>
      </div>
      <Button variant="danger" onClick={handleLogout} disabled={loading}>
        {loading ? 'Déconnexion…' : 'Se déconnecter'}
      </Button>
    </Card>
  );
}
