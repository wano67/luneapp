import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';

// ─── Local types ──────────────────────────────────────────────────────────────

type WizardLineSource = 'catalog' | 'custom';

export type WizardLine = {
  id: string;
  source: WizardLineSource;
  serviceId?: string | null;
  code?: string | null;
  title: string;
  description: string;
  quantity: number;
  unitPrice: string;
  priceLocked: boolean;
};

export type CatalogService = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
};

export type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseEuroInputCents(value: string): number | null {
  const cents = parseEuroToCents(value);
  return Number.isFinite(cents) ? cents : null;
}

function createWizardLineId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `wiz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildCustomServiceCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SER-CUSTOM-${stamp}-${rand}`;
}

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseQuoteWizardOptions = {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  serviceTemplates: Record<string, ServiceTemplate[]>;
  templatesLoading: Record<string, boolean>;
  loadCatalogServices: () => Promise<void>;
  loadMembers: () => Promise<void>;
  loadServiceTemplates: (serviceId: string) => Promise<void>;
  refetchAll: () => Promise<void>;
  onBillingInfo: (msg: string) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuoteWizard({
  businessId,
  projectId,
  isAdmin,
  serviceTemplates,
  templatesLoading,
  loadCatalogServices,
  loadMembers,
  loadServiceTemplates,
  refetchAll,
  onBillingInfo,
}: UseQuoteWizardOptions) {
  const [quoteWizardOpen, setQuoteWizardOpen] = useState(false);
  const [quoteWizardStep, setQuoteWizardStep] = useState(0);
  const [quoteWizardLines, setQuoteWizardLines] = useState<WizardLine[]>([]);
  const [quoteWizardSearch, setQuoteWizardSearch] = useState('');
  const [quoteWizardGenerateTasks, setQuoteWizardGenerateTasks] = useState(true);
  const [quoteWizardAssigneeId, setQuoteWizardAssigneeId] = useState('');
  const [quoteWizardDueOffsetDays, setQuoteWizardDueOffsetDays] = useState('');
  const [quoteWizardError, setQuoteWizardError] = useState<string | null>(null);
  const [quoteWizardInfo, setQuoteWizardInfo] = useState<string | null>(null);
  const [quoteWizardSaving, setQuoteWizardSaving] = useState(false);
  const [quoteWizardResult, setQuoteWizardResult] = useState<{
    quoteId: string;
    pdfUrl: string;
    downloadUrl: string;
  } | null>(null);

  const servicesPostedRef = useRef(false);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const wizardLineValidation = useMemo(() => {
    return quoteWizardLines.map((line) => {
      const errors: string[] = [];
      if (!line.title.trim()) errors.push('Titre requis.');
      if (line.quantity <= 0) errors.push('Qté invalide.');
      const priceCents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
      if (priceCents === null) errors.push('Prix requis.');
      return { id: line.id, errors };
    });
  }, [quoteWizardLines]);

  const wizardHasErrors = wizardLineValidation.some((entry) => entry.errors.length > 0);
  const wizardCanContinue = quoteWizardLines.length > 0 && !wizardHasErrors;

  // ─── Lazy template loading ─────────────────────────────────────────────────

  useEffect(() => {
    if (!quoteWizardOpen || !quoteWizardGenerateTasks) return;
    const selectedIds = quoteWizardLines
      .map((line) => line.serviceId)
      .filter((id): id is string => Boolean(id));
    selectedIds.forEach((serviceId) => {
      if (!serviceTemplates[serviceId] && !templatesLoading[serviceId]) {
        void loadServiceTemplates(serviceId);
      }
    });
  }, [quoteWizardOpen, quoteWizardGenerateTasks, quoteWizardLines, serviceTemplates, templatesLoading, loadServiceTemplates]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const resetQuoteWizard = useCallback(() => {
    setQuoteWizardStep(0);
    setQuoteWizardLines([]);
    setQuoteWizardSearch('');
    setQuoteWizardGenerateTasks(true);
    setQuoteWizardAssigneeId('');
    setQuoteWizardDueOffsetDays('');
    setQuoteWizardError(null);
    setQuoteWizardInfo(null);
    setQuoteWizardResult(null);
    setQuoteWizardSaving(false);
    servicesPostedRef.current = false;
  }, []);

  const openQuoteWizard = useCallback(() => {
    resetQuoteWizard();
    setQuoteWizardOpen(true);
    void loadCatalogServices();
    void loadMembers();
  }, [loadCatalogServices, loadMembers, resetQuoteWizard]);

  const closeQuoteWizard = useCallback(() => {
    setQuoteWizardOpen(false);
    resetQuoteWizard();
  }, [resetQuoteWizard]);

  const addCatalogLine = useCallback(
    (service: CatalogService) => {
      setQuoteWizardLines((prev) => {
        const existing = prev.find((line) => line.source === 'catalog' && line.serviceId === service.id);
        if (existing) {
          return prev.map((line) =>
            line.id === existing.id ? { ...line, quantity: Math.max(1, line.quantity + 1) } : line
          );
        }
        const defaultCents = service.defaultPriceCents ?? service.tjmCents;
        const unitPrice = defaultCents != null ? formatCentsToEuroInput(defaultCents) : '';
        return [
          ...prev,
          {
            id: createWizardLineId(),
            source: 'catalog',
            serviceId: service.id,
            code: service.code,
            title: service.name,
            description: '',
            quantity: 1,
            unitPrice,
            priceLocked: defaultCents != null,
          },
        ];
      });
      if (quoteWizardGenerateTasks && !serviceTemplates[service.id] && !templatesLoading[service.id]) {
        void loadServiceTemplates(service.id);
      }
    },
    [quoteWizardGenerateTasks, serviceTemplates, templatesLoading, loadServiceTemplates]
  );

  const addCustomLine = useCallback(() => {
    setQuoteWizardLines((prev) => [
      ...prev,
      {
        id: createWizardLineId(),
        source: 'custom',
        title: '',
        description: '',
        quantity: 1,
        unitPrice: '',
        priceLocked: false,
      },
    ]);
  }, []);

  const updateWizardLine = useCallback((id: string, patch: Partial<WizardLine>) => {
    setQuoteWizardLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }, []);

  const removeWizardLine = useCallback((id: string) => {
    setQuoteWizardLines((prev) => prev.filter((line) => line.id !== id));
  }, []);

  const handleWizardGenerateQuote = useCallback(async () => {
    if (!isAdmin) {
      setQuoteWizardError('Réservé aux admins/owners.');
      return;
    }
    if (!wizardCanContinue) {
      setQuoteWizardError('Ajoute des prestations et un prix valide avant de continuer.');
      return;
    }
    setQuoteWizardSaving(true);
    setQuoteWizardError(null);
    setQuoteWizardInfo('Ajout des prestations\u2026');
    try {
      const dueOffset = quoteWizardDueOffsetDays.trim()
        ? Math.max(0, Math.min(365, Number(quoteWizardDueOffsetDays)))
        : null;
      const hasDueOffset = Number.isFinite(dueOffset ?? NaN);
      const createTasks = quoteWizardGenerateTasks;

      if (servicesPostedRef.current) {
        // Services already posted on a previous attempt — skip to quote generation
      } else {
        servicesPostedRef.current = true;
      for (const line of quoteWizardLines) {
        let serviceId = line.serviceId ?? null;
        const unitPriceCents = line.unitPrice.trim() ? parseEuroInputCents(line.unitPrice) : null;
        if (!serviceId || line.source === 'custom') {
          const code = buildCustomServiceCode();
          const payload: Record<string, unknown> = {
            code,
            name: line.title.trim() || 'Prestation personnalisée',
            type: 'CUSTOM',
            description: line.description.trim() || null,
            defaultPriceCents: unitPriceCents ?? 0,
          };
          const res = await fetchJson<{ item: CatalogService & { id: string } }>(
            `/api/pro/businesses/${businessId}/services`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
          if (!res.ok || !res.data?.item?.id) {
            throw new Error(res.error ?? 'Création du service personnalisé impossible.');
          }
          serviceId = res.data.item.id;
        }

        const payload: Record<string, unknown> = {
          serviceId,
          quantity: Math.max(1, Math.trunc(line.quantity)),
          titleOverride: line.title.trim() || undefined,
          description: line.description.trim() || undefined,
        };
        if (unitPriceCents != null && (!line.priceLocked || line.source === 'custom')) {
          payload.priceCents = Math.max(0, Math.trunc(unitPriceCents));
        }
        if (createTasks) {
          payload.generateTasks = true;
          if (quoteWizardAssigneeId) payload.taskAssigneeUserId = quoteWizardAssigneeId;
          if (hasDueOffset) payload.taskDueOffsetDays = Math.trunc(dueOffset as number);
        } else {
          payload.generateTasks = false;
        }

        const addRes = await fetchJson<{ id: string }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!addRes.ok) {
          throw new Error(addRes.error ?? 'Ajout des services au projet impossible.');
        }
      }
      } // end else (services not yet posted)

      setQuoteWizardInfo('Génération du devis\u2026');
      const quoteRes = await fetchJson<{
        item: { id: string };
        pdfUrl: string;
        downloadUrl: string;
      }>(`/api/pro/businesses/${businessId}/projects/${projectId}/quotes`, { method: 'POST' });
      if (!quoteRes.ok || !quoteRes.data) {
        throw new Error(quoteRes.error ?? 'Création du devis impossible.');
      }
      setQuoteWizardResult({
        quoteId: quoteRes.data.item.id,
        pdfUrl: quoteRes.data.pdfUrl,
        downloadUrl: quoteRes.data.downloadUrl,
      });
      setQuoteWizardInfo('Devis généré');
      onBillingInfo('Devis généré');
      await refetchAll();
    } catch (err) {
      setQuoteWizardError(getErrorMessage(err));
    } finally {
      setQuoteWizardSaving(false);
    }
  }, [
    isAdmin,
    wizardCanContinue,
    quoteWizardDueOffsetDays,
    quoteWizardGenerateTasks,
    quoteWizardLines,
    quoteWizardAssigneeId,
    businessId,
    projectId,
    onBillingInfo,
    refetchAll,
  ]);

  return {
    // State
    quoteWizardOpen,
    quoteWizardStep,
    setQuoteWizardStep,
    quoteWizardLines,
    quoteWizardSearch,
    setQuoteWizardSearch,
    quoteWizardGenerateTasks,
    setQuoteWizardGenerateTasks,
    quoteWizardAssigneeId,
    setQuoteWizardAssigneeId,
    quoteWizardDueOffsetDays,
    setQuoteWizardDueOffsetDays,
    quoteWizardError,
    quoteWizardInfo,
    quoteWizardSaving,
    quoteWizardResult,
    // Computed
    wizardLineValidation,
    wizardCanContinue,
    // Actions
    openQuoteWizard,
    closeQuoteWizard,
    addCatalogLine,
    addCustomLine,
    updateWizardLine,
    removeWizardLine,
    handleWizardGenerateQuote,
  };
}
