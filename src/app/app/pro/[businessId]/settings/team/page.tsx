// src/app/app/pro/[businessId]/settings/team/page.tsx
'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { PageHeader } from '../../../../components/PageHeader';

type BusinessRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
type BusinessPermission = 'TEAM_EDIT' | 'FINANCE_EDIT';
type BusinessInviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

type EmployeeProfile = {
  id?: string;
  jobTitle: string | null;
  contractType: string | null;
  startDate: string | null;
  endDate: string | null;
  weeklyHours: number | null;
  hourlyCostCents: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Member = {
  userId: string;
  email: string;
  role: BusinessRole;
  createdAt: string;
  employeeProfile: EmployeeProfile | null;
  permissions: BusinessPermission[];
};

type MembersResponse = {
  items: Member[];
};

type MeResponse = {
  user: {
    id: string;
    email: string;
  };
};

type InviteItem = {
  id: string;
  email: string;
  role: BusinessRole;
  status: BusinessInviteStatus;
  createdAt: string;
  expiresAt: string | null;
  inviteLink?: string;
  tokenPreview?: string;
};

type InvitesResponse = {
  items: InviteItem[];
};

const ROLE_LABELS: Record<BusinessRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function canChangeRole(
  actorRole: BusinessRole | null | undefined,
  target: Member,
  currentUserId: string | null
) {
  if (!actorRole) return false;
  if (target.userId === currentUserId) return false;
  if (target.role === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER');
}

function allowedRoles(actorRole: BusinessRole | null | undefined, target: Member): BusinessRole[] {
  if (actorRole === 'OWNER') return ['ADMIN', 'MEMBER', 'VIEWER'];
  if (actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER')) {
    return ['MEMBER', 'VIEWER'];
  }
  return [];
}

function canEditEmployeeProfile(
  actorRole: BusinessRole | null | undefined,
  actorPermissions: BusinessPermission[] | undefined,
  target: Member
) {
  const hasFlag = actorPermissions?.includes('TEAM_EDIT');
  if (actorRole === 'OWNER' || actorRole === 'ADMIN') return true;
  if (hasFlag && target.role !== 'OWNER') return true;
  return false;
}

function canRemove(
  actorRole: BusinessRole | null | undefined,
  target: Member,
  currentUserId: string | null
) {
  if (!actorRole) return false;
  if (target.userId === currentUserId) return false;
  if (target.role === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return actorRole === 'ADMIN' && (target.role === 'MEMBER' || target.role === 'VIEWER');
}

export default function BusinessTeamSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role as BusinessRole | undefined;

  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, BusinessRole>>({});
  const [roleModal, setRoleModal] = useState<{ member: Member; nextRole: BusinessRole } | null>(null);
  const [removeModal, setRemoveModal] = useState<Member | null>(null);
  const [employeeModal, setEmployeeModal] = useState<Member | null>(null);
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeProfile>({
    jobTitle: '',
    contractType: '',
    startDate: '',
    endDate: '',
    weeklyHours: null,
    hourlyCostCents: '',
    status: 'ACTIVE',
    notes: '',
  });
  const [actionLoading, setActionLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [inviteDraft, setInviteDraft] = useState<{ email: string; role: BusinessRole }>({
    email: '',
    role: 'MEMBER',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

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
      setRoleDrafts({});
      setLastInviteLink(null);
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

  const canInvite = actorRole === 'OWNER' || actorRole === 'ADMIN';

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
      setInviteError("Impossible de copier le lien.");
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

  function onRoleChange(member: Member, value: string) {
    if (!isValidRole(value)) return;
    if (!canChangeRole(actorRole, member, currentUserId)) return;
    setRoleDrafts((prev) => ({ ...prev, [member.userId]: value }));
    setRoleModal({ member, nextRole: value });
    setActionError(null);
    setSuccess(null);
  }

  async function confirmRoleChange() {
    if (!roleModal) return;
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<Member>(
        `/api/pro/businesses/${businessId}/members/${roleModal.member.userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: roleModal.nextRole }),
        }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok || !res.data) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Impossible de modifier le rôle.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de modifier le rôle.'
        );
        return;
      }

      setSuccess('Rôle mis à jour.');
      await load();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
      setRoleModal(null);
      setRoleDrafts((prev) => {
        const copy = { ...prev };
        delete copy[roleModal.member.userId];
        return copy;
      });
    }
  }

  function cancelRoleChange() {
    if (roleModal) {
      setRoleDrafts((prev) => {
        const copy = { ...prev };
        delete copy[roleModal.member.userId];
        return copy;
      });
    }
    setRoleModal(null);
  }

  async function confirmRemoval() {
    if (!removeModal) return;
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/members/${removeModal.userId}`,
        {
          method: 'DELETE',
        }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Impossible de retirer ce membre.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de retirer ce membre.'
        );
        return;
      }

      setSuccess('Membre retiré.');
      await load();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
      setRemoveModal(null);
    }
  }

  const roleValueFor = (member: Member) => roleDrafts[member.userId] ?? member.role;

  const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');

  function openEmployeeModal(member: Member) {
    setEmployeeModal(member);
    setEmployeeDraft({
      jobTitle: member.employeeProfile?.jobTitle ?? '',
      contractType: member.employeeProfile?.contractType ?? '',
      startDate: toDateInput(member.employeeProfile?.startDate),
      endDate: toDateInput(member.employeeProfile?.endDate),
      weeklyHours:
        typeof member.employeeProfile?.weeklyHours === 'number' ? member.employeeProfile.weeklyHours : null,
      hourlyCostCents: member.employeeProfile?.hourlyCostCents ?? '',
      status: member.employeeProfile?.status ?? 'ACTIVE',
      notes: member.employeeProfile?.notes ?? '',
    });
    setActionError(null);
    setSuccess(null);
  }

  async function saveEmployeeProfile() {
    if (!employeeModal) return;
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<{ member: Member }>(
        `/api/pro/businesses/${businessId}/members/${employeeModal.userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeProfile: {
              jobTitle: employeeDraft.jobTitle || null,
              contractType: employeeDraft.contractType || null,
              startDate: employeeDraft.startDate || null,
              endDate: employeeDraft.endDate || null,
              weeklyHours: employeeDraft.weeklyHours,
              hourlyCostCents: employeeDraft.hourlyCostCents || null,
              status: employeeDraft.status,
              notes: employeeDraft.notes || null,
            },
          }),
        }
      );

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok || !res.data) {
        setActionError(
          res.requestId
            ? `${res.error ?? 'Impossible de sauvegarder le profil employé.'} (Ref: ${res.requestId})`
            : res.error ?? 'Impossible de sauvegarder le profil employé.'
        );
        return;
      }

      setSuccess('Profil employé mis à jour.');
      await load();
    } catch (err) {
      console.error(err);
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
      setEmployeeModal(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Équipe"
        subtitle="Gère les membres et rôles pour l’entreprise."
      />

      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Inviter un collaborateur</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Les invitations expirent au bout de 7 jours. Rôles autorisés : Admin, Member, Viewer.
            </p>
          </div>
          {inviteError ? <p className="text-xs text-rose-500">{inviteError}</p> : null}
          {inviteSuccess ? <p className="text-xs text-emerald-500">{inviteSuccess}</p> : null}
        </div>

        {!canInvite ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Seuls les Owner/Admin peuvent inviter de nouveaux collaborateurs.
          </p>
        ) : (
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr,0.8fr,auto]" onSubmit={onInviteSubmit}>
            <Input
              type="email"
              placeholder="email@exemple.com"
              value={inviteDraft.email}
              onChange={(e) => setInviteDraft((prev) => ({ ...prev, email: e.target.value }))}
              disabled={inviteLoading}
              required
            />
            <Select
              value={inviteDraft.role}
              onChange={(e) => setInviteDraft((prev) => ({ ...prev, role: e.target.value as BusinessRole }))}
              disabled={inviteLoading}
              required
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
            </Select>
            <Button type="submit" disabled={inviteLoading}>
              {inviteLoading ? 'Envoi…' : 'Envoyer l’invitation'}
            </Button>
          </form>
        )}

        {lastInviteLink ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <p>Lien généré :</p>
            <code className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px]">
              /app/invites/accept?token=…
            </code>
            <Button
              size="sm"
              variant="outline"
              disabled={inviteLoading}
              onClick={() => copyInviteLink(lastInviteLink)}
            >
              Copier le lien
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Invitations en attente</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Révoque une invitation pour la rendre invalide immédiatement.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des invitations…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucune invitation active.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{inv.email}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{ROLE_LABELS[inv.role]}</Badge>
                    <Badge
                      variant={
                        inv.status === 'PENDING'
                          ? 'neutral'
                          : inv.status === 'ACCEPTED'
                            ? 'personal'
                            : 'performance'
                      }
                    >
                      {inv.status === 'PENDING'
                        ? 'En attente'
                        : inv.status === 'ACCEPTED'
                          ? 'Acceptée'
                          : inv.status === 'EXPIRED'
                            ? 'Expirée'
                            : 'Révoquée'}
                    </Badge>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Envoyée le {formatDate(inv.createdAt)}
                    </p>
                    {inv.expiresAt ? (
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Expire le {formatDate(inv.expiresAt)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {inv.inviteLink ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={inv.status !== 'PENDING'}
                        onClick={() => copyInviteLink(inv.inviteLink!)}
                      >
                        Copier le lien
                      </Button>
                      <a
                        className="text-xs text-[var(--accent-strong)] underline"
                        href={inv.inviteLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ouvrir
                      </a>
                    </>
                  ) : (
                    <Badge variant="neutral">Lien indisponible</Badge>
                  )}
                  {inv.status === 'PENDING' && canInvite ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={inviteLoading}
                      onClick={() => onRevokeInvite(inv.id)}
                    >
                      Révoquer
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Membres</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Seuls les Admin/Owner peuvent modifier les rôles ou retirer un membre.
            </p>
          </div>
          {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
          {success ? <p className="text-xs text-emerald-500">{success}</p> : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des membres…</p>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-400">{error}</p>
            <Button size="sm" variant="outline" onClick={() => load()}>
              Réessayer
            </Button>
          </div>
        ) : sortedMembers.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun membre trouvé.</p>
        ) : (
          <div className="space-y-2">
            {sortedMembers.map((member) => {
              const canEdit = canChangeRole(actorRole, member, currentUserId);
              const canDelete = canRemove(actorRole, member, currentUserId);
              const options = allowedRoles(actorRole, member);

              return (
                <div
                  key={member.userId}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{member.email}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        Ajouté le {formatDate(member.createdAt)}
                      </p>
                      {member.employeeProfile ? (
                        <Badge variant="neutral" className="border border-[var(--border)]">
                          {member.employeeProfile.status === 'ACTIVE' ? 'Employé actif' : 'Inactif'}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" className="border border-[var(--border)]">
                          Aucun profil employé
                        </Badge>
                      )}
                    </div>
                    {member.employeeProfile?.jobTitle ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        {member.employeeProfile.jobTitle} {member.employeeProfile.contractType ? `· ${member.employeeProfile.contractType}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={roleValueFor(member)}
                        onChange={(e) => onRoleChange(member, e.target.value)}
                        disabled={actionLoading}
                      >
                        {options.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant="neutral">{member.role}</Badge>
                    )}
                    {member.userId === currentUserId ? (
                      <Badge variant="neutral" className="bg-[var(--surface-2)]">
                        Toi
                      </Badge>
                    ) : null}
                    {canEditEmployeeProfile(actorRole, actorMember?.permissions, member) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => openEmployeeModal(member)}
                      >
                        Profil employé
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => {
                          setRemoveModal(member);
                          setActionError(null);
                          setSuccess(null);
                        }}
                      >
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={!!roleModal}
        onCloseAction={actionLoading ? () => {} : cancelRoleChange}
        title="Confirmer le changement de rôle"
        description={
          roleModal
            ? `Passer ${roleModal.member.email} en ${ROLE_LABELS[roleModal.nextRole]} ?`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Les permissions changeront immédiatement. Tu ne peux pas modifier les owners ou ton propre rôle.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelRoleChange} disabled={actionLoading}>
              Annuler
            </Button>
            <Button onClick={confirmRoleChange} disabled={actionLoading}>
              {actionLoading ? 'Modification…' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!removeModal}
        onCloseAction={actionLoading ? () => {} : () => setRemoveModal(null)}
        title="Retirer ce membre ?"
        description={
          removeModal ? `${removeModal.email} sera retiré de cette entreprise.` : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Action immédiate. Utilise “Quitter” côté membre pour te retirer toi-même.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveModal(null)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmRemoval} disabled={actionLoading}>
              {actionLoading ? 'Retrait…' : 'Retirer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!employeeModal}
        onCloseAction={actionLoading ? () => {} : () => setEmployeeModal(null)}
        title="Profil employé"
        description={employeeModal ? `Profil de ${employeeModal.email}` : undefined}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Intitulé de poste</span>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.jobTitle ?? ''}
                onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, jobTitle: e.target.value }))}
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Type de contrat</span>
              <input
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.contractType ?? ''}
                onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, contractType: e.target.value }))}
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Date de début</span>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.startDate ?? ''}
                onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, startDate: e.target.value }))}
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Date de fin</span>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.endDate ?? ''}
                onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, endDate: e.target.value }))}
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Heures hebdo</span>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.weeklyHours ?? ''}
                onChange={(e) =>
                  setEmployeeDraft((prev) => ({ ...prev, weeklyHours: e.target.value ? Number(e.target.value) : null }))
                }
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Coût horaire (cents)</span>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.hourlyCostCents ?? ''}
                onChange={(e) =>
                  setEmployeeDraft((prev) => ({ ...prev, hourlyCostCents: e.target.value || '' }))
                }
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Statut</span>
              <Select
                value={employeeDraft.status}
                onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
                disabled={actionLoading}
              >
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
              </Select>
            </label>
          </div>
          <label className="text-sm text-[var(--text-primary)]">
            <span className="block text-xs text-[var(--text-secondary)]">Notes</span>
            <textarea
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
              rows={3}
              value={employeeDraft.notes ?? ''}
              onChange={(e) => setEmployeeDraft((prev) => ({ ...prev, notes: e.target.value }))}
              disabled={actionLoading}
            />
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEmployeeModal(null)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button onClick={saveEmployeeProfile} disabled={actionLoading}>
              {actionLoading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function isValidRole(role: string): role is BusinessRole {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
