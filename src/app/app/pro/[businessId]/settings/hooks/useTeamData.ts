import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import type { Member, MeResponse, MembersResponse, InviteItem, InvitesResponse } from './types';

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseTeamDataOptions = {
  businessId: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTeamData({ businessId }: UseTeamDataOptions) {
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const currentUserId = me?.id ?? null;

  const actorMember = useMemo(
    () => members.find((m) => m.userId === currentUserId),
    [currentUserId, members]
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.email.localeCompare(b.email)),
    [members]
  );

  const redirectToLogin = useCallback(() => {
    const from = window.location.pathname + window.location.search;
    window.location.href = `/login?from=${encodeURIComponent(from)}`;
  }, []);

  const load = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const [meRes, membersRes, invitesRes] = await Promise.all([
        fetchJson<MeResponse>('/api/auth/me', {}, controller.signal),
        fetchJson<MembersResponse>(`/api/pro/businesses/${businessId}/members`, {}, controller.signal),
        fetchJson<InvitesResponse>(`/api/pro/businesses/${businessId}/invites`, {}, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      if (meRes.status === 401 || membersRes.status === 401 || invitesRes.status === 401) {
        redirectToLogin();
        return;
      }

      if (!meRes.ok || !membersRes.ok || !invitesRes.ok || !meRes.data || !membersRes.data || !invitesRes.data) {
        const ref = meRes.requestId ?? membersRes.requestId ?? invitesRes.requestId;
        const msg =
          meRes.error || membersRes.error || invitesRes.error || 'Impossible de charger les membres ou invitations.';
        setError(ref ? `${msg} (Ref: ${ref})` : msg);
        setMembers([]);
        setInvites([]);
        return;
      }

      setMe(meRes.data.user);
      setMembers(membersRes.data.items);
      setInvites(invitesRes.data.items ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
      setMembers([]);
      setInvites([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId, redirectToLogin]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return {
    members,
    setMembers,
    me,
    invites,
    loading,
    error,
    currentUserId,
    actorMember,
    sortedMembers,
    redirectToLogin,
    load,
  };
}
