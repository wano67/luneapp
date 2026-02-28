import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import type { OrganizationUnitItem } from '@/components/pro/projects/hooks/useProjectDataLoaders';

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseTeamManagementOptions = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  organizationUnits: OrganizationUnitItem[];
  loadMembers: () => Promise<void>;
  loadProjectMembers: () => Promise<void>;
  loadOrganizationUnits: () => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTeamManagement({
  businessId,
  projectId,
  isAdmin,
  organizationUnits,
  loadMembers,
  loadProjectMembers,
  loadOrganizationUnits,
}: UseTeamManagementOptions) {
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessInfo, setAccessInfo] = useState<string | null>(null);
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [unitErrors, setUnitErrors] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<string | null>(null);
  const [unitDraftName, setUnitDraftName] = useState('');
  const [unitDraftOrder, setUnitDraftOrder] = useState('0');
  const [unitDrafts, setUnitDrafts] = useState<Record<string, { name: string; order: string }>>({});

  // Load members when access modal opens
  useEffect(() => {
    if (!accessModalOpen) return;
    setAccessInfo(null); // eslint-disable-line react-hooks/set-state-in-effect
    void loadMembers();
    void loadProjectMembers();
  }, [accessModalOpen, loadMembers, loadProjectMembers]);

  // Load units + members when units modal opens
  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitErrors(null); // eslint-disable-line react-hooks/set-state-in-effect
    void loadOrganizationUnits();
    void loadMembers();
  }, [unitsModalOpen, loadOrganizationUnits, loadMembers]);

  // Populate unit drafts when organization units change
  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitDrafts( // eslint-disable-line react-hooks/set-state-in-effect
      organizationUnits.reduce<Record<string, { name: string; order: string }>>((acc, unit) => {
        acc[unit.id] = { name: unit.name, order: String(unit.order ?? 0) };
        return acc;
      }, {})
    );
  }, [organizationUnits, unitsModalOpen]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleAddProjectMember(membershipId: string) {
    if (!isAdmin) {
      setAccessInfo('Réservé aux admins/owners.');
      return;
    }
    setAccessInfo(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId }),
      }
    );
    if (!res.ok) {
      setAccessInfo(res.error ?? "Impossible d'ajouter l'accès.");
      return;
    }
    await loadProjectMembers();
    setAccessInfo('Accès mis à jour.');
  }

  async function handleRemoveProjectMember(membershipId: string) {
    if (!isAdmin) {
      setAccessInfo('Réservé aux admins/owners.');
      return;
    }
    setAccessInfo(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members/${membershipId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setAccessInfo(res.error ?? "Impossible de retirer l'accès.");
      return;
    }
    await loadProjectMembers();
    setAccessInfo('Accès mis à jour.');
  }

  async function handleCreateUnit() {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    const name = unitDraftName.trim();
    if (!name) {
      setUnitErrors('Nom requis.');
      return;
    }
    const order = unitDraftOrder.trim() === '' ? 0 : Number(unitDraftOrder);
    if (!Number.isFinite(order)) {
      setUnitErrors('Ordre invalide.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: Math.trunc(order) }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Création impossible.');
      return;
    }
    setUnitDraftName('');
    setUnitDraftOrder('0');
    await loadOrganizationUnits();
    setTeamInfo('Pôle créé.');
  }

  async function handleUpdateUnit(unitId: string) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    const draft = unitDrafts[unitId];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setUnitErrors('Nom requis.');
      return;
    }
    const order = draft.order.trim() === '' ? 0 : Number(draft.order);
    if (!Number.isFinite(order)) {
      setUnitErrors('Ordre invalide.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: Math.trunc(order) }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Mise à jour impossible.');
      return;
    }
    await loadOrganizationUnits();
    setTeamInfo('Pôle mis à jour.');
  }

  async function handleDeleteUnit(unitId: string) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Suppression impossible.');
      return;
    }
    await loadOrganizationUnits();
    setTeamInfo('Pôle supprimé.');
  }

  async function handleAssignMemberToUnit(membershipId: string, unitId: string | null) {
    if (!isAdmin) {
      setUnitErrors('Réservé aux admins/owners.');
      return;
    }
    setUnitErrors(null);
    const res = await fetchJson(
      `/api/pro/businesses/${businessId}/memberships/${membershipId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationUnitId: unitId }),
      }
    );
    if (!res.ok) {
      setUnitErrors(res.error ?? 'Assignation impossible.');
      return;
    }
    await loadMembers();
    await loadProjectMembers();
    setTeamInfo('Membre mis à jour.');
  }

  return {
    // State
    accessModalOpen,
    setAccessModalOpen,
    accessInfo,
    setAccessInfo,
    unitsModalOpen,
    setUnitsModalOpen,
    unitErrors,
    teamInfo,
    unitDraftName,
    setUnitDraftName,
    unitDraftOrder,
    setUnitDraftOrder,
    unitDrafts,
    setUnitDrafts,
    // Handlers
    handleAddProjectMember,
    handleRemoveProjectMember,
    handleCreateUnit,
    handleUpdateUnit,
    handleDeleteUnit,
    handleAssignMemberToUnit,
  };
}
