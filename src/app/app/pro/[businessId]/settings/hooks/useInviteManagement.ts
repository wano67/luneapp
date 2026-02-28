import { type FormEvent, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import type { BusinessRole, InviteItem } from './types';
import { isValidEmail } from './types';

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseInviteManagementOptions = {
  businessId: string;
  canInvite: boolean;
  load: () => Promise<void>;
  redirectToLogin: () => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInviteManagement({
  businessId,
  canInvite,
  load,
  redirectToLogin,
}: UseInviteManagementOptions) {
  const [inviteDraft, setInviteDraft] = useState<{ email: string; role: BusinessRole }>({
    email: '',
    role: 'MEMBER',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function copyInviteLink(link: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const el = document.createElement('textarea');
        el.value = link;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setInviteSuccess('Lien copié.');
    } catch (err) {
      console.error(err);
      setInviteError('Impossible de copier le lien.');
    }
  }

  async function onInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canInvite) {
      setInviteError("Tu n'as pas les droits pour inviter.");
      return;
    }
    const email = inviteDraft.email.trim().toLowerCase();
    if (!email) {
      setInviteError('Email requis.');
      return;
    }
    if (!isValidEmail(email)) {
      setInviteError('Email invalide.');
      return;
    }
    if (!inviteDraft.role) {
      setInviteError('Rôle requis.');
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetchJson<InviteItem>(
        `/api/pro/businesses/${businessId}/invites`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: inviteDraft.role }),
        }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok || !res.data) {
        setInviteError(
          res.requestId
            ? `${res.error ?? "Impossible d'envoyer l'invitation."} (Ref: ${res.requestId})`
            : res.error ?? "Impossible d'envoyer l'invitation."
        );
        return;
      }

      setInviteDraft({ email: '', role: 'MEMBER' });
      setInviteSuccess('Invitation envoyée.');
      setLastInviteLink(res.data.inviteLink ?? null);
      await load();
    } catch (err) {
      console.error(err);
      setInviteError(getErrorMessage(err));
    } finally {
      setInviteLoading(false);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    if (!canInvite) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/invites/${inviteId}`,
        { method: 'DELETE' }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok) {
        setInviteError(
          res.requestId
            ? `${res.error ?? "Impossible de révoquer l'invitation."} (Ref: ${res.requestId})`
            : res.error ?? "Impossible de révoquer l'invitation."
        );
        return;
      }

      setInviteSuccess('Invitation révoquée.');
      await load();
    } catch (err) {
      console.error(err);
      setInviteError(getErrorMessage(err));
    } finally {
      setInviteLoading(false);
    }
  }

  return {
    inviteDraft,
    setInviteDraft,
    inviteLoading,
    inviteError,
    inviteSuccess,
    lastInviteLink,
    copyInviteLink,
    onInviteSubmit,
    onRevokeInvite,
  };
}
