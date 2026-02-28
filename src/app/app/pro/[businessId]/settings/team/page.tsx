// src/app/app/pro/[businessId]/settings/team/page.tsx
'use client';

import { type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { sanitizeEuroInput } from '@/lib/money';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { PageHeader } from '../../../../components/PageHeader';
import {
  formatDate,
  canChangeRole,
  allowedRoles,
  canEditEmployeeProfile,
  canRemove,
  ROLE_LABELS,
  type BusinessRole,
  type Member,
} from '../hooks/types';
import { useTeamData } from '../hooks/useTeamData';
import { useInviteManagement } from '../hooks/useInviteManagement';
import { useMemberActions } from '../hooks/useMemberActions';

export default function BusinessTeamSettingsPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role as BusinessRole | undefined;

  const {
    invites,
    loading,
    error,
    currentUserId,
    actorMember,
    sortedMembers,
    load,
    redirectToLogin,
  } = useTeamData({ businessId });

  const canInvite = actorRole === 'OWNER' || actorRole === 'ADMIN';

  const {
    inviteDraft,
    setInviteDraft,
    inviteLoading,
    inviteError,
    inviteSuccess,
    lastInviteLink,
    copyInviteLink,
    onInviteSubmit,
    onRevokeInvite,
  } = useInviteManagement({ businessId, canInvite, load, redirectToLogin });

  const {
    roleModal,
    removeModal,
    setRemoveModal,
    employeeModal,
    setEmployeeModal,
    employeeDraft,
    setEmployeeDraft,
    actionLoading,
    actionError,
    setActionError,
    success,
    setSuccess,
    roleValueFor,
    onRoleChange,
    confirmRoleChange,
    cancelRoleChange,
    confirmRemoval,
    openEmployeeModal,
    saveEmployeeProfile,
  } = useMemberActions({ businessId, actorRole, currentUserId, load, redirectToLogin });

  return (
    <div className="space-y-5">
      <PageHeader
        backHref={`/app/pro/${businessId}/settings`}
        backLabel="Paramètres"
        title="Équipe"
        subtitle="Gère les membres et rôles pour l'entreprise."
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
          <form className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr,0.8fr,auto]" onSubmit={(e: FormEvent<HTMLFormElement>) => void onInviteSubmit(e)}>
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
              {inviteLoading ? 'Envoi…' : "Envoyer l'invitation"}
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
              onClick={() => void copyInviteLink(lastInviteLink)}
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
                        onClick={() => void copyInviteLink(inv.inviteLink!)}
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
                      onClick={() => void onRevokeInvite(inv.id)}
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
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Réessayer
            </Button>
          </div>
        ) : sortedMembers.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun membre trouvé.</p>
        ) : (
          <div className="space-y-2">
            {sortedMembers.map((member: Member) => {
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
                        {member.employeeProfile.jobTitle}{' '}
                        {member.employeeProfile.contractType ? `· ${member.employeeProfile.contractType}` : ''}
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
            <Button onClick={() => void confirmRoleChange()} disabled={actionLoading}>
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
            Action immédiate. Utilise &quot;Quitter&quot; côté membre pour te retirer toi-même.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoveModal(null)} disabled={actionLoading}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => void confirmRemoval()} disabled={actionLoading}>
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
                  setEmployeeDraft((prev) => ({
                    ...prev,
                    weeklyHours: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Coût horaire (€)</span>
              <input
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                value={employeeDraft.hourlyCostCents ?? ''}
                onChange={(e) =>
                  setEmployeeDraft((prev) => ({
                    ...prev,
                    hourlyCostCents: sanitizeEuroInput(e.target.value) || '',
                  }))
                }
                disabled={actionLoading}
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="block text-xs text-[var(--text-secondary)]">Statut</span>
              <Select
                value={employeeDraft.status}
                onChange={(e) =>
                  setEmployeeDraft((prev) => ({
                    ...prev,
                    status: e.target.value as 'ACTIVE' | 'INACTIVE',
                  }))
                }
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
            <Button onClick={() => void saveEmployeeProfile()} disabled={actionLoading}>
              {actionLoading ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
