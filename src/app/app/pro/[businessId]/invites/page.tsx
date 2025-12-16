// src/app/app/pro/[businessId]/invites/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type Invite = {
  id: string;
  businessId: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  inviteLink?: string;
};

type InviteListResponse = {
  items: Invite[];
};

export default function InvitesPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  function formatDate(value: string | null) {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
    } catch {
      return value;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetchJson<InviteListResponse>(
          `/api/pro/businesses/${businessId}/invites`,
          {},
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }

        if (!res.ok || !res.data) {
          setError(
            res.requestId
              ? `${res.error ?? 'Impossible de charger les invitations.'} (Ref: ${res.requestId})`
              : res.error ?? 'Impossible de charger les invitations.'
          );
          setInvites([]);
          return;
        }

        setInvites(res.data.items);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId]);

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Invitations — admin
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Inviter des membres</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Lecture seule pour l’instant. Création/révocation disponibles via l’API existante.
        </p>
        {/* TODO: ajouter formulaire POST /api/pro/businesses/{businessId}/invites et actions DELETE */}
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des invitations…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => router.refresh()}>
              Réessayer
            </Button>
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Aucune invitation en cours. Utilise l’API ou ajoute un formulaire plus tard.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{invite.email}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    Créée le {formatDate(invite.createdAt)} · Expire le {formatDate(invite.expiresAt)}
                  </p>
                  {invite.inviteLink ? (
                    <p className="text-[10px] text-[var(--accent)] break-all">{invite.inviteLink}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{invite.role}</Badge>
                  <Badge variant="neutral">{invite.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
