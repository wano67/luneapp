// src/app/app/pro/[businessId]/invites/page.tsx
'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';

type Invite = {
  id: string;
  businessId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string | null;
  inviteLink?: string;
};

type InviteListResponse = {
  items: Invite[];
};

type InviteCreateResponse = Invite;

const ROLE_LABELS: Record<Invite['role'], string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function formatError(message: string | undefined, requestId: string | null, fallback: string) {
  const base = message ?? fallback;
  return requestId ? `${base} (Ref: ${requestId})` : base;
}

export default function InvitesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = !!activeCtx?.isAdmin;

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; role: Invite['role'] }>({
    email: '',
    role: 'MEMBER',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchController = useRef<AbortController | null>(null);

  const redirectToLogin = useCallback(() => {
    const from = window.location.pathname + window.location.search;
    window.location.href = `/login?from=${encodeURIComponent(from)}`;
  }, []);

  const loadInvites = useCallback(async () => {
    const controller = new AbortController();
    fetchController.current?.abort();
    fetchController.current = controller;

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
        redirectToLogin();
        return;
      }

      if (!res.ok || !res.data) {
        setInvites([]);
        setError(formatError(res.error, res.requestId, 'Impossible de charger les invitations.'));
        return;
      }

      setInvites(res.data.items);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setInvites([]);
      setError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId, redirectToLogin]);

  useEffect(() => {
    void loadInvites();
    return () => fetchController.current?.abort();
  }, [loadInvites]);

  async function handleCreateInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setActionError(null);
    setSuccess(null);

    if (!isAdmin) {
      setFormError('Droits insuffisants pour inviter.');
      return;
    }

    const email = form.email.trim();
    if (!email) {
      setFormError("L'email est requis.");
      return;
    }

    try {
      setCreating(true);
      const res = await fetchJson<InviteCreateResponse>(`/api/pro/businesses/${businessId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: form.role }),
      });

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok || !res.data) {
        setFormError(formatError(res.error, res.requestId, 'Invitation impossible.'));
        return;
      }

      setSuccess('Invitation envoyée.');
      setForm({ email: '', role: form.role });
      await loadInvites();
    } catch (err) {
      console.error(err);
      setFormError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setActionError(null);
    setSuccess(null);

    if (!isAdmin) {
      setActionError('Droits insuffisants pour révoquer.');
      return;
    }

    try {
      setRevokingId(inviteId);
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/invites/${inviteId}`,
        { method: 'DELETE' }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok) {
        setActionError(formatError(res.error, res.requestId, 'Révocation impossible.'));
        return;
      }

      await loadInvites();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setRevokingId(null);
    }
  }

  const pendingInvites = invites.filter((inv) => inv.status === 'PENDING');
  const otherInvites = invites.filter((inv) => inv.status !== 'PENDING');

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Invitations — admin
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Inviter des membres</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Génère un lien pour rejoindre cette entreprise. Seuls les rôles Admin/Owner peuvent inviter.
        </p>

        {isAdmin ? (
          <form onSubmit={handleCreateInvite} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
              <Input
                label="Email du destinataire"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={creating}
                placeholder="collaborateur@exemple.com"
              />

              <Select
                label="Rôle"
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value as Invite['role'] }))}
                disabled={creating}
              >
                {Object.keys(ROLE_LABELS).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role as Invite['role']]}
                  </option>
                ))}
              </Select>

              <div className="flex justify-start md:justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Invitation…' : 'Inviter'}
                </Button>
              </div>
            </div>

            {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
            {success ? <p className="text-xs text-emerald-500">{success}</p> : null}
          </form>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            Tu dois être admin pour créer ou révoquer des invitations. Contacte un owner/admin de l’entreprise
            pour obtenir un lien.
          </p>
        )}
      </Card>

      <Card className="p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des invitations…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => loadInvites()}>
                Réessayer
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Invitations en attente ({pendingInvites.length})
              </p>
              {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
            </div>

            {invites.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Aucune invitation en cours. Ajoute un membre pour générer un lien.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvites.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune invitation en attente.</p>
                ) : (
                  pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{invite.email}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Créée le {formatDate(invite.createdAt)} · Expire le {formatDate(invite.expiresAt)}
                        </p>
                        {invite.inviteLink ? (
                          <p className="break-all text-[10px] text-[var(--accent)]">{invite.inviteLink}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral">{invite.role}</Badge>
                        <Badge variant="neutral">{invite.status}</Badge>
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevoke(invite.id)}
                            disabled={revokingId === invite.id}
                          >
                            {revokingId === invite.id ? 'Révocation…' : 'Révoquer'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}

                {otherInvites.length > 0 ? (
                  <div className="space-y-2 border-t border-[var(--border)] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
                      Historique
                    </p>
                    {otherInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex flex-col gap-1 rounded-xl border border-[var(--border)]/80 bg-[var(--surface-2)]/60 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{invite.email}</p>
                          <Badge variant="neutral">{invite.role}</Badge>
                          <Badge variant="neutral">{invite.status}</Badge>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Créée le {formatDate(invite.createdAt)} · Expiration {formatDate(invite.expiresAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
