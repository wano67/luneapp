"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TabsPills } from '@/components/pro/TabsPills';
import {
  UI,
  formatDate,
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
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { QuoteWizardModal } from '@/components/pro/projects/modals/QuoteWizardModal';
import { QuoteDateModal } from '@/components/pro/projects/modals/QuoteDateModal';
import { CancelQuoteModal } from '@/components/pro/projects/modals/CancelQuoteModal';
import { InvoiceDateModal } from '@/components/pro/projects/modals/InvoiceDateModal';
import { DepositDateModal } from '@/components/pro/projects/modals/DepositDateModal';
import { StagedInvoiceModal } from '@/components/pro/projects/modals/StagedInvoiceModal';
import { PaymentModal } from '@/components/pro/projects/modals/PaymentModal';
import { QuoteEditorModal } from '@/components/pro/projects/modals/QuoteEditorModal';
import { InvoiceEditorModal } from '@/components/pro/projects/modals/InvoiceEditorModal';
import { FilesTab } from '@/components/pro/projects/tabs/FilesTab';
import { WorkTab } from '@/components/pro/projects/tabs/WorkTab';
import { TeamTab } from '@/components/pro/projects/tabs/TeamTab';
import { SetupModals } from '@/components/pro/projects/modals/SetupModals';
import { useQuoteWizard } from '@/components/pro/projects/hooks/useQuoteWizard';
import { usePaymentModal } from '@/components/pro/projects/hooks/usePaymentModal';
import { useProjectDataLoaders } from '@/components/pro/projects/hooks/useProjectDataLoaders';
import { useBillingHandlers } from '@/components/pro/projects/hooks/useBillingHandlers';
import { useTeamManagement } from '@/components/pro/projects/hooks/useTeamManagement';
import { useServiceManagement } from '@/components/pro/projects/hooks/useServiceManagement';
import { useProjectSetupModals } from '@/components/pro/projects/hooks/useProjectSetupModals';
import { useTaskHandlers } from '@/components/pro/projects/hooks/useTaskHandlers';
import { useDocumentUpload } from '@/components/pro/projects/hooks/useDocumentUpload';
import { useMessaging } from '@/components/pro/projects/hooks/useMessaging';
import { usePricingEngine } from '@/components/pro/projects/hooks/usePricingEngine';
import { ProjectHeaderSection } from '@/components/pro/projects/ProjectHeaderSection';

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


const tabs = [
  { key: 'overview', label: "Vue d\u2019ensemble" },
  { key: 'work', label: 'Travail' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'files', label: 'Documents' },
];



function getInvoicePaidCents(invoice: InvoiceItem): number {
  const paid = invoice.paidCents != null ? Number(invoice.paidCents) : NaN;
  if (Number.isFinite(paid)) return paid;
  return invoice.status === 'PAID' ? Number(invoice.totalCents) : 0;
}


const OVERVIEW_PREVIEW_COUNT = 3;
const OVERVIEW_ACTIVITY_COUNT = 5;
const OVERVIEW_MEMBERS_COUNT = 6;

export function ProjectWorkspace({ businessId, projectId }: { businessId: string; projectId: string }) {
  const searchParams = useSearchParams();
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'team' | 'billing' | 'files'>('overview');
  const [statusFilter, setStatusFilter] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'all'>('all');
  const [showAllServicesOverview, setShowAllServicesOverview] = useState(false);
  const [showAllActionsOverview, setShowAllActionsOverview] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);

  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);



  const {
    project,
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
    loadProject,
    loadServices,
    loadTasks,
    loadMembers,
    loadProjectMembers,
    loadOrganizationUnits,
    loadActivity,
    loadDocuments,
    loadProjectDocuments,
    projectDocuments,
    loadQuotes,
    loadInvoices,
    loadClients,
    loadCatalogServices,
    loadServiceTemplates,
    refetchAll,
  } = useProjectDataLoaders({
    businessId,
    projectId,
    onBillingError: setBillingError,
  });

  const {
    taskGroupExpanded,
    setTaskGroupExpanded,
    taskRowExpanded,
    setTaskRowExpanded,
    openServiceTasks,
    setOpenServiceTasks,
    taskUpdating,
    templatesApplying,
    updateTaskDueDate,
    updateTask,
    createTask,
    deleteTask,
    handleApplyServiceTemplates: applyServiceTemplatesRaw,
  } = useTaskHandlers({
    businessId,
    projectId,
    isAdmin,
    loadTasks,
    loadActivity,
    onBillingError: setBillingError,
  });

  const {
    uploading: docUploading,
    uploadDocument,
    deleteDocument,
  } = useDocumentUpload({
    businessId,
    projectId,
    loadProjectDocuments,
    onError: setBillingError,
  });

  // Current user ID for messaging
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchJson<{ user: { id: string } }>('/api/auth/me').then((res) => {
      if (!cancelled && res.ok && res.data?.user?.id) {
        setCurrentUserId(String(res.data.user.id));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const messaging = useMessaging({
    businessId,
    projectId,
    enabled: activeTab === 'team' && !!currentUserId,
    onError: setBillingError,
  });




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

  const {
    accessModalOpen,
    setAccessModalOpen,
    accessInfo,
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
    handleAddProjectMember,
    handleRemoveProjectMember,
    handleCreateUnit,
    handleUpdateUnit,
    handleDeleteUnit,
    handleAssignMemberToUnit,
  } = useTeamManagement({
    businessId,
    projectId,
    isAdmin,
    organizationUnits,
    loadMembers,
    loadProjectMembers,
    loadOrganizationUnits,
  });

  const patchProject = async (body: Record<string, unknown>) => {
    return fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const {
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
    handleSavePrestations,
    handleServiceDragStart,
    handleServiceDragOver,
    handleServiceDrop,
    handleServiceDragEnd,
    handleUpdateService,
    handleDeleteService,
  } = useServiceManagement({
    businessId,
    projectId,
    isAdmin,
    services,
    setServices,
    loadServices,
    refetchAll,
    patchProject,
    loadProject,
    projectPrestationsText: project?.prestationsText,
    onBillingInfo: setBillingInfo,
    onBillingError: setBillingError,
  });

  const {
    activeSetupModal,
    setActiveSetupModal,
    saving,
    modalError,
    selectedClientId,
    setSelectedClientId,
    startDateInput,
    setStartDateInput,
    endDateInput,
    setEndDateInput,
    serviceSelections,
    setServiceSelections,
    quickServiceDraft,
    setQuickServiceDraft,
    quickServiceSaving,
    quickServiceError,
    taskAssignments,
    setTaskAssignments,
    generateTasksOnAdd,
    setGenerateTasksOnAdd,
    taskAssigneeId,
    setTaskAssigneeId,
    taskDueOffsetDays,
    setTaskDueOffsetDays,
    inviteEmail,
    setInviteEmail,
    inviteRole,
    setInviteRole,
    documentKind,
    setDocumentKind,
    setDocumentFile,
    clientSearch,
    setClientSearch,
    serviceSearch,
    setServiceSearch,
    selectedServiceIds,
    closeModal,
    handleAttachClient,
    handleUpdateDates,
    handleAddServices,
    handleQuickCreateService,
    handleAssignTasks,
    handleInviteMember,
    handleUploadDocument,
  } = useProjectSetupModals({
    businessId,
    projectId,
    isAdmin,
    projectClientId: project?.clientId ?? null,
    projectStartDate: project?.startDate ?? null,
    projectEndDate: project?.endDate ?? null,
    clients,
    catalogSearchResults,
    serviceTemplates,
    templatesLoading,
    members,
    tasks,
    services,
    patchProject,
    refetchAll,
    loadClients,
    loadCatalogServices,
    loadMembers,
    loadTasks,
    loadDocuments,
    loadServiceTemplates,
    setMembers,
    onBillingInfo: setBillingInfo,
    onBillingError: setBillingError,
  });

  const handleApplyServiceTemplates = (projectServiceId: string) =>
    applyServiceTemplatesRaw(projectServiceId, taskAssigneeId, taskDueOffsetDays);

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

  const {
    catalogDurationById,
    pricingLines,
    pricingTotals,
    isBillingEmpty,
    missingPriceNames,
    effectiveDepositPercent,
    vatEnabled,
    vatRatePercent,
  } = usePricingEngine({
    services,
    serviceDrafts,
    setServiceDrafts,
    catalogServices,
    billingSettings,
  });

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

  const {
    quoteEditor,
    setQuoteEditor,
    invoiceEditor,
    setInvoiceEditor,
    quoteEditError,
    invoiceEditError,
    quoteEditing,
    invoiceEditing,
    stagedInvoiceModal,
    setStagedInvoiceModal,
    stagedInvoiceError,
    stagedInvoiceLoading,
    creatingQuote,
    quoteActionId,
    invoiceActionId,
    recurringInvoiceActionId,
    referenceUpdatingId,
    quoteDateEditor,
    setQuoteDateEditor,
    cancelQuoteEditor,
    setCancelQuoteEditor,
    cancelQuoteError,
    cancelQuoteSaving,
    invoiceDateEditor,
    setInvoiceDateEditor,
    depositDateEditorOpen,
    setDepositDateEditorOpen,
    depositPaidDraft,
    setDepositPaidDraft,
    dateModalError,
    setDateModalError,
    dateModalSaving,
    handleCreateQuote,
    openCancelQuoteModal,
    handleCancelQuote,
    handleSetBillingReference,
    handleQuoteStatus,
    handleCreateInvoice,
    handleGenerateRecurringInvoice,
    openStagedInvoiceModal,
    closeStagedInvoiceModal,
    handleCreateStagedInvoice,
    handleInvoiceStatus,
    openQuoteDateModal,
    openInvoiceDateModal,
    handleSaveQuoteDate,
    handleSaveInvoiceDate,
    handleSaveDepositDate,
    openQuoteEditor,
    closeQuoteEditor,
    addQuoteLine,
    removeQuoteLine,
    handleSaveQuoteEdit,
    handleDeleteQuote,
    openInvoiceEditor,
    closeInvoiceEditor,
    addInvoiceLine,
    removeInvoiceLine,
    handleSaveInvoiceEdit,
    handleDeleteInvoice,
  } = useBillingHandlers({
    businessId,
    projectId,
    isAdmin,
    projectDepositPaidAt: project?.depositPaidAt,
    servicesLength: services.length,
    pricingMissingCount: pricingTotals.missingCount,
    summaryTotals,
    remainingToInvoiceCents,
    loadQuotes,
    loadInvoices,
    loadProject,
    refetchAll,
    onBillingError: setBillingError,
    onBillingInfo: setBillingInfo,
  });

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
    stagedMode === 'AMOUNT' ? (() => { const c = parseEuroToCents(stagedInvoiceModal?.value ?? ''); return Number.isFinite(c) ? c : null; })() : null;
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
      <ProjectHeaderSection
        businessId={businessId}
        projectId={projectId}
        projectName={project.name}
        clientId={project.clientId}
        clientName={project.clientName}
        startDate={project.startDate}
        endDate={project.endDate}
        updatedAt={project.updatedAt}
        archivedAt={project.archivedAt ?? null}
        statusLabel={statusLabel}
        scopeLabel={scopeLabel}
        scopeVariant={scopeVariant}
        showScopeBadge={showScopeBadge}
        isOverdue={isOverdue}
        isAdmin={isAdmin}
        markingCompleted={markingCompleted}
        actionError={actionError}
        kpis={kpis}
        latestPdf={latestPdf}
        onMarkCompleted={handleMarkCompleted}
        onPostpone={() => {
          if (!isAdmin) {
            setActionError('Réservé aux admins/owners.');
            return;
          }
          setActionError(null);
          setActiveSetupModal('deadline');
        }}
      />

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
          tasks={tasks}
          members={members}
          isAdmin={isAdmin}
          onQuickAddTask={createTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      ) : null}

      {activeTab === 'team' ? (
        <TeamTab
          membersByUnit={membersByUnit}
          teamInfo={teamInfo}
          isAdmin={isAdmin}
          onOpenUnitsModal={() => setUnitsModalOpen(true)}
          businessId={businessId}
          currentUserId={currentUserId}
          conversations={messaging.conversations}
          activeConversationId={messaging.activeConversationId}
          messages={messaging.messages}
          loadingConversations={messaging.loadingConversations}
          loadingMessages={messaging.loadingMessages}
          sending={messaging.sending}
          hasMoreMessages={messaging.hasMoreMessages}
          tasks={tasks}
          members={teamMembers}
          onOpenConversation={messaging.openConversation}
          onSendMessage={messaging.sendMessage}
          onLoadOlderMessages={messaging.loadOlderMessages}
          onCreateConversation={messaging.createConversation}
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
          projectDocuments={projectDocuments}
          uploading={docUploading}
          isAdmin={isAdmin}
          onUpload={uploadDocument}
          onDelete={deleteDocument}
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
