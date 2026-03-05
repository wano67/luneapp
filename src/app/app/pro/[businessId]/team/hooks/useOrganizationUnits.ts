import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import type { OrganizationUnit, OrganizationUnitsResponse } from './types';

type UseOrganizationUnitsOptions = {
  businessId: string;
  redirectToLogin: () => void;
};

export function useOrganizationUnits({ businessId, redirectToLogin }: UseOrganizationUnitsOptions) {
  const [units, setUnits] = useState<OrganizationUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<OrganizationUnitsResponse>(
        `/api/pro/businesses/${businessId}/organization/units`,
        {},
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les pôles.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setUnits(res.data.items);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(getErrorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId, redirectToLogin]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  async function createUnit(name: string) {
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<{ item: OrganizationUnit }>(
        `/api/pro/businesses/${businessId}/organization/units`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },
      );
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok) {
        const msg = res.error ?? 'Impossible de créer le pôle.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setSuccess('Pôle créé.');
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function renameUnit(unitId: string, name: string) {
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson<{ item: OrganizationUnit }>(
        `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },
      );
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok) {
        const msg = res.error ?? 'Impossible de renommer le pôle.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setSuccess('Pôle renommé.');
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteUnit(unitId: string) {
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/organization/units/${unitId}`,
        { method: 'DELETE' },
      );
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok) {
        const msg = res.error ?? 'Impossible de supprimer le pôle.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setSuccess('Pôle supprimé.');
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function assignMemberToUnit(membershipId: string, unitId: string | null) {
    setActionLoading(true);
    setActionError(null);
    setSuccess(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/memberships/${membershipId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationUnitId: unitId }),
        },
      );
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok) {
        const msg = res.error ?? 'Impossible d\u2019assigner le membre.';
        setActionError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        return;
      }
      setSuccess('Membre assigné.');
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  return {
    units,
    loading,
    error,
    actionLoading,
    actionError,
    success,
    setActionError,
    setSuccess,
    load,
    createUnit,
    renameUnit,
    deleteUnit,
    assignMemberToUnit,
  };
}
