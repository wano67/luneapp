"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TabsPills } from '@/components/pro/TabsPills';
import {
  UI,
  formatDate,
  SectionCard,
  StatCard,
  MetaItem,
  StickyHeaderActions,
} from '@/components/pro/projects/workspace-ui';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import type { ChecklistItem } from '@/components/pro/projects/ProjectSetupChecklist';
import { OverviewTab } from '@/components/pro/projects/tabs/OverviewTab';
import { BillingTab } from '@/components/pro/projects/tabs/BillingTab';
import {
  getProjectScopeLabelFR,
  getProjectScopeVariant,
  getProjectStatusLabelFR,
  isProjectOverdue,
  shouldWarnProjectCompletion,
} from '@/lib/projectStatusUi';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { QuoteWizardModal } from '@/components/pro/projects/modals/QuoteWizardModal';
import { QuoteDateModal, type QuoteDateEditorState } from '@/components/pro/projects/modals/QuoteDateModal';
import { CancelQuoteModal, type CancelQuoteEditorState } from '@/components/pro/projects/modals/CancelQuoteModal';
import { InvoiceDateModal, type InvoiceDateEditorState } from '@/components/pro/projects/modals/InvoiceDateModal';
import { DepositDateModal } from '@/components/pro/projects/modals/DepositDateModal';
import { StagedInvoiceModal, type StagedInvoiceModalState } from '@/components/pro/projects/modals/StagedInvoiceModal';
import { PaymentModal } from '@/components/pro/projects/modals/PaymentModal';
import { QuoteEditorModal } from '@/components/pro/projects/modals/QuoteEditorModal';
import { InvoiceEditorModal } from '@/components/pro/projects/modals/InvoiceEditorModal';
import { FilesTab } from '@/components/pro/projects/tabs/FilesTab';
import { WorkTab } from '@/components/pro/projects/tabs/WorkTab';
import { TeamTab } from '@/components/pro/projects/tabs/TeamTab';
import { SetupModals } from '@/components/pro/projects/modals/SetupModals';
import { useQuoteWizard } from '@/components/pro/projects/hooks/useQuoteWizard';
import { usePaymentModal } from '@/components/pro/projects/hooks/usePaymentModal';

type ProjectDetail = {
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

type CatalogService = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
};

type ServiceTemplate = {
  id: string;
  title: string;
  phase: string | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
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

type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
};
type ClientDocument = { id: string; title: string };
type ClientLite = { id: string; name: string; email: string | null };

type ProjectAccessMember = {
  membershipId: string;
  user: { id: string; name: string | null; email: string | null };
  role: string;
  organizationUnit: { id: string; name: string } | null;
  createdAt: string;
  implicit?: boolean;
};

type OrganizationUnitItem = {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

type ActivityItem = {
  type: 'TASK_STATUS_UPDATED';
  taskId: string;
  title: string;
  status: string;
  serviceName?: string | null;
  occurredAt: string | null;
  actor: { id: string; name: string | null; email: string | null } | null;
};

type BillingSummary = {
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

type QuoteItem = {
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

type InvoiceItem = {
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

type EditableLine = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
  serviceId?: string | null;
  productId?: string | null;
};

type InvoiceLineItem = {
  id: string;
  serviceId: string | null;
  productId: string | null;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  totalCents: string;
};


type QuoteEditorState = {
  quoteId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  expiresAt: string;
  note: string;
  lines: EditableLine[];
};

type InvoiceEditorState = {
  invoiceId: string;
  status: string;
  number: string | null;
  issuedAt: string;
  dueAt: string;
  note: string;
  lines: EditableLine[];
};

type InvoiceDetail = InvoiceItem & {
  note: string | null;
  items: InvoiceLineItem[];
};

const tabs = [
  { key: 'overview', label: "Vue d\u2019ensemble" },
  { key: 'work', label: 'Travail' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'files', label: 'Documents' },
];


function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

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

function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}


function toEditableLine(item: {
  id: string;
  label: string;
  description?: string | null;
  quantity: number;
  unitPriceCents: string;
  serviceId?: string | null;
  productId?: string | null;
}): EditableLine {
  return {
    id: item.id,
    label: item.label,
    description: item.description ?? '',
    quantity: String(item.quantity),
    unitPrice: formatCentsToEuroInput(item.unitPriceCents),
    serviceId: item.serviceId ?? null,
    productId: item.productId ?? null,
  };
}

const OVERVIEW_PREVIEW_COUNT = 3;
const OVERVIEW_ACTIVITY_COUNT = 5;
const OVERVIEW_MEMBERS_COUNT = 6;

export function ProjectWorkspace({ businessId, projectId }: { businessId: string; projectId: string }) {
  const searchParams = useSearchParams();
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
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
  const [billingSettings, setBillingSettings] = useState<{
    defaultDepositPercent: number;
    vatEnabled: boolean;
    vatRatePercent: number;
    paymentTermsDays: number;
    cgvText?: string | null;
    paymentTermsText?: string | null;
    lateFeesText?: string | null;
    fixedIndemnityText?: string | null;
    legalMentionsText?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<string | null>(null);
  const [quoteEditor, setQuoteEditor] = useState<QuoteEditorState | null>(null);
  const [invoiceEditor, setInvoiceEditor] = useState<InvoiceEditorState | null>(null);
  const [quoteEditError, setQuoteEditError] = useState<string | null>(null);
  const [invoiceEditError, setInvoiceEditError] = useState<string | null>(null);
  const [quoteEditing, setQuoteEditing] = useState(false);
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const [stagedInvoiceModal, setStagedInvoiceModal] = useState<StagedInvoiceModalState | null>(null);
  const [stagedInvoiceError, setStagedInvoiceError] = useState<string | null>(null);
  const [stagedInvoiceLoading, setStagedInvoiceLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'team' | 'billing' | 'files'>('overview');
  const [statusFilter, setStatusFilter] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'all'>('all');
  const [showAllServicesOverview, setShowAllServicesOverview] = useState(false);
  const [showAllActionsOverview, setShowAllActionsOverview] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [unitsModalOpen, setUnitsModalOpen] = useState(false);
  const [unitDraftName, setUnitDraftName] = useState('');
  const [unitDraftOrder, setUnitDraftOrder] = useState('0');
  const [unitErrors, setUnitErrors] = useState<string | null>(null);
  const [unitDrafts, setUnitDrafts] = useState<Record<string, { name: string; order: string }>>({});
  const [accessInfo, setAccessInfo] = useState<string | null>(null);
  const [teamInfo, setTeamInfo] = useState<string | null>(null);
  const [taskGroupExpanded, setTaskGroupExpanded] = useState<Record<string, boolean>>({});
  const [taskRowExpanded, setTaskRowExpanded] = useState<Record<string, boolean>>({});
  const [activeSetupModal, setActiveSetupModal] = useState<
    null | 'client' | 'deadline' | 'services' | 'tasks' | 'team' | 'documents'
  >(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogSearchResults, setCatalogSearchResults] = useState<CatalogService[]>([]);
  const [saving, setSaving] = useState(false);
  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [serviceSelections, setServiceSelections] = useState<Record<string, number>>({});
  const [quickServiceDraft, setQuickServiceDraft] = useState({
    name: '',
    code: '',
    price: '',
    billingUnit: 'ONE_OFF',
  });
  const [quickServiceSaving, setQuickServiceSaving] = useState(false);
  const [quickServiceError, setQuickServiceError] = useState<string | null>(null);
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
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteActionId, setQuoteActionId] = useState<string | null>(null);
  const [invoiceActionId, setInvoiceActionId] = useState<string | null>(null);
  const [recurringInvoiceActionId, setRecurringInvoiceActionId] = useState<string | null>(null);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  const [serviceTemplates, setServiceTemplates] = useState<Record<string, ServiceTemplate[]>>({});
  const [templatesLoading, setTemplatesLoading] = useState<Record<string, boolean>>({});
  const [generateTasksOnAdd, setGenerateTasksOnAdd] = useState(true);
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueOffsetDays, setTaskDueOffsetDays] = useState('');
  const [openServiceTasks, setOpenServiceTasks] = useState<Record<string, boolean>>({});
  const [taskUpdating, setTaskUpdating] = useState<Record<string, boolean>>({});
  const [templatesApplying, setTemplatesApplying] = useState<Record<string, boolean>>({});
  const [quoteDateEditor, setQuoteDateEditor] = useState<QuoteDateEditorState | null>(null);
  const [cancelQuoteEditor, setCancelQuoteEditor] = useState<CancelQuoteEditorState | null>(null);
  const [cancelQuoteError, setCancelQuoteError] = useState<string | null>(null);
  const [cancelQuoteSaving, setCancelQuoteSaving] = useState(false);
  const [invoiceDateEditor, setInvoiceDateEditor] = useState<InvoiceDateEditorState | null>(null);
  const [depositDateEditorOpen, setDepositDateEditorOpen] = useState(false);
  const [depositPaidDraft, setDepositPaidDraft] = useState('');
  const [dateModalError, setDateModalError] = useState<string | null>(null);
  const [dateModalSaving, setDateModalSaving] = useState(false);
  const [referenceUpdatingId, setReferenceUpdatingId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<'Administratif' | 'Projet'>('Administratif');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [draggingServiceId, setDraggingServiceId] = useState<string | null>(null);
  const [dragOverServiceId, setDragOverServiceId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [prestationsDraft, setPrestationsDraft] = useState('');
  const [prestationsSaving, setPrestationsSaving] = useState(false);
  const [prestationsError, setPrestationsError] = useState<string | null>(null);


  const closeModal = () => {
    setActiveSetupModal(null);
    setModalError(null);
    setSaving(false);
    setDocumentFile(null);
    setQuickServiceError(null);
    setQuickServiceSaving(false);
    setQuickServiceDraft({ name: '', code: '', price: '', billingUnit: 'ONE_OFF' });
  };

  const updateTaskDueDate = async (taskId: string, value: string) => {
    try {
      setModalError(null);
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate: value || null }),
      });
      if (!res.ok) {
        setModalError(res.error ?? 'Impossible de mettre à jour la date.');
        return;
      }
      await loadTasks();
    } catch (err) {
      setModalError(getErrorMessage(err));
    }
  };

  const updateTask = async (taskId: string, payload: Record<string, unknown>) => {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setTaskUpdating((prev) => ({ ...prev, [taskId]: true }));
    try {
      setBillingError(null);
      const res = await fetchJson(`/api/pro/businesses/${businessId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de mettre à jour la tâche.');
        return;
      }
      await loadTasks();
      if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
        await loadActivity();
      }
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setTaskUpdating((prev) => ({ ...prev, [taskId]: false }));
    }
  };

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

  useEffect(() => {
    if (!project) return;
    setPrestationsDraft(project.prestationsText ?? '');
    setPrestationsError(null);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setDepositPaidDraft(project.depositPaidAt ? project.depositPaidAt.slice(0, 10) : '');
  }, [project?.depositPaidAt, project]);

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

  const loadBillingSettings = useCallback(async () => {
    const res = await fetchJson<{
      item: {
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
    }>(`/api/pro/businesses/${businessId}/settings`, { cache: 'no-store' });
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
      setBillingError(res.error ?? 'Devis indisponibles.');
      setQuotes([]);
      return;
    }
    setBillingError(null);
    setQuotes(res.data.items ?? []);
  }, [businessId, projectId]);

  const loadInvoices = useCallback(async () => {
    const res = await fetchJson<{ items: InvoiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/invoices`,
      { cache: 'no-store' }
    );
    if (!res.ok || !res.data) {
      setBillingError(res.error ?? 'Factures indisponibles.');
      setInvoices([]);
      return;
    }
    setBillingError(null);
    setInvoices(res.data.items ?? []);
  }, [businessId, projectId]);

  const {
    paymentModal,
    paymentItems,
    paymentLoading,
    paymentError,
    paymentNotice,
    paymentSaving,
    paymentDeletingId,
    paymentForm,
    setPaymentForm,
    activePaymentInvoice,
    paymentTotalCents,
    paymentPaidCents,
    paymentRemainingCents,
    applyPaymentShortcut,
    openPaymentModal,
    closePaymentModal,
    handleSavePayment,
    handleDeletePayment,
  } = usePaymentModal({
    businessId,
    isAdmin,
    invoices,
    loadInvoices,
    onBillingInfo: setBillingInfo,
    onBillingError: setBillingError,
  });

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
    loadQuotes,
    loadServices,
    loadTasks,
  ]);

  const {
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
    wizardLineValidation,
    wizardCanContinue,
    openQuoteWizard,
    closeQuoteWizard,
    addCatalogLine,
    addCustomLine,
    updateWizardLine,
    removeWizardLine,
    handleWizardGenerateQuote,
  } = useQuoteWizard({
    businessId,
    projectId,
    isAdmin,
    serviceTemplates,
    templatesLoading,
    loadCatalogServices,
    loadMembers,
    loadServiceTemplates,
    refetchAll,
    onBillingInfo: setBillingInfo,
  });

  const patchProject = async (body: Record<string, unknown>) => {
    return fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const prestationsDirty = useMemo(() => {
    const current = (project?.prestationsText ?? '').trim();
    return prestationsDraft.trim() !== current;
  }, [prestationsDraft, project?.prestationsText]);

  async function handleSavePrestations() {
    if (!project) return;
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
      setBillingInfo('Détail des prestations mis à jour.');
      await loadProject();
    } catch (err) {
      setPrestationsError(getErrorMessage(err));
    } finally {
      setPrestationsSaving(false);
    }
  }

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
      setBillingError(null);
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
          setBillingError(res.error ?? 'Réorganisation impossible.');
          await loadServices();
          return;
        }
        setBillingInfo('Ordre des services mis à jour.');
      } catch (err) {
        setBillingError(getErrorMessage(err));
        await loadServices();
      } finally {
        setReordering(false);
      }
    },
    [businessId, isAdmin, loadServices, projectId]
  );

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

  async function handleMarkCompleted() {
    if (!project) return;
    if (!isAdmin) {
      setActionError('Réservé aux admins/owners.');
      return;
    }
    const warning = shouldWarnProjectCompletion(project.quoteStatus ?? null, project.depositStatus ?? null);
    const confirmMessage = warning
      ? 'Devis non signé ou acompte non validé. Marquer terminé quand même ?'
      : 'Marquer ce projet comme terminé ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;

    const payload: Record<string, unknown> = { status: 'COMPLETED' };

    setMarkingCompleted(true);
    setActionError(null);
    try {
      const res = await patchProject(payload);
      if (!res.ok) {
        setActionError(res.error ?? 'Impossible de marquer le projet terminé.');
        return;
      }
      await refetchAll();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setMarkingCompleted(false);
    }
  }

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
    if ((existing.discountType ?? 'NONE') !== discountType || (existing.discountValue ?? null) !== (discountValue ?? null)) {
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
      setBillingInfo('Service mis à jour.');
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
    setBillingInfo(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${serviceId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        setLineErrors((prev) => ({ ...prev, [serviceId]: res.error ?? 'Suppression impossible.' }));
        return;
      }
      setBillingInfo('Service supprimé.');
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

  async function handleCreateQuote() {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (!services.length) {
      setBillingError('Ajoute au moins un service avant de créer un devis.');
      return;
    }
    if (pricingTotals.missingCount > 0) {
      setBillingError('Renseigne les tarifs manquants avant de créer un devis.');
      return;
    }
    setCreatingQuote(true);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
        { method: 'POST' }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Création du devis impossible.');
        return;
      }
      setBillingInfo('Devis créé.');
      await Promise.all([loadQuotes(), loadInvoices()]);
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setCreatingQuote(false);
    }
  }

  function openCancelQuoteModal(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setCancelQuoteError(null);
    setCancelQuoteEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      reason: '',
    });
  }

  async function handleCancelQuote() {
    if (!cancelQuoteEditor) return;
    if (!isAdmin) {
      setCancelQuoteError('Réservé aux admins/owners.');
      return;
    }
    const reason = cancelQuoteEditor.reason.trim();
    if (!reason) {
      setCancelQuoteError('La raison est requise.');
      return;
    }
    if (cancelQuoteSaving) return;
    setCancelQuoteSaving(true);
    setCancelQuoteError(null);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${cancelQuoteEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CANCELLED', cancelReason: reason }),
        }
      );
      if (!res.ok) {
        setCancelQuoteError(res.error ?? 'Annulation impossible.');
        return;
      }
      setCancelQuoteEditor(null);
      await refetchAll();
    } catch (err) {
      setCancelQuoteError(getErrorMessage(err));
    } finally {
      setCancelQuoteSaving(false);
    }
  }

  async function handleSetBillingReference(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setReferenceUpdatingId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await patchProject({ billingQuoteId: quoteId });
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de définir le devis de référence.');
        return;
      }
      setBillingInfo('Devis de référence mis à jour.');
      await loadProject();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setReferenceUpdatingId(null);
    }
  }

  async function handleQuoteStatus(quoteId: string, nextStatus: 'SENT' | 'SIGNED' | 'EXPIRED') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setQuoteActionId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Mise à jour du devis impossible.');
        return;
      }
      await Promise.all([loadQuotes(), loadProject()]);
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setQuoteActionId(null);
    }
  }

  async function handleCreateInvoice(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceActionId(quoteId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ item: { id: string } }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
        { method: 'POST' }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      setBillingInfo('Facture créée.');
      await loadInvoices();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  async function handleGenerateRecurringInvoice(projectServiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setRecurringInvoiceActionId(projectServiceId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${projectServiceId}/recurring-invoices`,
        { method: 'POST' }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Création de la facture mensuelle impossible.');
        return;
      }
      setBillingInfo('Facture mensuelle créée.');
      await loadInvoices();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setRecurringInvoiceActionId(null);
    }
  }

  function openStagedInvoiceModal(kind: 'DEPOSIT' | 'MID' | 'FINAL') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const defaultValue =
      kind === 'DEPOSIT' && Number.isFinite(summaryTotals.depositPercent)
        ? String(summaryTotals.depositPercent)
        : '';
    setStagedInvoiceModal({ kind, mode: 'PERCENT', value: defaultValue });
    setStagedInvoiceError(null);
  }

  function closeStagedInvoiceModal() {
    setStagedInvoiceModal(null);
    setStagedInvoiceError(null);
  }

  async function handleCreateStagedInvoice() {
    if (!stagedInvoiceModal) return;
    if (!isAdmin) {
      setStagedInvoiceError('Réservé aux admins/owners.');
      return;
    }
    if (remainingToInvoiceCents <= 0) {
      setStagedInvoiceError('Aucun montant restant à facturer.');
      return;
    }

    const mode = stagedInvoiceModal.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal.mode;
    let value: number | undefined;
    if (mode === 'PERCENT') {
      const percent = Number(stagedInvoiceModal.value);
      if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
        setStagedInvoiceError('Pourcentage invalide.');
        return;
      }
      value = percent;
    } else if (mode === 'AMOUNT') {
      const cents = parseEuroInputCents(stagedInvoiceModal.value);
      if (cents == null || cents <= 0) {
        setStagedInvoiceError('Montant invalide.');
        return;
      }
      value = cents;
    }

    const previewAmount =
      mode === 'FINAL'
        ? remainingToInvoiceCents
        : mode === 'PERCENT' && value != null
          ? Math.round(summaryTotals.totalCents * (value / 100))
          : value ?? 0;

    if (previewAmount > remainingToInvoiceCents) {
      setStagedInvoiceError('Le montant dépasse le reste à facturer.');
      return;
    }

    setStagedInvoiceLoading(true);
    setStagedInvoiceError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ invoice: { id: string } }>(
        `/api/pro/businesses/${businessId}/projects/${projectId}/invoices/staged`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'FINAL' ? { mode } : { mode, value }),
        }
      );
      if (!res.ok) {
        setStagedInvoiceError(res.error ?? 'Création de la facture impossible.');
        return;
      }
      setBillingInfo('Facture créée.');
      closeStagedInvoiceModal();
      await loadInvoices();
    } catch (err) {
      setStagedInvoiceError(getErrorMessage(err));
    } finally {
      setStagedInvoiceLoading(false);
    }
  }

  async function handleInvoiceStatus(invoiceId: string, nextStatus: 'SENT' | 'CANCELLED') {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceActionId(invoiceId);
    setBillingError(null);
    setBillingInfo(null);
    try {
      const res = await fetchJson<{ item: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Mise à jour de la facture impossible.');
        return;
      }
      await loadInvoices();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

  function openQuoteDateModal(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setDateModalError(null);
    setQuoteDateEditor({
      quoteId: quote.id,
      number: quote.number ?? null,
      status: quote.status,
      signedAt: quote.signedAt ? quote.signedAt.slice(0, 10) : '',
    });
  }

  function openInvoiceDateModal(invoice: InvoiceItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setDateModalError(null);
    setInvoiceDateEditor({
      invoiceId: invoice.id,
      number: invoice.number ?? null,
      status: invoice.status,
      paidAt: invoice.paidAt ? invoice.paidAt.slice(0, 10) : '',
    });
  }

  async function handleSaveQuoteDate() {
    if (!quoteDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(
        `/api/pro/businesses/${businessId}/quotes/${quoteDateEditor.quoteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signedAt: quoteDateEditor.signedAt ? new Date(quoteDateEditor.signedAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadQuotes();
      setQuoteDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveInvoiceDate() {
    if (!invoiceDateEditor) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await fetchJson<{ item: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceDateEditor.invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paidAt: invoiceDateEditor.paidAt ? new Date(invoiceDateEditor.paidAt).toISOString() : null,
          }),
        }
      );
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadInvoices();
      setInvoiceDateEditor(null);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  async function handleSaveDepositDate() {
    if (!project) return;
    setDateModalSaving(true);
    setDateModalError(null);
    try {
      const res = await patchProject({
        depositPaidAt: depositPaidDraft ? new Date(depositPaidDraft).toISOString() : null,
      });
      if (!res.ok) {
        setDateModalError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await refetchAll();
      setDepositDateEditorOpen(false);
    } catch (err) {
      setDateModalError(getErrorMessage(err));
    } finally {
      setDateModalSaving(false);
    }
  }

  function openQuoteEditor(quote: QuoteItem) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const lines = (quote.items ?? []).map(toEditableLine);
    setQuoteEditError(null);
    setQuoteEditor({
      quoteId: quote.id,
      status: quote.status,
      number: quote.number ?? null,
      issuedAt: toDateInput(quote.issuedAt ?? quote.createdAt),
      expiresAt: toDateInput(quote.expiresAt),
      note: quote.note ?? '',
      lines,
    });
  }

  function closeQuoteEditor() {
    setQuoteEditor(null);
    setQuoteEditError(null);
  }

  function addQuoteLine() {
    if (!quoteEditor) return;
    const nextLine: EditableLine = {
      id: `new-${Date.now()}`,
      label: '',
      description: '',
      quantity: '1',
      unitPrice: '',
      serviceId: null,
      productId: null,
    };
    setQuoteEditor({ ...quoteEditor, lines: [...quoteEditor.lines, nextLine] });
  }

  function removeQuoteLine(lineId: string) {
    if (!quoteEditor) return;
    setQuoteEditor({ ...quoteEditor, lines: quoteEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveQuoteEdit() {
    if (!quoteEditor) return;
    if (!isAdmin) {
      setQuoteEditError('Réservé aux admins/owners.');
      return;
    }
    if (quoteEditing) return;

    const editableStatus = quoteEditor.status === 'DRAFT' || quoteEditor.status === 'SENT';
    const canEditLines = quoteEditor.status === 'DRAFT';
    if (!editableStatus) {
      setQuoteEditError('Devis signé/annulé: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {};
    const issuedAt = quoteEditor.issuedAt ? new Date(quoteEditor.issuedAt).toISOString() : null;
    const expiresAt = quoteEditor.expiresAt ? new Date(quoteEditor.expiresAt).toISOString() : null;
    payload.issuedAt = issuedAt;
    payload.expiresAt = expiresAt;
    payload.note = quoteEditor.note.trim() || null;

    if (canEditLines) {
      if (!quoteEditor.lines.length) {
        setQuoteEditError('Ajoute au moins une ligne.');
        return;
      }
      const items = [];
      for (const line of quoteEditor.lines) {
        const label = line.label.trim();
        if (!label) {
          setQuoteEditError('Chaque ligne doit avoir un libellé.');
          return;
        }
        const description = line.description.trim();
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          setQuoteEditError('Quantité invalide.');
          return;
        }
        const unitPriceCents = parseEuroInputCents(line.unitPrice);
        if (unitPriceCents == null) {
          setQuoteEditError('Prix unitaire invalide.');
          return;
        }
        items.push({
          id: line.id,
          label,
          description: description || null,
          quantity: Math.max(1, Math.trunc(qty)),
          unitPriceCents,
          serviceId: line.serviceId ?? null,
        });
      }
      payload.items = items;
    }

    setQuoteEditing(true);
    setQuoteEditError(null);
    try {
      const res = await fetchJson<{ quote: QuoteItem }>(`/api/pro/businesses/${businessId}/quotes/${quoteEditor.quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setQuoteEditError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadQuotes();
      setBillingInfo('Devis mis à jour.');
      closeQuoteEditor();
    } catch (err) {
      setQuoteEditError(getErrorMessage(err));
    } finally {
      setQuoteEditing(false);
    }
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Supprimer ce devis ? Cette action est irréversible.')) {
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    setQuoteActionId(quoteId);
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/quotes/${quoteId}`, { method: 'DELETE' });
      if (!res.ok) {
        setBillingError(res.error ?? 'Suppression impossible.');
        return;
      }
      await loadQuotes();
      setBillingInfo('Devis supprimé.');
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setQuoteActionId(null);
    }
  }

  async function openInvoiceEditor(invoiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    setInvoiceEditError(null);
    setInvoiceEditor(null);
    try {
      const res = await fetchJson<{ item: InvoiceDetail }>(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, {
        cache: 'no-store',
      });
      if (!res.ok || !res.data) {
        setInvoiceEditError(res.error ?? 'Facture introuvable.');
        return;
      }
      const invoice = res.data.item;
      setInvoiceEditor({
        invoiceId: invoice.id,
        status: invoice.status,
        number: invoice.number ?? null,
        issuedAt: toDateInput(invoice.issuedAt ?? invoice.createdAt),
        dueAt: toDateInput(invoice.dueAt),
        note: invoice.note ?? '',
        lines: invoice.items.map(toEditableLine),
      });
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    }
  }

  function closeInvoiceEditor() {
    setInvoiceEditor(null);
    setInvoiceEditError(null);
  }

  function addInvoiceLine() {
    if (!invoiceEditor) return;
    const nextLine: EditableLine = {
      id: `new-${Date.now()}`,
      label: '',
      description: '',
      quantity: '1',
      unitPrice: '',
      productId: null,
      serviceId: null,
    };
    setInvoiceEditor({ ...invoiceEditor, lines: [...invoiceEditor.lines, nextLine] });
  }

  function removeInvoiceLine(lineId: string) {
    if (!invoiceEditor) return;
    setInvoiceEditor({ ...invoiceEditor, lines: invoiceEditor.lines.filter((line) => line.id !== lineId) });
  }

  async function handleSaveInvoiceEdit() {
    if (!invoiceEditor) return;
    if (!isAdmin) {
      setInvoiceEditError('Réservé aux admins/owners.');
      return;
    }
    if (invoiceEditing) return;

    const canEditLines = invoiceEditor.status === 'DRAFT';
    const editableStatus = invoiceEditor.status === 'DRAFT' || invoiceEditor.status === 'SENT';
    if (!editableStatus) {
      setInvoiceEditError('Facture payée/annulée: modification interdite.');
      return;
    }

    const payload: Record<string, unknown> = {};
    payload.issuedAt = invoiceEditor.issuedAt ? new Date(invoiceEditor.issuedAt).toISOString() : null;
    payload.dueAt = invoiceEditor.dueAt ? new Date(invoiceEditor.dueAt).toISOString() : null;
    payload.note = invoiceEditor.note.trim() || null;

    if (canEditLines) {
      if (!invoiceEditor.lines.length) {
        setInvoiceEditError('Ajoute au moins une ligne.');
        return;
      }
      const lineItems = [];
      for (const line of invoiceEditor.lines) {
        const label = line.label.trim();
        if (!label) {
          setInvoiceEditError('Chaque ligne doit avoir un libellé.');
          return;
        }
        const description = line.description.trim();
        const qty = Number(line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          setInvoiceEditError('Quantité invalide.');
          return;
        }
        const unitPriceCents = parseEuroInputCents(line.unitPrice);
        if (unitPriceCents == null) {
          setInvoiceEditError('Prix unitaire invalide.');
          return;
        }
        lineItems.push({
          id: line.id,
          label,
          description: description || null,
          quantity: Math.max(1, Math.trunc(qty)),
          unitPriceCents,
          productId: line.productId ?? null,
          serviceId: line.serviceId ?? null,
        });
      }
      payload.lineItems = lineItems;
    }

    setInvoiceEditing(true);
    setInvoiceEditError(null);
    try {
      const res = await fetchJson<{ item: InvoiceItem }>(
        `/api/pro/businesses/${businessId}/invoices/${invoiceEditor.invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        setInvoiceEditError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      await loadInvoices();
      setBillingInfo('Facture mise à jour.');
      closeInvoiceEditor();
    } catch (err) {
      setInvoiceEditError(getErrorMessage(err));
    } finally {
      setInvoiceEditing(false);
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Supprimer cette facture ? Cette action est irréversible.')) {
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    setInvoiceActionId(invoiceId);
    try {
      const res = await fetchJson(`/api/pro/businesses/${businessId}/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!res.ok) {
        setBillingError(res.error ?? 'Suppression impossible.');
        return;
      }
      await loadInvoices();
      setBillingInfo('Facture supprimée.');
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setInvoiceActionId(null);
    }
  }

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

  const statusLabel = useMemo(() => {
    return getProjectStatusLabelFR(project?.status ?? null);
  }, [project?.status]);

  const scopeLabel = useMemo(() => {
    return getProjectScopeLabelFR(project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.status]);

  const scopeVariant = useMemo(() => {
    return getProjectScopeVariant(project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.status]);

  const showScopeBadge = useMemo(() => {
    return scopeLabel.toLowerCase() !== statusLabel.toLowerCase();
  }, [scopeLabel, statusLabel]);

  const isOverdue = useMemo(() => {
    return isProjectOverdue(project?.endDate ?? null, project?.status ?? null, project?.archivedAt ?? null);
  }, [project?.archivedAt, project?.endDate, project?.status]);

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const hasClient = Boolean(project?.clientId);
    const hasEndDate = Boolean(project?.endDate);
    const hasServices = services.length > 0;
    const hasTasks = tasks.length > 0;
    const hasDocs = documents.length > 0;
    const hasTeam = members.length > 0 || tasks.some((t) => t.assigneeEmail || t.assigneeName);
    return [
      { key: 'client', label: 'Client lié', done: hasClient, ctaLabel: 'Associer un client', href: `/app/pro/${businessId}/clients` },
      { key: 'deadline', label: 'Échéance définie', done: hasEndDate, ctaLabel: 'Définir la date', href: `/app/pro/${businessId}/projects/${projectId}/edit` },
      { key: 'services', label: 'Services ajoutés', done: hasServices, ctaLabel: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` },
      { key: 'tasks', label: 'Tâches générées/assignées', done: hasTasks, ctaLabel: 'Configurer les tâches', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` },
      { key: 'team', label: 'Équipe assignée', done: hasTeam, ctaLabel: 'Ajouter un membre', href: `/app/pro/${businessId}/projects/${projectId}?tab=team` },
      { key: 'docs', label: 'Dossier documents initial', done: hasDocs, ctaLabel: 'Ajouter un document', href: `/app/pro/${businessId}/projects/${projectId}?tab=files` },
    ];
  }, [businessId, project?.clientId, project?.endDate, projectId, services.length, tasks, members.length, documents.length]);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['overview', 'work', 'team', 'billing', 'files'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [searchParams]);

  const showSetup = (searchParams?.get('setup') ?? '') === '1';
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'DONE' && (t.subtasksCount ?? 0) === 0)
      .sort(
        (a, b) =>
          (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
          (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
      );
  }, [tasks]);

  const servicesWithTasks = useMemo(() => {
    return services.map((service) => ({
      service,
      tasks: tasks.filter((t) => t.projectServiceId === service.id),
    }));
  }, [services, tasks]);

  const servicesOverview = showAllServicesOverview
    ? servicesWithTasks
    : servicesWithTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showServicesToggle = servicesWithTasks.length > OVERVIEW_PREVIEW_COUNT;

  const upcomingTasksOverview = showAllActionsOverview
    ? upcomingTasks
    : upcomingTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showActionsToggle = upcomingTasks.length > OVERVIEW_PREVIEW_COUNT;

  const activityOverview = showAllActivity
    ? activityItems
    : activityItems.slice(0, OVERVIEW_ACTIVITY_COUNT);
  const showActivityToggle = activityItems.length > OVERVIEW_ACTIVITY_COUNT;

  const projectMembersPreview = projectMembers.slice(0, OVERVIEW_MEMBERS_COUNT);
  const projectMembersOverflow = Math.max(0, projectMembers.length - projectMembersPreview.length);
  const projectMemberIds = useMemo(
    () => new Set(projectMembers.map((member) => member.membershipId)),
    [projectMembers]
  );
  const availableMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !projectMemberIds.has(member.membershipId) &&
          member.role !== 'OWNER' &&
          member.role !== 'ADMIN'
      ),
    [members, projectMemberIds]
  );

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const subtasksByParentId = useMemo(() => {
    const record: Record<string, TaskItem[]> = {};
    tasks.forEach((task) => {
      if (!task.parentTaskId) return;
      const bucket = record[task.parentTaskId] ?? [];
      bucket.push(task);
      record[task.parentTaskId] = bucket;
    });
    return record;
  }, [tasks]);

  const tasksByAssignee = useMemo(() => {
    const groups = new Map<string, { label: string; name?: string | null; email?: string | null; tasks: TaskItem[] }>();
    for (const task of filteredTasks) {
      const key = task.assigneeUserId ?? 'unassigned';
      const existing = groups.get(key);
      if (!existing) {
        const label = task.assigneeName || task.assigneeEmail || 'Non assignées';
        groups.set(key, {
          label,
          name: task.assigneeName,
          email: task.assigneeEmail,
          tasks: [task],
        });
      } else {
        existing.tasks.push(task);
      }
    }
    const list = Array.from(groups.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
    list.sort((a, b) => {
      if (a.key === 'unassigned') return -1;
      if (b.key === 'unassigned') return 1;
      return a.label.localeCompare(b.label);
    });
    return list;
  }, [filteredTasks]);

  const teamMembers = useMemo(() => {
    if (members.length) return members;
    return projectMembers.map<MemberItem>((member) => ({
      membershipId: member.membershipId,
      userId: member.user.id,
      email: member.user.email ?? '',
      name: member.user.name,
      role: member.role,
      organizationUnit: member.organizationUnit ?? null,
    }));
  }, [members, projectMembers]);

  const membersByUnit = useMemo(() => {
    const groups = new Map<string, { label: string; order: number; members: MemberItem[] }>();
    for (const member of teamMembers) {
      const unitId = member.organizationUnit?.id ?? 'none';
      const label = member.organizationUnit?.name ?? 'Sans pôle';
      const order = member.organizationUnit
        ? organizationUnits.find((unit) => unit.id === member.organizationUnit?.id)?.order ?? 0
        : Number.MAX_SAFE_INTEGER;
      const entry = groups.get(unitId) ?? { label, order, members: [] };
      entry.members.push(member);
      groups.set(unitId, entry);
    }
    const list = Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
    list.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return list;
  }, [organizationUnits, teamMembers]);

  const tasksByServiceId = useMemo(() => {
    return new Map(servicesWithTasks.map((entry) => [entry.service.id, entry.tasks]));
  }, [servicesWithTasks]);

  useEffect(() => {
    setServiceDrafts((prev) => {
      const next = { ...prev };
      const ids = new Set(services.map((svc) => svc.id));
      for (const svc of services) {
        if (!next[svc.id]) {
          next[svc.id] = {
            quantity: String(svc.quantity ?? 1),
            price: formatCentsToEuroInput(svc.priceCents),
            title: svc.titleOverride ?? '',
            description: svc.description ?? svc.notes ?? '',
            discountType: svc.discountType ?? 'NONE',
            discountValue:
              svc.discountType === 'AMOUNT'
                ? formatCentsToEuroInput(svc.discountValue)
                : svc.discountValue != null
                  ? String(svc.discountValue)
                  : '',
            billingUnit: svc.billingUnit ?? 'ONE_OFF',
            unitLabel: svc.unitLabel ?? '',
          };
        }
      }
      for (const id of Object.keys(next)) {
        if (!ids.has(id)) delete next[id];
      }
      return next;
    });
  }, [services]);

  const catalogById = useMemo(() => {
    return new Map(catalogServices.map((svc) => [svc.id, svc]));
  }, [catalogServices]);

  const catalogDurationById = useMemo(
    () => new Map(catalogServices.map((svc) => [svc.id, svc.durationHours])),
    [catalogServices]
  );

  const pricingLines = useMemo(() => {
    return services.map((svc) => {
      const draft = serviceDrafts[svc.id];
      const quantityRaw = draft?.quantity ?? String(svc.quantity ?? 1);
      const quantityNum = Number(quantityRaw);
      const quantity =
        Number.isFinite(quantityNum) && quantityNum > 0 ? Math.max(1, Math.trunc(quantityNum)) : svc.quantity ?? 1;
      const draftPriceCents = draft?.price ? parseEuroInputCents(draft.price) : null;
      const projectPriceCents = draftPriceCents ?? parseCents(svc.priceCents);
      const catalog = catalogById.get(svc.serviceId);
      const defaultPriceCents = parseCents(catalog?.defaultPriceCents ?? null);
      const tjmCents = parseCents(catalog?.tjmCents ?? null);
      const resolvedUnitCents = projectPriceCents ?? defaultPriceCents ?? tjmCents;
      const missingPrice = resolvedUnitCents == null;
      const discountType = draft?.discountType ?? svc.discountType ?? 'NONE';
      const discountValueRaw = draft?.discountValue ?? (svc.discountValue != null ? String(svc.discountValue) : '');
      const discountValue =
        discountType === 'AMOUNT'
          ? (discountValueRaw ? parseEuroInputCents(discountValueRaw) : null)
          : (() => {
              const num = discountValueRaw ? Number(discountValueRaw) : null;
              return Number.isFinite(num ?? NaN) ? Math.trunc(num ?? 0) : null;
            })();
      const applyDiscount = () => {
        if (resolvedUnitCents == null) return { final: null, original: null };
        if (discountType === 'PERCENT' && discountValue != null) {
          const bounded = Math.min(100, Math.max(0, discountValue));
          const final = Math.round(resolvedUnitCents * ((100 - bounded) / 100));
          return { final, original: resolvedUnitCents };
        }
        if (discountType === 'AMOUNT' && discountValue != null) {
          const bounded = Math.max(0, discountValue);
          const final = Math.max(0, resolvedUnitCents - bounded);
          return { final, original: resolvedUnitCents };
        }
        return { final: resolvedUnitCents, original: null };
      };
      const discounted = applyDiscount();
      const unitPriceCents = discounted.final;
      const totalCents = missingPrice || unitPriceCents == null ? 0 : unitPriceCents * quantity;
      const billingUnit = draft?.billingUnit ?? svc.billingUnit ?? 'ONE_OFF';
      let unitLabel = draft?.unitLabel ?? svc.unitLabel ?? '';
      if (billingUnit === 'MONTHLY' && !unitLabel) unitLabel = '/mois';
      return {
        id: svc.id,
        serviceId: svc.serviceId,
        quantity,
        unitPriceCents: unitPriceCents,
        originalUnitPriceCents: discounted.original,
        discountType,
        discountValue: discountValue,
        billingUnit,
        unitLabel,
        totalCents,
        missingPrice,
        priceSource: projectPriceCents
          ? 'project'
          : defaultPriceCents
            ? 'default'
            : tjmCents
              ? 'tjm'
              : 'missing',
      };
    });
  }, [catalogById, serviceDrafts, services]);

  const depositPercent = billingSettings?.defaultDepositPercent;
  const effectiveDepositPercent = Number.isFinite(depositPercent) ? Number(depositPercent) : 0;
  const vatEnabled = billingSettings?.vatEnabled ?? false;
  const vatRatePercent = billingSettings?.vatRatePercent ?? 0;

  const pricingTotals = useMemo(() => {
    const totalCents = pricingLines.reduce((sum, line) => sum + (line.totalCents || 0), 0);
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    const depositCents = Math.round(totalCents * (effectiveDepositPercent / 100));
    const balanceCents = totalCents - depositCents;
    const missingCount = pricingLines.filter((line) => line.missingPrice).length;
    return { totalCents, vatCents, totalTtcCents, depositCents, balanceCents, missingCount };
  }, [effectiveDepositPercent, pricingLines, vatEnabled, vatRatePercent]);

  const isBillingEmpty = services.length === 0;

  const missingPriceNames = useMemo(() => {
    return pricingLines
      .filter((line) => line.missingPrice)
      .map((line) => services.find((svc) => svc.id === line.id)?.service.name ?? 'Service');
  }, [pricingLines, services]);

  const billingSummary = project?.billingSummary ?? null;
  const billingReferenceId = billingSummary?.referenceQuoteId ?? project?.billingQuoteId ?? null;

  const billingReferenceQuote = useMemo(() => {
    if (billingReferenceId) {
      return quotes.find((quote) => quote.id === billingReferenceId) ?? null;
    }
    const candidates = quotes.filter((quote) => quote.status === 'SIGNED');
    const canUseLatest =
      project?.quoteStatus === 'SIGNED' || project?.quoteStatus === 'ACCEPTED';
    const pool = candidates.length ? candidates : canUseLatest ? quotes : [];
    if (!pool.length) return null;
    return pool.sort((a, b) => {
      const aDate = a.issuedAt ? new Date(a.issuedAt).getTime() : new Date(a.createdAt).getTime();
      const bDate = b.issuedAt ? new Date(b.issuedAt).getTime() : new Date(b.createdAt).getTime();
      return bDate - aDate;
    })[0];
  }, [billingReferenceId, project?.quoteStatus, quotes]);

  const summaryTotals = useMemo(() => {
    if (billingSummary) {
      const totalCents = Number(billingSummary.totalCents);
      const depositCents = Number(billingSummary.depositCents);
      const balanceCents = Number(billingSummary.balanceCents);
      const depositPercentValue = billingSummary.depositPercent;
      const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
      const totalTtcCents = totalCents + vatCents;
      return {
        totalCents,
        vatCents,
        totalTtcCents,
        depositPercent: depositPercentValue,
        depositCents,
        balanceCents,
        sourceLabel: billingSummary.source === 'QUOTE' ? 'Devis signé' : 'Services projet',
      };
    }
    const signedTotal = billingReferenceQuote ? Number(billingReferenceQuote.totalCents) : null;
    const totalCents = Number.isFinite(signedTotal ?? NaN) ? (signedTotal as number) : pricingTotals.totalCents;
    const depositPercentValue = billingReferenceQuote?.depositPercent ?? effectiveDepositPercent;
    const depositCents = billingReferenceQuote ? Number(billingReferenceQuote.depositCents) : pricingTotals.depositCents;
    const balanceCents = billingReferenceQuote ? Number(billingReferenceQuote.balanceCents) : pricingTotals.balanceCents;
    const vatCents = vatEnabled ? Math.round(totalCents * (vatRatePercent / 100)) : 0;
    const totalTtcCents = totalCents + vatCents;
    return {
      totalCents,
      vatCents,
      totalTtcCents,
      depositPercent: depositPercentValue,
      depositCents,
      balanceCents,
      sourceLabel: billingReferenceQuote ? 'Devis signé' : 'Services projet',
    };
  }, [
    billingSummary,
    billingReferenceQuote,
    effectiveDepositPercent,
    pricingTotals.balanceCents,
    pricingTotals.depositCents,
    pricingTotals.totalCents,
    vatEnabled,
    vatRatePercent,
  ]);

  const depositPercentLabel = Number.isFinite(summaryTotals.depositPercent) ? `${summaryTotals.depositPercent}%` : '—';
  const depositPaidLabel = formatDate(project?.depositPaidAt ?? null);
  const canEditDepositPaidDate = project?.depositStatus === 'PAID';
  const alreadyInvoicedCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyInvoicedCents);
    return invoices
      .filter((inv) => inv.status !== 'CANCELLED')
      .reduce((sum, inv) => sum + Number(inv.totalCents), 0);
  }, [billingSummary, invoices]);
  const alreadyPaidCents = useMemo(() => {
    if (billingSummary) return Number(billingSummary.alreadyPaidCents);
    return invoices.reduce((sum, inv) => sum + getInvoicePaidCents(inv), 0);
  }, [billingSummary, invoices]);
  const remainingToCollectCents = billingSummary
    ? Number(billingSummary.remainingToCollectCents)
    : Math.max(0, alreadyInvoicedCents - alreadyPaidCents);
  const remainingToInvoiceCents = billingSummary
    ? Number(billingSummary.remainingCents)
    : Math.max(0, summaryTotals.totalCents - alreadyInvoicedCents);

  const latestQuote = useMemo(() => {
    return quotes.reduce<QuoteItem | null>((acc, quote) => {
      if (!acc) return quote;
      const accDate = acc.issuedAt ? new Date(acc.issuedAt).getTime() : new Date(acc.createdAt).getTime();
      const quoteDate = quote.issuedAt ? new Date(quote.issuedAt).getTime() : new Date(quote.createdAt).getTime();
      return quoteDate > accDate ? quote : acc;
    }, null);
  }, [quotes]);

  const latestInvoice = useMemo(() => {
    return invoices.reduce<InvoiceItem | null>((acc, invoice) => {
      if (!acc) return invoice;
      const accDate = acc.issuedAt ? new Date(acc.issuedAt).getTime() : new Date(acc.createdAt).getTime();
      const invoiceDate = invoice.issuedAt ? new Date(invoice.issuedAt).getTime() : new Date(invoice.createdAt).getTime();
      return invoiceDate > accDate ? invoice : acc;
    }, null);
  }, [invoices]);

  const latestPdf = useMemo(() => {
    if (!latestQuote && !latestInvoice) return null;
    const quoteDate = latestQuote
      ? latestQuote.issuedAt
        ? new Date(latestQuote.issuedAt).getTime()
        : new Date(latestQuote.createdAt).getTime()
      : 0;
    const invoiceDate = latestInvoice
      ? latestInvoice.issuedAt
        ? new Date(latestInvoice.issuedAt).getTime()
        : new Date(latestInvoice.createdAt).getTime()
      : 0;
    if (latestInvoice && invoiceDate >= quoteDate) {
      return {
        url: `/api/pro/businesses/${businessId}/invoices/${latestInvoice.id}/pdf`,
        label: latestInvoice.number ?? `Facture #${latestInvoice.id}`,
      };
    }
    if (latestQuote) {
      return {
        url: `/api/pro/businesses/${businessId}/quotes/${latestQuote.id}/pdf`,
        label: latestQuote.number ?? `Devis #${latestQuote.id}`,
      };
    }
    return null;
  }, [businessId, latestInvoice, latestQuote]);

  const legalBlocks = useMemo(() => {
    const blocks = [
      { label: 'CGV', value: billingSettings?.cgvText },
      { label: 'Paiement', value: billingSettings?.paymentTermsText },
      { label: 'Pénalités', value: billingSettings?.lateFeesText },
      { label: 'Indemnité', value: billingSettings?.fixedIndemnityText },
      { label: 'Mentions', value: billingSettings?.legalMentionsText },
    ];
    const filled = blocks.filter((block) => (block.value ?? '').trim()).length;
    return { blocks, filled, total: blocks.length };
  }, [billingSettings]);
  const legalConfigured = Boolean((billingSettings?.cgvText ?? '').trim());

  const stagedMode = stagedInvoiceModal?.kind === 'FINAL' ? 'FINAL' : stagedInvoiceModal?.mode ?? 'PERCENT';
  const stagedPercentValue =
    stagedMode === 'PERCENT' ? Number(stagedInvoiceModal?.value ?? '') : null;
  const stagedAmountValue =
    stagedMode === 'AMOUNT' ? parseEuroInputCents(stagedInvoiceModal?.value ?? '') : null;
  const stagedPreviewCents =
    stagedMode === 'FINAL'
      ? remainingToInvoiceCents
      : stagedMode === 'PERCENT'
        ? Number.isFinite(stagedPercentValue ?? NaN)
          ? Math.round(summaryTotals.totalCents * ((stagedPercentValue ?? 0) / 100))
          : 0
        : stagedAmountValue ?? 0;
  const stagedPreviewTooHigh = stagedPreviewCents > remainingToInvoiceCents;

  const quoteEditStatus = quoteEditor?.status ?? null;
  const canEditQuoteLines = quoteEditStatus === 'DRAFT';
  const canEditQuoteMeta = quoteEditStatus === 'DRAFT' || quoteEditStatus === 'SENT';
  const invoiceEditStatus = invoiceEditor?.status ?? null;
  const canEditInvoiceLines = invoiceEditStatus === 'DRAFT';
  const canEditInvoiceMeta = invoiceEditStatus === 'DRAFT' || invoiceEditStatus === 'SENT';

  const invoiceByQuoteId = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      if (inv.quoteId) map.set(inv.quoteId, inv.id);
    });
    return map;
  }, [invoices]);

  const pricingByServiceId = useMemo(() => {
    return new Map(pricingLines.map((line) => [line.id, line]));
  }, [pricingLines]);

  const selectedServiceIds = useMemo(() => {
    return Object.keys(serviceSelections).filter((id) => (serviceSelections[id] ?? 0) > 0);
  }, [serviceSelections]);

  const projectValueCents = useMemo(() => {
    const raw = project?.valueCents ?? project?.billingSummary?.totalCents;
    if (raw != null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    if (services.length) return pricingTotals.totalCents;
    return null;
  }, [project?.billingSummary?.totalCents, project?.valueCents, pricingTotals.totalCents, services.length]);

  const progressPct = useMemo(() => {
    if (project?.tasksSummary) return project.tasksSummary.progressPct ?? 0;
    if (!tasks.length) return 0;
    const total = tasks.length;
    const sum = tasks.reduce(
      (acc, t) => acc + (t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0),
      0
    );
    return Math.round(sum / total);
  }, [project?.tasksSummary, tasks]);

  const kpis = useMemo(() => {
    return [
      { label: 'Avancement', value: `${Math.min(100, Math.max(0, progressPct))}%` },
      {
        label: 'Valeur',
        value: projectValueCents !== null ? formatCurrencyEUR(projectValueCents, { minimumFractionDigits: 0 }) : '—',
      },
      { label: 'Échéance', value: formatDate(project?.endDate ?? null) },
    ];
  }, [projectValueCents, progressPct, project?.endDate]);

  useEffect(() => {
    if (project) {
      setSelectedClientId(project.clientId);
      setStartDateInput(project.startDate ? project.startDate.slice(0, 10) : '');
      setEndDateInput(project.endDate ? project.endDate.slice(0, 10) : '');
    }
  }, [project]);

  useEffect(() => {
    if (activeSetupModal === 'client') {
      setModalError(null);
      void loadClients();
    } else if (activeSetupModal === 'services') {
      setModalError(null);
      void loadCatalogServices();
      void loadMembers();
    } else if (activeSetupModal === 'team') {
      setModalError(null);
      void loadMembers();
    } else if (activeSetupModal === 'tasks') {
      setModalError(null);
      void loadMembers();
      void loadTasks();
    } else if (activeSetupModal === 'documents') {
      setModalError(null);
      if (project?.clientId) {
        void loadDocuments(project.clientId);
      }
    }
  }, [activeSetupModal, loadClients, loadCatalogServices, loadMembers, loadTasks, loadDocuments, project?.clientId]);

  useEffect(() => {
    if (!accessModalOpen) return;
    setAccessInfo(null);
    void loadMembers();
    void loadProjectMembers();
  }, [accessModalOpen, loadMembers, loadProjectMembers]);

  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitErrors(null);
    void loadOrganizationUnits();
    void loadMembers();
  }, [unitsModalOpen, loadOrganizationUnits, loadMembers]);

  useEffect(() => {
    if (!unitsModalOpen) return;
    setUnitDrafts(
      organizationUnits.reduce<Record<string, { name: string; order: string }>>((acc, unit) => {
        acc[unit.id] = { name: unit.name, order: String(unit.order ?? 0) };
        return acc;
      }, {})
    );
  }, [organizationUnits, unitsModalOpen]);

  useEffect(() => {
    if (!generateTasksOnAdd) return;
    const selectedIds = Object.keys(serviceSelections);
    selectedIds.forEach((serviceId) => {
      if (!serviceTemplates[serviceId] && !templatesLoading[serviceId]) {
        void loadServiceTemplates(serviceId);
      }
    });
  }, [generateTasksOnAdd, serviceSelections, serviceTemplates, templatesLoading, loadServiceTemplates]);

  async function handleAttachClient() {
    if (!selectedClientId) {
      setModalError('Sélectionne un client.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({ clientId: selectedClientId });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de lier le client.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleUpdateDates() {
    if (startDateInput && endDateInput && new Date(endDateInput) < new Date(startDateInput)) {
      setModalError('La fin doit être après le début.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({
      startDate: startDateInput || null,
      endDate: endDateInput || null,
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de mettre à jour les dates.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleAddServices() {
    if (!isAdmin) {
      setModalError('Réservé aux admins/owners.');
      return;
    }
    const entries = Object.entries(serviceSelections).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      setModalError('Sélectionne au moins un service.');
      return;
    }
    const dueOffset =
      taskDueOffsetDays.trim() === ''
        ? null
        : Number.isFinite(Number(taskDueOffsetDays))
          ? Math.trunc(Number(taskDueOffsetDays))
          : null;
    if (dueOffset !== null && (dueOffset < 0 || dueOffset > 365)) {
      setModalError('Décalage jours invalide (0-365).');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [serviceId, qty] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serviceId,
              quantity: qty,
              generateTasks: generateTasksOnAdd,
              ...(generateTasksOnAdd && taskAssigneeId ? { taskAssigneeUserId: taskAssigneeId } : {}),
              ...(generateTasksOnAdd && dueOffset !== null ? { taskDueOffsetDays: dueOffset } : {}),
            }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur service');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickCreateService() {
    if (!isAdmin) {
      setQuickServiceError('Réservé aux admins/owners.');
      return;
    }
    const name = quickServiceDraft.name.trim();
    if (!name) {
      setQuickServiceError('Nom requis.');
      return;
    }
    const priceCents = parseEuroToCents(quickServiceDraft.price);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      setQuickServiceError('Prix invalide.');
      return;
    }
    const code =
      quickServiceDraft.code.trim() ||
      `SER-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    setQuickServiceSaving(true);
    setQuickServiceError(null);
    try {
      const createRes = await fetchJson<{ item: { id: string } }>(`/api/pro/businesses/${businessId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          defaultPriceCents: priceCents,
        }),
      });
      if (!createRes.ok || !createRes.data?.item?.id) {
        throw new Error(createRes.error ?? 'Création du service impossible.');
      }
      const createdId = createRes.data.item.id;
      const addRes = await fetchJson(`/api/pro/businesses/${businessId}/projects/${projectId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: createdId,
          quantity: 1,
          billingUnit: quickServiceDraft.billingUnit,
          unitLabel: quickServiceDraft.billingUnit === 'MONTHLY' ? '/mois' : null,
          generateTasks: false,
        }),
      });
      if (!addRes.ok) {
        throw new Error(addRes.error ?? 'Ajout du service impossible.');
      }
      setQuickServiceDraft({ name: '', code: '', price: '', billingUnit: 'ONE_OFF' });
      await refetchAll();
      await loadCatalogServices('');
      setBillingInfo('Service ajouté au projet.');
      closeModal();
    } catch (err) {
      setQuickServiceError(getErrorMessage(err));
    } finally {
      setQuickServiceSaving(false);
    }
  }

  async function handleApplyServiceTemplates(projectServiceId: string) {
    if (!isAdmin) {
      setBillingError('Réservé aux admins/owners.');
      return;
    }
    const dueOffset =
      taskDueOffsetDays.trim() === ''
        ? null
        : Number.isFinite(Number(taskDueOffsetDays))
          ? Math.trunc(Number(taskDueOffsetDays))
          : null;
    if (dueOffset !== null && (dueOffset < 0 || dueOffset > 365)) {
      setBillingError('Décalage jours invalide (0-365).');
      return;
    }
    setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: true }));
    setBillingError(null);
    try {
      const res = await fetchJson(
        `/api/pro/businesses/${businessId}/projects/${projectId}/services/${projectServiceId}/tasks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(taskAssigneeId ? { taskAssigneeUserId: taskAssigneeId } : {}),
            ...(dueOffset !== null ? { taskDueOffsetDays: dueOffset } : {}),
          }),
        }
      );
      if (!res.ok) {
        setBillingError(res.error ?? 'Impossible de générer les tâches.');
        return;
      }
      await loadTasks();
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setTemplatesApplying((prev) => ({ ...prev, [projectServiceId]: false }));
    }
  }

  async function handleAssignTasks() {
    const entries = Object.entries(taskAssignments).filter(([, memberId]) => memberId);
    if (!entries.length) {
      setModalError('Aucune assignation sélectionnée.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [taskId, memberId] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assigneeUserId: memberId }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur assignation');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteMember() {
    if (!inviteEmail) {
      setModalError('Email requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Invitation impossible.');
      return;
    }
    const inviteId = `invite-${inviteEmail}`;
    setMembers((prev) => [
      ...prev,
      { membershipId: inviteId, userId: inviteId, email: inviteEmail, role: inviteRole, name: null, organizationUnit: null },
    ]);
    await refetchAll();
    closeModal();
  }

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
      setAccessInfo(res.error ?? "Impossible d'ajouter l'acc\u00e8s.");
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
      setAccessInfo(res.error ?? "Impossible de retirer l'acc\u00e8s.");
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

  async function handleUploadDocument() {
    if (!project?.clientId) {
      setModalError('Associe un client avant de déposer un document.');
      return;
    }
    if (!documentFile) {
      setModalError('Choisis un fichier.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const form = new FormData();
      form.append('file', documentFile);
      form.append('title', `${documentKind} - ${documentFile.name}`);
      const res = await fetch(`/api/pro/businesses/${businessId}/clients/${project.clientId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error ?? 'Upload impossible.';
        throw new Error(msg);
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <EmptyState title="Chargement..." description="Nous récupérons le projet." />;
  }
  if (error || !project) {
    return (
      <EmptyState
        title="Projet introuvable"
        description={error ?? 'Ce projet est indisponible.'}
        action={
          <Button asChild>
            <Link href={`/app/pro/${businessId}/projects`}>Retour aux projets</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className={UI.page}>
      <SectionCard>
        <div className="flex flex-col gap-5">
          <StickyHeaderActions>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href={`/app/pro/${businessId}/projects`}>
                <ArrowLeft size={16} />
                Retour
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>Modifier</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=billing`}>Facturation</Link>
              </Button>
              {latestPdf ? (
                <Button asChild size="sm" variant="outline">
                  <a href={latestPdf.url} target="_blank" rel="noreferrer">
                    Dernier PDF
                  </a>
                </Button>
              ) : null}
            </div>
          </StickyHeaderActions>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {project.name ?? `Projet #${projectId}`}
                </h1>
                <Badge variant="neutral">{statusLabel}</Badge>
                {showScopeBadge ? <Badge variant={scopeVariant}>{scopeLabel}</Badge> : null}
                {project.archivedAt ? <Badge variant="performance">Archivé</Badge> : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <MetaItem
                  label="Client"
                  value={
                    project.clientName && project.clientId ? (
                      <Link
                        href={`/app/pro/${businessId}/clients/${project.clientId}`}
                        className="font-medium text-[var(--text-primary)] hover:underline"
                      >
                        {project.clientName}
                      </Link>
                    ) : (
                      project.clientName ?? 'Non renseigné'
                    )
                  }
                />
                <MetaItem
                  label="Dates"
                  value={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`}
                />
                <MetaItem label="Dernière mise à jour" value={formatDate(project.updatedAt)} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {kpis.map((item) => (
                <StatCard key={item.label} label={item.label} value={String(item.value)} />
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {isOverdue ? (
        <SectionCard className="border-rose-200/70 bg-rose-50/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Date de fin dépassée</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Terminer le projet ou repousser la fin.
              </p>
            </div>
            <Badge variant="performance">En retard</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleMarkCompleted}
              disabled={!isAdmin || markingCompleted}
            >
              {markingCompleted ? 'Traitement…' : 'Marquer terminé'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!isAdmin) {
                  setActionError('Réservé aux admins/owners.');
                  return;
                }
                setActionError(null);
                setActiveSetupModal('deadline');
              }}
              disabled={!isAdmin || markingCompleted}
            >
              Repousser
            </Button>
          </div>
          {!isAdmin ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>
          ) : null}
          {actionError ? <p className="mt-2 text-xs text-rose-500">{actionError}</p> : null}
        </SectionCard>
      ) : null}

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Onglets projet"
        className="rounded-2xl bg-[var(--surface)]/70 p-2"
      />

      {activeTab === 'overview' ? (
        <OverviewTab
          showSetup={showSetup}
          checklistItems={checklistItems}
          onChecklistAction={(key) => setActiveSetupModal(key as typeof activeSetupModal)}
          servicesWithTasks={servicesWithTasks}
          servicesOverview={servicesOverview}
          showServicesToggle={showServicesToggle}
          showAllServicesOverview={showAllServicesOverview}
          onToggleServicesOverview={() => setShowAllServicesOverview((prev) => !prev)}
          upcomingTasks={upcomingTasks}
          upcomingTasksOverview={upcomingTasksOverview}
          showActionsToggle={showActionsToggle}
          showAllActionsOverview={showAllActionsOverview}
          onToggleActionsOverview={() => setShowAllActionsOverview((prev) => !prev)}
          projectMembersPreview={projectMembersPreview}
          projectMembersOverflow={projectMembersOverflow}
          isAdmin={isAdmin}
          accessInfo={accessInfo}
          onOpenAccessModal={() => setAccessModalOpen(true)}
          activityOverview={activityOverview}
          showActivityToggle={showActivityToggle}
          showAllActivity={showAllActivity}
          onToggleActivity={() => setShowAllActivity((prev) => !prev)}
          businessId={businessId}
          projectId={projectId}
        />
      ) : null}

      {activeTab === 'work' ? (
        <WorkTab
          tasksByAssignee={tasksByAssignee}
          subtasksByParentId={subtasksByParentId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          taskGroupExpanded={taskGroupExpanded}
          onTaskGroupToggle={(key, expanded) =>
            setTaskGroupExpanded((prev) => ({ ...prev, [key]: expanded }))
          }
          taskRowExpanded={taskRowExpanded}
          onTaskRowToggle={(taskId, expanded) =>
            setTaskRowExpanded((prev) => ({ ...prev, [taskId]: expanded }))
          }
          businessId={businessId}
          projectId={projectId}
        />
      ) : null}

      {activeTab === 'team' ? (
        <TeamTab
          membersByUnit={membersByUnit}
          teamInfo={teamInfo}
          isAdmin={isAdmin}
          onOpenUnitsModal={() => setUnitsModalOpen(true)}
          businessId={businessId}
        />
      ) : null}

      {activeTab === 'billing' ? (
        <BillingTab
          billingError={billingError}
          billingInfo={billingInfo}
          isAdmin={isAdmin}
          isBillingEmpty={isBillingEmpty}
          businessId={businessId}
          summaryTotals={summaryTotals}
          depositPercentLabel={depositPercentLabel}
          depositPaidLabel={depositPaidLabel}
          canEditDepositPaidDate={canEditDepositPaidDate}
          alreadyPaidCents={alreadyPaidCents}
          alreadyInvoicedCents={alreadyInvoicedCents}
          remainingToInvoiceCents={remainingToInvoiceCents}
          remainingToCollectCents={remainingToCollectCents}
          vatEnabled={vatEnabled}
          billingSettingsPaymentTermsDays={billingSettings?.paymentTermsDays}
          showSummaryDetails={showSummaryDetails}
          projectQuoteStatus={project?.quoteStatus}
          projectDepositStatus={project?.depositStatus}
          creatingQuote={creatingQuote}
          prestationsDraft={prestationsDraft}
          prestationsSaving={prestationsSaving}
          prestationsDirty={prestationsDirty}
          prestationsError={prestationsError}
          services={services}
          pricingTotals={pricingTotals}
          missingPriceNames={missingPriceNames}
          serviceDrafts={serviceDrafts}
          lineErrors={lineErrors}
          lineSavingId={lineSavingId}
          dragOverServiceId={dragOverServiceId}
          draggingServiceId={draggingServiceId}
          pricingByServiceId={pricingByServiceId}
          catalogDurationById={catalogDurationById}
          tasksByServiceId={tasksByServiceId}
          openServiceTasks={openServiceTasks}
          openNotes={openNotes}
          templatesApplying={templatesApplying}
          recurringInvoiceActionId={recurringInvoiceActionId}
          reordering={reordering}
          members={members}
          taskUpdating={taskUpdating}
          setServiceDrafts={setServiceDrafts}
          setLineErrors={setLineErrors}
          setOpenNotes={setOpenNotes}
          setOpenServiceTasks={setOpenServiceTasks}
          quotes={quotes}
          quoteActionId={quoteActionId}
          invoiceActionId={invoiceActionId}
          invoiceByQuoteId={invoiceByQuoteId}
          billingReferenceId={billingReferenceId}
          referenceUpdatingId={referenceUpdatingId}
          invoices={invoices}
          legalConfigured={legalConfigured}
          legalBlocks={legalBlocks}
          onCreateQuote={handleCreateQuote}
          onOpenStagedInvoiceModal={openStagedInvoiceModal}
          onToggleSummaryDetails={() => setShowSummaryDetails((prev) => !prev)}
          onOpenDepositDateModal={() => {
            setDateModalError(null);
            setDepositDateEditorOpen(true);
          }}
          onPrestationsDraftChange={setPrestationsDraft}
          onSavePrestations={handleSavePrestations}
          onServiceDragStart={handleServiceDragStart}
          onServiceDragOver={handleServiceDragOver}
          onServiceDrop={handleServiceDrop}
          onServiceDragEnd={handleServiceDragEnd}
          onDeleteService={handleDeleteService}
          onUpdateService={handleUpdateService}
          onApplyServiceTemplates={handleApplyServiceTemplates}
          onGenerateRecurringInvoice={handleGenerateRecurringInvoice}
          onUpdateTask={updateTask}
          onOpenQuoteWizard={openQuoteWizard}
          onOpenAddServicesModal={() => setActiveSetupModal('services')}
          onOpenQuoteEditor={openQuoteEditor}
          onOpenQuoteDateModal={openQuoteDateModal}
          onSetBillingReference={handleSetBillingReference}
          onQuoteStatus={handleQuoteStatus}
          onOpenCancelQuoteModal={openCancelQuoteModal}
          onCreateInvoice={handleCreateInvoice}
          onDeleteQuote={handleDeleteQuote}
          onOpenPaymentModal={openPaymentModal}
          onOpenInvoiceEditor={openInvoiceEditor}
          onOpenInvoiceDateModal={openInvoiceDateModal}
          onInvoiceStatus={handleInvoiceStatus}
          onDeleteInvoice={handleDeleteInvoice}
        />
      ) : null}

      {activeTab === 'files' ? (
        <FilesTab
          quotes={quotes}
          invoices={invoices}
          businessId={businessId}
          projectId={projectId}
        />
      ) : null}

      <StagedInvoiceModal
        editor={stagedInvoiceModal}
        totalCents={summaryTotals.totalCents}
        remainingCents={remainingToInvoiceCents}
        previewCents={stagedPreviewCents}
        previewTooHigh={stagedPreviewTooHigh}
        error={stagedInvoiceError}
        loading={stagedInvoiceLoading}
        isAdmin={isAdmin}
        onClose={closeStagedInvoiceModal}
        onModeChange={(mode) =>
          setStagedInvoiceModal((prev) =>
            prev ? { ...prev, mode } : prev
          )
        }
        onValueChange={(value) =>
          setStagedInvoiceModal((prev) =>
            prev
              ? {
                  ...prev,
                  value: prev.mode === 'AMOUNT' ? sanitizeEuroInput(value) : value,
                }
              : prev
          )
        }
        onCreate={handleCreateStagedInvoice}
      />

      <QuoteEditorModal
        editor={quoteEditor}
        isAdmin={isAdmin}
        canEditMeta={canEditQuoteMeta}
        canEditLines={canEditQuoteLines}
        editing={quoteEditing}
        error={quoteEditError}
        onClose={closeQuoteEditor}
        onSave={handleSaveQuoteEdit}
        onAddLine={addQuoteLine}
        onRemoveLine={removeQuoteLine}
        onChangeIssuedAt={(value) => setQuoteEditor((prev) => (prev ? { ...prev, issuedAt: value } : prev))}
        onChangeExpiresAt={(value) => setQuoteEditor((prev) => (prev ? { ...prev, expiresAt: value } : prev))}
        onChangeNote={(value) => setQuoteEditor((prev) => (prev ? { ...prev, note: value } : prev))}
        onChangeLine={(lineId, patch) =>
          setQuoteEditor((prev) =>
            prev
              ? {
                  ...prev,
                  lines: prev.lines.map((line) =>
                    line.id === lineId
                      ? {
                          ...line,
                          ...patch,
                          unitPrice:
                            patch.unitPrice != null
                              ? sanitizeEuroInput(patch.unitPrice)
                              : line.unitPrice,
                        }
                      : line
                  ),
                }
              : prev
          )
        }
      />

      <InvoiceEditorModal
        editor={invoiceEditor}
        isAdmin={isAdmin}
        canEditMeta={canEditInvoiceMeta}
        canEditLines={canEditInvoiceLines}
        editing={invoiceEditing}
        error={invoiceEditError}
        onClose={closeInvoiceEditor}
        onSave={handleSaveInvoiceEdit}
        onAddLine={addInvoiceLine}
        onRemoveLine={removeInvoiceLine}
        onChangeIssuedAt={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, issuedAt: value } : prev))}
        onChangeDueAt={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, dueAt: value } : prev))}
        onChangeNote={(value) => setInvoiceEditor((prev) => (prev ? { ...prev, note: value } : prev))}
        onChangeLine={(lineId, patch) =>
          setInvoiceEditor((prev) =>
            prev
              ? {
                  ...prev,
                  lines: prev.lines.map((line) =>
                    line.id === lineId
                      ? {
                          ...line,
                          ...patch,
                          unitPrice:
                            patch.unitPrice != null
                              ? sanitizeEuroInput(patch.unitPrice)
                              : line.unitPrice,
                        }
                      : line
                  ),
                }
              : prev
          )
        }
      />

      <QuoteDateModal
        editor={quoteDateEditor}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangeSignedAt={(value) => setQuoteDateEditor((prev) => (prev ? { ...prev, signedAt: value } : prev))}
        onClose={() => setQuoteDateEditor(null)}
        onSave={handleSaveQuoteDate}
      />

      <CancelQuoteModal
        editor={cancelQuoteEditor}
        isAdmin={isAdmin}
        saving={cancelQuoteSaving}
        error={cancelQuoteError}
        onChangeReason={(value) => setCancelQuoteEditor((prev) => (prev ? { ...prev, reason: value } : prev))}
        onClose={() => setCancelQuoteEditor(null)}
        onConfirm={handleCancelQuote}
      />

      <InvoiceDateModal
        editor={invoiceDateEditor}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangePaidAt={(value) => setInvoiceDateEditor((prev) => (prev ? { ...prev, paidAt: value } : prev))}
        onClose={() => setInvoiceDateEditor(null)}
        onSave={handleSaveInvoiceDate}
      />

      <QuoteWizardModal
        open={quoteWizardOpen}
        onClose={closeQuoteWizard}
        step={quoteWizardStep}
        onStepChange={setQuoteWizardStep}
        lines={quoteWizardLines}
        search={quoteWizardSearch}
        onSearchChange={setQuoteWizardSearch}
        generateTasks={quoteWizardGenerateTasks}
        onGenerateTasksChange={setQuoteWizardGenerateTasks}
        assigneeId={quoteWizardAssigneeId}
        onAssigneeIdChange={setQuoteWizardAssigneeId}
        dueOffsetDays={quoteWizardDueOffsetDays}
        onDueOffsetDaysChange={setQuoteWizardDueOffsetDays}
        error={quoteWizardError}
        info={quoteWizardInfo}
        saving={quoteWizardSaving}
        result={quoteWizardResult}
        lineValidation={wizardLineValidation}
        canContinue={wizardCanContinue}
        catalogResults={catalogSearchResults}
        serviceTemplates={serviceTemplates}
        templatesLoading={templatesLoading}
        members={members}
        isAdmin={isAdmin}
        onAddCatalogLine={addCatalogLine}
        onAddCustomLine={addCustomLine}
        onRemoveLine={removeWizardLine}
        onUpdateLine={updateWizardLine}
        onLoadCatalogServices={loadCatalogServices}
        onGenerate={handleWizardGenerateQuote}
        onGoToBilling={() => setActiveTab('billing')}
        onOpenDepositInvoice={() => openStagedInvoiceModal('DEPOSIT')}
      />

      <PaymentModal
        open={Boolean(paymentModal)}
        invoice={activePaymentInvoice}
        totalCents={paymentTotalCents}
        paidCents={paymentPaidCents}
        remainingCents={paymentRemainingCents}
        notice={paymentNotice}
        loading={paymentLoading}
        items={paymentItems}
        isAdmin={isAdmin}
        deletingId={paymentDeletingId}
        form={paymentForm}
        saving={paymentSaving}
        error={paymentError}
        onClose={closePaymentModal}
        onDeletePayment={handleDeletePayment}
        onFormChange={(patch) =>
          setPaymentForm((prev) => ({
            ...prev,
            ...patch,
            amount: patch.amount != null ? sanitizeEuroInput(patch.amount) : prev.amount,
          }))
        }
        onApplyShortcut={applyPaymentShortcut}
        onSave={handleSavePayment}
      />

      <DepositDateModal
        open={depositDateEditorOpen}
        depositStatus={project?.depositStatus}
        paidAt={depositPaidDraft}
        isAdmin={isAdmin}
        saving={dateModalSaving}
        error={dateModalError}
        onChangePaidAt={setDepositPaidDraft}
        onClose={() => setDepositDateEditorOpen(false)}
        onSave={handleSaveDepositDate}
      />

      <SetupModals
        activeSetupModal={activeSetupModal}
        accessModalOpen={accessModalOpen}
        unitsModalOpen={unitsModalOpen}
        isAdmin={isAdmin}
        saving={saving}
        modalError={modalError}
        hasClientId={Boolean(project?.clientId)}
        clients={clients}
        clientSearch={clientSearch}
        selectedClientId={selectedClientId}
        setClientSearch={setClientSearch}
        setSelectedClientId={setSelectedClientId}
        onLoadClients={(search) => void loadClients(search)}
        onAttachClient={handleAttachClient}
        startDateInput={startDateInput}
        endDateInput={endDateInput}
        setStartDateInput={setStartDateInput}
        setEndDateInput={setEndDateInput}
        onUpdateDates={handleUpdateDates}
        catalogSearchResults={catalogSearchResults}
        serviceSearch={serviceSearch}
        serviceSelections={serviceSelections}
        generateTasksOnAdd={generateTasksOnAdd}
        taskAssigneeId={taskAssigneeId}
        taskDueOffsetDays={taskDueOffsetDays}
        serviceTemplates={serviceTemplates}
        templatesLoading={templatesLoading}
        selectedServiceIds={selectedServiceIds}
        quickServiceDraft={quickServiceDraft}
        quickServiceSaving={quickServiceSaving}
        quickServiceError={quickServiceError}
        services={services}
        setServiceSearch={setServiceSearch}
        setServiceSelections={setServiceSelections}
        setGenerateTasksOnAdd={setGenerateTasksOnAdd}
        setTaskAssigneeId={setTaskAssigneeId}
        setTaskDueOffsetDays={setTaskDueOffsetDays}
        setQuickServiceDraft={setQuickServiceDraft}
        members={members}
        onLoadCatalogServices={loadCatalogServices}
        onAddServices={handleAddServices}
        onQuickCreateService={handleQuickCreateService}
        tasks={tasks}
        taskAssignments={taskAssignments}
        setTaskAssignments={setTaskAssignments}
        onUpdateTaskDueDate={updateTaskDueDate}
        onAssignTasks={handleAssignTasks}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        setInviteEmail={setInviteEmail}
        setInviteRole={setInviteRole}
        onInviteMember={handleInviteMember}
        documentKind={documentKind}
        setDocumentKind={setDocumentKind}
        setDocumentFile={setDocumentFile}
        onUploadDocument={handleUploadDocument}
        projectMembers={projectMembers}
        availableMembers={availableMembers}
        accessInfo={accessInfo}
        onAddProjectMember={handleAddProjectMember}
        onRemoveProjectMember={handleRemoveProjectMember}
        organizationUnits={organizationUnits}
        unitDraftName={unitDraftName}
        unitDraftOrder={unitDraftOrder}
        unitErrors={unitErrors}
        teamInfo={teamInfo}
        unitDrafts={unitDrafts}
        setUnitDraftName={setUnitDraftName}
        setUnitDraftOrder={setUnitDraftOrder}
        setUnitDrafts={setUnitDrafts}
        onCreateUnit={handleCreateUnit}
        onUpdateUnit={handleUpdateUnit}
        onDeleteUnit={handleDeleteUnit}
        onAssignMemberToUnit={handleAssignMemberToUnit}
        onCloseModal={closeModal}
        onCloseAccessModal={() => setAccessModalOpen(false)}
        onCloseUnitsModal={() => setUnitsModalOpen(false)}
      />
    </div>
  );
}
