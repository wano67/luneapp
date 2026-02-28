import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { parseEuroToCents } from '@/lib/money';

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceItem = {
  id: string;
  projectId: string;
  serviceId: string;
  priceCents: string | null;
  quantity: number;
  notes: string | null;
  titleOverride?: string | null;
  description?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  billingUnit?: string | null;
  unitLabel?: string | null;
  position?: number;
  service: { id: string; code: string; name: string; type: string | null };
};

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseServiceManagementOptions = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  services: ServiceItem[];
  setServices: (items: ServiceItem[]) => void;
  loadServices: () => Promise<void>;
  refetchAll: () => Promise<void>;
  patchProject: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string | undefined }>;
  loadProject: () => Promise<unknown>;
  projectPrestationsText: string | null | undefined;
  onBillingInfo: (msg: string | null) => void;
  onBillingError: (msg: string | null) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCents(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
}

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useServiceManagement({
  businessId,
  projectId,
  isAdmin,
  services,
  setServices,
  loadServices,
  refetchAll,
  patchProject,
  loadProject,
  projectPrestationsText,
  onBillingInfo,
  onBillingError,
}: UseServiceManagementOptions) {
  const [serviceDrafts, setServiceDrafts] = useState<
    Record<
      string,
      {
        quantity: string;
        price: string;
        title: string;
        description: string;
        discountType: string;
        discountValue: string;
        billingUnit: string;
        unitLabel: string;
      }
    >
  >({});
  const [lineSavingId, setLineSavingId] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const [prestationsDraft, setPrestationsDraft] = useState('');
  const [prestationsSaving, setPrestationsSaving] = useState(false);
  const [prestationsError, setPrestationsError] = useState<string | null>(null);

  // Sync prestations draft when project data changes
  useEffect(() => {
    if (projectPrestationsText === undefined) return;
    setPrestationsDraft(projectPrestationsText ?? '');
    setPrestationsError(null);
  }, [projectPrestationsText]);

  const prestationsDirty = useMemo(() => {
    const current = (projectPrestationsText ?? '').trim();
    return prestationsDraft.trim() !== current;
  }, [prestationsDraft, projectPrestationsText]);

  // ─── Prestations ────────────────────────────────────────────────────────────

  async function handleSavePrestations() {
    if (!isAdmin) {
      setPrestationsError('Réservé aux admins/owners.');
      return;
    }
    if (!prestationsDirty) return;
    setPrestationsSaving(true);
    setPrestationsError(null);
    try {
      const payload = { prestationsText: prestationsDraft.trim() || null };
      const res = await patchProject(payload);
      if (!res.ok) {
        setPrestationsError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      onBillingInfo('Détail des prestations mis à jour.');
      await loadProject();
    } catch (err) {
      setPrestationsError(getErrorMessage(err));
    } finally {
      setPrestationsSaving(false);
    }
  }

  // ─── Service reorder ────────────────────────────────────────────────────────

  const reorderServices = useCallback(
    (fromId: string, toId: string) => {
      const fromIndex = services.findIndex((svc) => svc.id === fromId);
      const toIndex = services.findIndex((svc) => svc.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return services;
      const next = [...services];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((svc, index) => ({ ...svc, position: index }));
    },
    [services]
  );

  const persistServiceOrder = useCallback(
    async (nextServices: ServiceItem[]) => {
      if (!isAdmin) return;
      setReordering(true);
      onBillingError(null);
      try {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services/reorder`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: nextServices.map((svc, index) => ({ id: svc.id, position: index })),
            }),
          }
        );
        if (!res.ok) {
          onBillingError(res.error ?? 'Réorganisation impossible.');
          await loadServices();
          return;
        }
        onBillingInfo('Ordre des services mis à jour.');
      } catch (err) {
        onBillingError(getErrorMessage(err));
        await loadServices();
      } finally {
        setReordering(false);
      }
    },
    [businessId, isAdmin, loadServices, onBillingError, onBillingInfo, projectId]
  );

  // ─── Drag-drop ──────────────────────────────────────────────────────────────

  const handleServiceDragStart = (event: DragEvent<HTMLButtonElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', serviceId);
    setDraggingServiceId(serviceId);
    setDragOverServiceId(null);
  };

  const handleServiceDragOver = (event: DragEvent<HTMLDivElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    if (!draggingServiceId || draggingServiceId === serviceId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverServiceId(serviceId);
  };

  const handleServiceDrop = async (event: DragEvent<HTMLDivElement>, serviceId: string) => {
    if (!isAdmin || reordering) return;
    event.preventDefault();
    const sourceId = draggingServiceId || event.dataTransfer.getData('text/plain');
    setDragOverServiceId(null);
    setDraggingServiceId(null);
    if (!sourceId || sourceId === serviceId) return;
    const next = reorderServices(sourceId, serviceId);
    if (next === services) return;
    setServices(next);
    await persistServiceOrder(next);
  };

  const handleServiceDragEnd = () => {
    setDraggingServiceId(null);
    setDragOverServiceId(null);
  };

  // ─── Service CRUD ────────────────────────────────────────────────────────────

  async function handleUpdateService(serviceId: string) {
    if (!isAdmin) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Réservé aux admins/owners.' }));
      return;
    }
    const draft = serviceDrafts[serviceId];
    const existing = services.find((svc) => svc.id === serviceId);
    if (!draft || !existing) return;

    const quantityNum = Number(draft.quantity);
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Quantité invalide.' }));
      return;
    }

    const priceCents = draft.price.trim() ? parseEuroInputCents(draft.price) : null;
    if (draft.price.trim() && priceCents == null) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Prix invalide.' }));
      return;
    }

    const payload: Record<string, unknown> = {};
    const quantity = Math.max(1, Math.trunc(quantityNum));
    if (quantity !== existing.quantity) payload.quantity = quantity;

    const existingPrice = parseCents(existing.priceCents);
    if (priceCents !== null && priceCents !== existingPrice) {
      payload.priceCents = priceCents;
    }

    const description = draft.description ?? '';
    if ((existing.description ?? existing.notes ?? '') !== description) {
      payload.description = description;
    }

    const title = draft.title?.trim() ?? '';
    if ((existing.titleOverride ?? '') !== title) {
      payload.titleOverride = title || null;
    }

    const discountType = draft.discountType ?? 'NONE';
    const discountValue =
      discountType === 'AMOUNT'
        ? (draft.discountValue ? parseEuroInputCents(draft.discountValue) : null)
        : (() => {
            const raw = draft.discountValue ? Number(draft.discountValue) : null;
            return Number.isFinite(raw ?? NaN) ? Math.trunc(raw ?? 0) : null;
          })();
    if (
      (existing.discountType ?? 'NONE') !== discountType ||
      (existing.discountValue ?? null) !== (discountValue ?? null)
    ) {
      payload.discountType = discountType;
      payload.discountValue = discountValue ?? null;
    }

    const billingUnit = draft.billingUnit ?? 'ONE_OFF';
    if ((existing.billingUnit ?? 'ONE_OFF') !== billingUnit) {
      payload.billingUnit = billingUnit;
    }

    let unitLabel = draft.unitLabel?.trim() ?? '';
    if (billingUnit === 'MONTHLY' && !unitLabel) {
      unitLabel = '/mois';
    }
    if ((existing.unitLabel ?? '') !== unitLabel) {
      payload.unitLabel = unitLabel || null;
    }

    if (!Object.keys(payload).length) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Aucune modification.' }));
      return;
    }

    setLineSavingId(serviceId);
    setLineErrors((prev) => ({ ...prev, [serviceId]: '' }));
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${serviceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setLineErrors((prev) => ({ ...prev, [serviceId]: res.error ?? 'Mise à jour impossible.' }));
        return;
      }
      onBillingInfo('Service mis à jour.');
      await refetchAll();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: getErrorMessage(err) }));
    } finally {
      setLineSavingId(null);
    }
  }

  async function handleDeleteService(serviceId: string) {
    if (!isAdmin) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: 'Réservé aux admins/owners.' }));
      return;
    }
    const existing = services.find((svc) => svc.id === serviceId);
    if (!existing) return;
    const label = existing.service?.name ?? 'ce service';
    const confirmMessage = `Supprimer "${label}" du projet ?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    setLineSavingId(serviceId);
    setLineErrors((prev) => ({ ...prev, [serviceId]: '' }));
    onBillingInfo(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${serviceId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setLineErrors((prev) => ({ ...prev, [serviceId]: res.error ?? 'Suppression impossible.' }));
        return;
      }
      onBillingInfo('Service supprimé.');
      setServiceDrafts((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      setOpenNotes((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      await refetchAll();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [serviceId]: getErrorMessage(err) }));
    } finally {
      setLineSavingId(null);
    }
  }

  return {
    // State
    serviceDrafts,
    setServiceDrafts,
    lineSavingId,
    lineErrors,
    setLineErrors,
    openNotes,
    setOpenNotes,
    draggingServiceId,
    dragOverServiceId,
    reordering,
    prestationsDraft,
    setPrestationsDraft,
    prestationsSaving,
    prestationsError,
    prestationsDirty,
    // Handlers
    handleSavePrestations,
    reorderServices,
    persistServiceOrder,
    handleServiceDragStart,
    handleServiceDragOver,
    handleServiceDrop,
    handleServiceDragEnd,
    handleUpdateService,
    handleDeleteService,
  };
}
