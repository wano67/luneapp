// src/app/app/invites/accept/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type AcceptResponse = {
  business: { id: string; name?: string; ownerId?: string; createdAt?: string; updatedAt?: string };
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = (searchParams?.get('token') || '').trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token manquant.');
    } else {
      void acceptInvite(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function acceptInvite(value: string) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<AcceptResponse>('/api/pro/businesses/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Invitation invalide ou expirée.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }

      setSuccess(`Tu as rejoint « ${res.data.business?.name ?? 'l’entreprise'} » en tant que ${res.data.role}.`);
      const businessId = res.data.business?.id;
      if (businessId) {
        setTimeout(() => {
          router.push(`/app/pro/${businessId}`);
        }, 800);
      }
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <Card className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Accepter une invitation</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Clique sur le lien d’invitation depuis ton email ou colle-le dans la barre d’adresse.
          </p>
        </div>

        {loading ? <p className="text-sm text-[var(--text-secondary)]">Validation…</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {success ? <p className="text-sm text-[var(--success)]">{success}</p> : null}

        {!token ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Le lien d’invitation est incomplet (token manquant). Vérifie l’URL ou demande un nouvel envoi.
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/app/pro')}
            disabled={loading}
          >
            Retour
          </Button>
        </div>
      </Card>
    </div>
  );
}
