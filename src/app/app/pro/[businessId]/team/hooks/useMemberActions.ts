import { useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';
import type { BusinessRole, EmployeeProfile, Member } from './types';
import { isValidRole } from './types';
import { canChangeRole } from './types';

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseMemberActionsOptions = {
  businessId: string;
  actorRole: BusinessRole | undefined;
  currentUserId: string | null;
  load: () => Promise<void>;
  redirectToLogin: () => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMemberActions({
  businessId,
  actorRole,
  currentUserId,
  load,
  redirectToLogin,
}: UseMemberActionsOptions) {
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────

  function roleValueFor(member: Member) {
    return roleDrafts[member.userId] ?? member.role;
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

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
        if (roleModal) delete copy[roleModal.member.userId];
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
        { method: 'DELETE' }
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

  function openEmployeeModal(member: Member) {
    const toDateInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : '');
    setEmployeeModal(member);
    setEmployeeDraft({
      jobTitle: member.employeeProfile?.jobTitle ?? '',
      contractType: member.employeeProfile?.contractType ?? '',
      startDate: toDateInput(member.employeeProfile?.startDate),
      endDate: toDateInput(member.employeeProfile?.endDate),
      weeklyHours:
        typeof member.employeeProfile?.weeklyHours === 'number' ? member.employeeProfile.weeklyHours : null,
      hourlyCostCents: formatCentsToEuroInput(member.employeeProfile?.hourlyCostCents),
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
      const hourlyCostCents = employeeDraft.hourlyCostCents
        ? parseEuroToCents(employeeDraft.hourlyCostCents)
        : null;
      if (employeeDraft.hourlyCostCents && !Number.isFinite(hourlyCostCents)) {
        setActionError('Coût horaire invalide.');
        return;
      }
      const res = await fetchJson(
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
              hourlyCostCents: Number.isFinite(hourlyCostCents ?? NaN) ? (hourlyCostCents as number) : null,
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

      if (!res.ok) {
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

  return {
    roleDrafts,
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
  };
}
