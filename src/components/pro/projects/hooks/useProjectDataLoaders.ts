import { useCallback, useEffect, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BillingSummary = {
  source: 'QUOTE' | 'PRICING';
  referenceQuoteId: string | null;
  currency: string;
  totalCents: string;
  depositPercent: number;
  depositCents: string;
  balanceCents: string;
  alreadyInvoicedCents: string;
  alreadyPaidCents: string;
  remainingToCollectCents: string;
  remainingCents: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  quoteStatus?: string | null;
  depositStatus?: string | null;
  depositPaidAt?: string | null;
  billingQuoteId?: string | null;
  billingSummary?: BillingSummary | null;
  valueCents?: string | null;
  archivedAt?: string | null;
  startDate: string | null;
  endDate: string | null;
  prestationsText?: string | null;
  tagReferences?: Array<{ id: string; name: string }>;
  updatedAt: string;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  projectServices?: Array<{
    id: string;
    serviceId: string;
    priceCents: string | null;
    quantity: number;
    notes: string | null;
    service: { id: string; code: string; name: string; type: string | null };
  }>;
};

export type ServiceItem = {
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

export type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  startDate: string | null;
  phase: string | null;
  notes: string | null;
  parentTaskId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeUserId: string | null;
  projectServiceId: string | null;
  projectId: string | null;
  progress?: number;
  subtasksCount?: number;
  checklistCount?: number;
  checklistDoneCount?: number;
};

export type ProjectDocument = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
};

export type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
};

export type ClientDocument = { id: string; title: string };
export type ClientLite = { id: string; name: string; email: string | null };

export type ProjectAccessMember = {
  membershipId: string;
  user: { id: string; name: string | null; email: string | null };
  role: string;
  organizationUnit: { id: string; name: string } | null;
  createdAt: string;
  implicit?: boolean;
};

export type OrganizationUnitItem = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type ActivityItem = {
  type: 'TASK_STATUS_UPDATED';
  taskId: string;
  title: string;
  status: string;
  serviceName?: string | null;
  occurredAt: string | null;
  actor: { id: string; name: string | null; email: string | null } | null;
};

export type QuoteItem = {
  id: string;
  status: string;
  number: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  depositPercent: number;
  currency: string;
  issuedAt: string | null;
  signedAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  items?: Array<{
    id: string;
    serviceId: string | null;
    label: string;
    description?: string | null;
    quantity: number;
    unitPriceCents: string;
    totalCents: string;
  }>;
};

export type InvoiceItem = {
  id: string;
  status: string;
  number: string | null;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidCents?: string;
  remainingCents?: string;
  paymentStatus?: string | null;
  lastPaidAt?: string | null;
  createdAt: string;
  quoteId: string | null;
};

export type BillingSettingsData = {
  defaultDepositPercent: number;
  vatEnabled: boolean;
  vatRatePercent: number;
  paymentTermsDays: number;
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
};

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseProjectDataLoadersOptions = {
  businessId: string;
  projectId: string;
  onBillingError: (msg: string | null) => void;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectDataLoaders({
  businessId,
  projectId,
  onBillingError,
}: UseProjectDataLoadersOptions) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectAccessMember[]>([]);
  const [organizationUnits, setOrganizationUnits] = useState<OrganizationUnitItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogService[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<Record<string, ServiceTemplate[]>>({});
  const [templatesLoading, setTemplatesLoading] = useState<Record<string, boolean>>({});
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);

  // ─── Loaders ──────────────────────────────────────────────────────────────

  const loadProject = useCallback(async (): Promise<string | null> => {
    const res = await fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`);
    if (!res.ok || !res.data) {
      setProject(null);
      setError(res.error ?? 'Projet introuvable');
      return null;
    }
    setProject(res.data.item);
    return res.data.item.clientId ?? null;
  }, [businessId, projectId]);

  const loadServices = useCallback(async () => {
    const res = await fetchJson<{ items: ServiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services`
    );
    if (res.ok && res.data) setServices(res.data.items);
  }, [businessId, projectId]);

  const loadTasks = useCallback(async () => {
    const res = await fetchJson<{ items: TaskItem[] }>(
      `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
    );
    if (res.ok && res.data) setTasks(res.data.items);
  }, [businessId, projectId]);

  const loadMembers = useCallback(async () => {
    const res = await fetchJson<{ items: MemberItem[] }>(`/api/pro/businesses/${businessId}/members`);
    if (res.ok && res.data) setMembers(res.data.items);
  }, [businessId]);

  const loadProjectMembers = useCallback(async () => {
    const res = await fetchJson<{ items: ProjectAccessMember[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/members`
    );
    if (res.ok && res.data) setProjectMembers(res.data.items);
  }, [businessId, projectId]);

  const loadOrganizationUnits = useCallback(async () => {
    const res = await fetchJson<{ items: OrganizationUnitItem[] }>(
      `/api/pro/businesses/${businessId}/organization/units`
    );
    if (res.ok && res.data) setOrganizationUnits(res.data.items);
  }, [businessId]);

  const loadActivity = useCallback(async () => {
    const res = await fetchJson<{ items: ActivityItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/activity?limit=20`
    );
    if (res.ok && res.data) setActivityItems(res.data.items);
  }, [businessId, projectId]);

  const loadDocuments = useCallback(async (clientIdOverride?: string | null) => {
    const clientId = clientIdOverride ?? project?.clientId;
    if (!clientId) {
      setDocuments([]);
      return;
    }
    const res = await fetchJson<{ uploads: ClientDocument[] }>(
      `/api/pro/businesses/${businessId}/clients/${clientId}/documents`
    );
    if (res.ok && res.data) setDocuments(res.data.uploads);
  }, [businessId, project?.clientId]);

  const loadProjectDocuments = useCallback(async () => {
    const res = await fetchJson<{ items: ProjectDocument[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/documents`
    );
    if (res.ok && res.data) setProjectDocuments(res.data.items);
  }, [businessId, projectId]);

  const loadBillingSettings = useCallback(async () => {
    const res = await fetchJson<{ item: BillingSettingsData }>(
      `/api/pro/businesses/${businessId}/settings`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      setBillingSettings(null);
      return;
    }
    setBillingSettings(res.data.item);
  }, [businessId]);

  const loadQuotes = useCallback(async () => {
    const res = await fetchJson<{ items: QuoteItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      onBillingError(res.error ?? 'Devis indisponibles.');
      setQuotes([]);
      return;
    }
    onBillingError(null);
    setQuotes(res.data.items ?? []);
  }, [businessId, projectId, onBillingError]);

  const loadInvoices = useCallback(async () => {
    const res = await fetchJson<{ items: InvoiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/invoices`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      onBillingError(res.error ?? 'Factures indisponibles.');
      setInvoices([]);
      return;
    }
    onBillingError(null);
    setInvoices(res.data.items ?? []);
  }, [businessId, projectId, onBillingError]);

  const loadClients = useCallback(async (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetchJson<{ items: ClientLite[] }>(
      `/api/pro/businesses/${businessId}/clients${query}`
    );
    if (res.ok && res.data) setClients(res.data.items);
  }, [businessId]);

  const loadCatalogServices = useCallback(
    async (q?: string) => {
      const query = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetchJson<{ items: CatalogService[] }>(
        `/api/pro/businesses/${businessId}/services${query}`
      );
      if (res.ok && res.data) {
        if (q) {
          setCatalogSearchResults(res.data.items);
        } else {
          setCatalogServices(res.data.items);
          setCatalogSearchResults(res.data.items);
        }
      }
    },
    [businessId]
  );

  const loadServiceTemplates = useCallback(
    async (serviceId: string) => {
      if (!serviceId) return;
      setTemplatesLoading((prev) => ({ ...prev, [serviceId]: true }));
      const res = await fetchJson<{ items: ServiceTemplate[] }>(
        `/api/pro/businesses/${businessId}/services/${serviceId}/templates`
      );
      if (res.ok) {
        const items = res.data?.items ?? [];
        setServiceTemplates((prev) => ({ ...prev, [serviceId]: items }));
      }
      setTemplatesLoading((prev) => ({ ...prev, [serviceId]: false }));
    },
    [businessId]
  );

  const refetchAll = useCallback(async () => {
    const cid = await loadProject();
    await Promise.all([
      loadServices(),
      loadTasks(),
      loadMembers(),
      loadProjectMembers(),
      loadOrganizationUnits(),
      loadActivity(),
      loadDocuments(cid),
      loadQuotes(),
      loadInvoices(),
      loadBillingSettings(),
      loadCatalogServices(),
      loadProjectDocuments(),
    ]);
  }, [
    loadBillingSettings,
    loadCatalogServices,
    loadDocuments,
    loadInvoices,
    loadMembers,
    loadProjectMembers,
    loadOrganizationUnits,
    loadActivity,
    loadProject,
    loadProjectDocuments,
    loadQuotes,
    loadServices,
    loadTasks,
  ]);

  // ─── Mount effect ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refetchAll();
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId, refetchAll]);

  return {
    // Data state
    project,
    setProject,
    services,
    setServices,
    tasks,
    members,
    setMembers,
    projectMembers,
    organizationUnits,
    activityItems,
    documents,
    quotes,
    invoices,
    billingSettings,
    loading,
    error,
    clients,
    catalogServices,
    catalogSearchResults,
    serviceTemplates,
    templatesLoading,
    projectDocuments,
    // Loaders
    loadProject,
    loadServices,
    loadTasks,
    loadMembers,
    loadProjectMembers,
    loadOrganizationUnits,
    loadActivity,
    loadDocuments,
    loadProjectDocuments,
    loadBillingSettings,
    loadQuotes,
    loadInvoices,
    loadClients,
    loadCatalogServices,
    loadServiceTemplates,
    refetchAll,
  };
}
