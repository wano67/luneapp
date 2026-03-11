"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageContainer } from '@/components/layouts/PageContainer';
import { TabsPills } from '@/components/pro/TabsPills';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
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
import { sanitizeEuroInput } from '@/lib/money';
import { QuoteWizardModal } from '@/components/pro/projects/modals/QuoteWizardModal';
import { PaymentModal } from '@/components/pro/projects/modals/PaymentModal';
import { BillingModals } from '@/components/pro/projects/modals/BillingModals';
import { FilesTab } from '@/components/pro/projects/tabs/FilesTab';
import { WorkTab } from '@/components/pro/projects/tabs/WorkTab';
import { TeamTab } from '@/components/pro/projects/tabs/TeamTab';
import { SetupModals } from '@/components/pro/projects/modals/SetupModals';
import { useQuoteWizard } from '@/components/pro/projects/hooks/useQuoteWizard';
import { usePaymentModal } from '@/components/pro/projects/hooks/usePaymentModal';
import { useProjectDataLoaders } from '@/components/pro/projects/hooks/useProjectDataLoaders';
import { useBillingHandlers } from '@/components/pro/projects/hooks/useBillingHandlers';
import { useBillingComputed } from '@/components/pro/projects/hooks/useBillingComputed';
import { useTeamManagement } from '@/components/pro/projects/hooks/useTeamManagement';
import { useServiceManagement } from '@/components/pro/projects/hooks/useServiceManagement';
import { useProjectSetupModals } from '@/components/pro/projects/hooks/useProjectSetupModals';
import { useTaskHandlers } from '@/components/pro/projects/hooks/useTaskHandlers';
import { useDocumentUpload } from '@/components/pro/projects/hooks/useDocumentUpload';
import { useMessaging } from '@/components/pro/projects/hooks/useMessaging';
import { usePricingEngine } from '@/components/pro/projects/hooks/usePricingEngine';
import { ProjectHeaderSection } from '@/components/pro/projects/ProjectHeaderSection';
import { ChargesTab } from '@/components/pro/projects/tabs/ChargesTab';
import { VaultTab } from '@/components/pro/projects/tabs/VaultTab';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

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
  billingSummary?: {
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
  } | null;
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


const tabs = [
  { key: 'overview', label: "Vue d’ensemble" },
  { key: 'work', label: 'Tâches' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'charges', label: 'Charges' },
  { key: 'vault', label: 'Trousseau' },
  { key: 'files', label: 'Documents' },
];


const OVERVIEW_PREVIEW_COUNT = 3;
const OVERVIEW_ACTIVITY_COUNT = 5;
const OVERVIEW_MEMBERS_COUNT = 6;

export function ProjectWorkspace({ businessId, projectId }: { businessId: string; projectId: string }) {
  const searchParams = useSearchParams();
  const activeCtx = useActiveBusiness({ optional: true });
  const toast = useToast();
  const isAdmin = activeCtx?.isAdmin ?? false;
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'team' | 'billing' | 'charges' | 'vault' | 'files'>('overview');
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'TODO' | 'DONE' | 'all'>('all');
  const [showAllServicesOverview, setShowAllServicesOverview] = useState(false);
  const [showAllActionsOverview, setShowAllActionsOverview] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showSummaryDetails, setShowSummaryDetails] = useState(false);

  const [markingCompleted, setMarkingCompleted] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Share modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareExpiry, setShareExpiry] = useState<number>(30);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // ─── Data loaders ───────────────────────────────────────────────────────────

  const {
    project, services, setServices, tasks, members, setMembers,
    projectMembers, organizationUnits, activityItems, documents,
    quotes, invoices, billingSettings, loading, error, clients,
    catalogServices, catalogSearchResults, serviceTemplates, templatesLoading,
    loadProject, loadServices, loadTasks, loadMembers, loadProjectMembers,
    loadOrganizationUnits, loadActivity, loadDocuments, loadProjectDocuments,
    loadQuotes, loadInvoices, loadClients,
    loadCatalogServices, loadServiceTemplates, refetchAll,
  } = useProjectDataLoaders({ businessId, projectId, onBillingError: setBillingError });

  // ─── Task handlers ──────────────────────────────────────────────────────────

  const {
    taskGroupExpanded, setTaskGroupExpanded,
    taskRowExpanded, setTaskRowExpanded,
    openServiceTasks, setOpenServiceTasks,
    taskUpdating, templatesApplying,
    updateTaskDueDate, updateTask, createTask, deleteTask,
    handleApplyServiceTemplates: applyServiceTemplatesRaw,
  } = useTaskHandlers({ businessId, projectId, isAdmin, loadTasks, loadActivity, loadProject, onBillingError: setBillingError });

  // ─── Documents ──────────────────────────────────────────────────────────────

  const {
    uploading: docUploading, uploadDocument, deleteDocument,
  } = useDocumentUpload({ businessId, projectId, loadProjectDocuments, onError: setBillingError });

  // ─── Current user (for messaging) ──────────────────────────────────────────

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

  const messaging = useMessaging({ businessId, projectId, enabled: activeTab === 'team' && !!currentUserId, onError: setBillingError });

  // ─── Payment modal ─────────────────────────────────────────────────────────

  const {
    paymentModal, paymentItems, paymentLoading, paymentError, paymentNotice,
    paymentSaving, paymentDeletingId, paymentForm, setPaymentForm,
    activePaymentInvoice, paymentTotalCents, paymentPaidCents, paymentRemainingCents,
    applyPaymentShortcut, openPaymentModal, closePaymentModal,
    handleSavePayment, handleDeletePayment,
  } = usePaymentModal({ businessId, isAdmin, invoices, loadInvoices, onBillingInfo: setBillingInfo, onBillingError: setBillingError });

  // ─── Quote wizard ──────────────────────────────────────────────────────────

  const {
    quoteWizardOpen, quoteWizardStep, setQuoteWizardStep,
    quoteWizardLines, quoteWizardSearch, setQuoteWizardSearch,
    quoteWizardGenerateTasks, setQuoteWizardGenerateTasks,
    quoteWizardAssigneeId, setQuoteWizardAssigneeId,
    quoteWizardDueOffsetDays, setQuoteWizardDueOffsetDays,
    quoteWizardError, quoteWizardInfo, quoteWizardSaving, quoteWizardResult,
    wizardLineValidation, wizardCanContinue,
    openQuoteWizard, closeQuoteWizard,
    addCatalogLine, addCustomLine, updateWizardLine, removeWizardLine,
    handleWizardGenerateQuote,
  } = useQuoteWizard({
    businessId, projectId, isAdmin, serviceTemplates, templatesLoading,
    loadCatalogServices, loadMembers, loadServiceTemplates, refetchAll,
    onBillingInfo: setBillingInfo,
  });

  // ─── Team management ───────────────────────────────────────────────────────

  const {
    accessModalOpen, setAccessModalOpen, accessInfo,
    unitsModalOpen, setUnitsModalOpen, unitErrors,
    teamInfo, unitDraftName, setUnitDraftName,
    unitDraftOrder, setUnitDraftOrder,
    unitDrafts, setUnitDrafts,
    handleAddProjectMember, handleRemoveProjectMember,
    handleCreateUnit, handleUpdateUnit, handleDeleteUnit,
    handleAssignMemberToUnit,
  } = useTeamManagement({ businessId, projectId, isAdmin, organizationUnits, loadMembers, loadProjectMembers, loadOrganizationUnits });

  // ─── Patch project helper ─────────────────────────────────────────────────

  const patchProject = async (body: Record<string, unknown>) => {
    return fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  // ─── Service management ─────────────────────────────────────────────────────

  const {
    serviceDrafts, setServiceDrafts, lineSavingId,
    lineErrors, setLineErrors, openNotes, setOpenNotes,
    draggingServiceId, dragOverServiceId, reordering,
    prestationsDraft, setPrestationsDraft, prestationsSaving,
    prestationsError, prestationsDirty,
    handleSavePrestations, handleServiceDragStart, handleServiceDragOver,
    handleServiceDrop, handleServiceDragEnd, handleUpdateService, handleDeleteService,
  } = useServiceManagement({
    businessId, projectId, isAdmin, services, setServices,
    loadServices, refetchAll, patchProject, loadProject,
    projectPrestationsText: project?.prestationsText,
    onBillingInfo: setBillingInfo, onBillingError: setBillingError,
  });

  // ─── Setup modals ──────────────────────────────────────────────────────────

  const {
    activeSetupModal, setActiveSetupModal, saving, modalError,
    selectedClientId, setSelectedClientId,
    startDateInput, setStartDateInput, endDateInput, setEndDateInput,
    serviceSelections, setServiceSelections,
    quickServiceDraft, setQuickServiceDraft, quickServiceSaving, quickServiceError,
    taskAssignments, setTaskAssignments,
    generateTasksOnAdd, setGenerateTasksOnAdd,
    taskAssigneeId, setTaskAssigneeId, taskDueOffsetDays, setTaskDueOffsetDays,
    inviteEmail, setInviteEmail, inviteRole, setInviteRole,
    documentKind, setDocumentKind, setDocumentFile,
    clientSearch, setClientSearch, clientCreateMode, setClientCreateMode,
    newClientName, setNewClientName, newClientEmail, setNewClientEmail,
    serviceSearch, setServiceSearch, selectedServiceIds,
    availableTags, selectedTagIds, setSelectedTagIds, tagsLoading,
    closeModal, handleAttachClient, handleCreateAndAttachClient,
    handleUpdateTags, handleUpdateDates, handleAddServices,
    handleQuickCreateService, handleAssignTasks, handleInviteMember, handleUploadDocument,
  } = useProjectSetupModals({
    businessId, projectId, isAdmin,
    projectClientId: project?.clientId ?? null,
    projectTagReferences: project?.tagReferences ?? [],
    projectStartDate: project?.startDate ?? null,
    projectEndDate: project?.endDate ?? null,
    clients, catalogSearchResults, serviceTemplates, templatesLoading,
    members, tasks, services, patchProject, refetchAll,
    loadClients, loadCatalogServices, loadMembers, loadTasks,
    loadDocuments, loadServiceTemplates, setMembers,
    onBillingInfo: setBillingInfo, onBillingError: setBillingError,
  });

  const handleApplyServiceTemplates = (projectServiceId: string) =>
    applyServiceTemplatesRaw(projectServiceId, taskAssigneeId, taskDueOffsetDays);

  // ─── Mark completed ─────────────────────────────────────────────────────────

  async function handleMarkCompleted() {
    if (!project) return;
    if (!isAdmin) { setActionError('Réservé aux admins/owners.'); return; }
    const warning = shouldWarnProjectCompletion(project.quoteStatus ?? null, project.depositStatus ?? null);
    const confirmMessage = warning
      ? 'Devis non signé ou acompte non validé. Marquer terminé quand même ?'
      : 'Marquer ce projet comme terminé ?';
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) return;
    setMarkingCompleted(true);
    setActionError(null);
    try {
      const res = await patchProject({ status: 'COMPLETED' });
      if (!res.ok) { setActionError(res.error ?? 'Impossible de marquer le projet terminé.'); return; }
      toast.celebrate({ title: 'Projet terminé !', subtitle: project.name ?? undefined });
      await refetchAll();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setMarkingCompleted(false);
    }
  }

  // ─── Status/scope display ──────────────────────────────────────────────────

  const statusLabel = useMemo(() => getProjectStatusLabelFR(project?.status ?? null), [project?.status]);
  const scopeLabel = useMemo(() => getProjectScopeLabelFR(project?.status ?? null, project?.archivedAt ?? null), [project?.archivedAt, project?.status]);
  const scopeVariant = useMemo(() => getProjectScopeVariant(project?.status ?? null, project?.archivedAt ?? null), [project?.archivedAt, project?.status]);
  const showScopeBadge = useMemo(() => scopeLabel.toLowerCase() !== statusLabel.toLowerCase(), [scopeLabel, statusLabel]);
  const isOverdue = useMemo(() => isProjectOverdue(project?.endDate ?? null, project?.status ?? null, project?.archivedAt ?? null), [project?.archivedAt, project?.endDate, project?.status]);

  // ─── Checklist ──────────────────────────────────────────────────────────────

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const hasClient = Boolean(project?.clientId);
    const hasEndDate = Boolean(project?.endDate);
    const hasServices = services.length > 0;
    const hasTasks = tasks.length > 0;
    const hasDocs = documents.length > 0;
    const hasTeam = members.length > 0 || tasks.some((t) => t.assigneeEmail || t.assigneeName);
    const hasTags = (project?.tagReferences?.length ?? 0) > 0;
    return [
      { key: 'client', label: 'Client lié', done: hasClient, ctaLabel: 'Associer un client', href: `/app/pro/${businessId}/clients` },
      { key: 'deadline', label: 'Échéance définie', done: hasEndDate, ctaLabel: 'Définir la date', href: `/app/pro/${businessId}/projects/${projectId}/edit` },
      { key: 'tags', label: 'Tags projet', done: hasTags, ctaLabel: 'Gérer les tags', href: `/app/pro/${businessId}/projects/${projectId}` },
      { key: 'services', label: 'Services ajoutés', done: hasServices, ctaLabel: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` },
      { key: 'tasks', label: 'Tâches générées/assignées', done: hasTasks, ctaLabel: 'Configurer les tâches', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` },
      { key: 'team', label: 'Équipe assignée', done: hasTeam, ctaLabel: 'Ajouter un membre', href: `/app/pro/${businessId}/projects/${projectId}?tab=team` },
      { key: 'docs', label: 'Dossier documents initial', done: hasDocs, ctaLabel: 'Ajouter un document', href: `/app/pro/${businessId}/projects/${projectId}?tab=files` },
    ];
  }, [businessId, project?.clientId, project?.endDate, project?.tagReferences, projectId, services.length, tasks, members.length, documents.length]);

  // ─── Tab sync ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['overview', 'work', 'team', 'billing', 'charges', 'vault', 'files'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [searchParams]);

  const showSetup = (searchParams?.get('setup') ?? '') === '1';

  // ─── Overview computed ──────────────────────────────────────────────────────

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'DONE' && (t.subtasksCount ?? 0) === 0)
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity));
  }, [tasks]);

  const servicesWithTasks = useMemo(() => {
    return services.map((service) => ({ service, tasks: tasks.filter((t) => t.projectServiceId === service.id) }));
  }, [services, tasks]);

  const servicesOverview = showAllServicesOverview ? servicesWithTasks : servicesWithTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showServicesToggle = servicesWithTasks.length > OVERVIEW_PREVIEW_COUNT;

  const upcomingTasksOverview = showAllActionsOverview ? upcomingTasks : upcomingTasks.slice(0, OVERVIEW_PREVIEW_COUNT);
  const showActionsToggle = upcomingTasks.length > OVERVIEW_PREVIEW_COUNT;

  const activityOverview = showAllActivity ? activityItems : activityItems.slice(0, OVERVIEW_ACTIVITY_COUNT);
  const showActivityToggle = activityItems.length > OVERVIEW_ACTIVITY_COUNT;

  const projectMembersPreview = projectMembers.slice(0, OVERVIEW_MEMBERS_COUNT);
  const projectMembersOverflow = Math.max(0, projectMembers.length - projectMembersPreview.length);
  const projectMemberIds = useMemo(() => new Set(projectMembers.map((member) => member.membershipId)), [projectMembers]);
  const availableMembers = useMemo(() =>
    members.filter((member) => !projectMemberIds.has(member.membershipId) && member.role !== 'OWNER' && member.role !== 'ADMIN'),
    [members, projectMemberIds]
  );

  // ─── Work tab computed ──────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const subtasksByParentId = useMemo(() => {
    const record: Record<string, TaskItem[]> = {};
    tasks.forEach((task) => { if (task.parentTaskId) { (record[task.parentTaskId] ??= []).push(task); } });
    return record;
  }, [tasks]);

  const tasksByAssignee = useMemo(() => {
    const groups = new Map<string, { label: string; name?: string | null; email?: string | null; tasks: TaskItem[] }>();
    for (const task of filteredTasks) {
      const key = task.assigneeUserId ?? 'unassigned';
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { label: task.assigneeName || task.assigneeEmail || 'Non assignées', name: task.assigneeName, email: task.assigneeEmail, tasks: [task] });
      } else {
        existing.tasks.push(task);
      }
    }
    const list = Array.from(groups.entries()).map(([key, value]) => ({ key, ...value }));
    list.sort((a, b) => { if (a.key === 'unassigned') return -1; if (b.key === 'unassigned') return 1; return a.label.localeCompare(b.label); });
    return list;
  }, [filteredTasks]);

  // ─── Team computed ──────────────────────────────────────────────────────────

  const teamMembers = useMemo(() => {
    if (members.length) return members;
    return projectMembers.map<MemberItem>((member) => ({
      membershipId: member.membershipId, userId: member.user.id,
      email: member.user.email ?? '', name: member.user.name,
      role: member.role, organizationUnit: member.organizationUnit ?? null,
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

  // ─── Charges totals (for project KPIs) ─────────────────────────────────────

  const [chargesGrandTotalCents, setChargesGrandTotalCents] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchJson<{ totals: { grandTotalCents: string } }>(`/api/pro/businesses/${businessId}/projects/${projectId}/charges`)
      .then((res) => {
        if (!cancelled && res.ok && res.data?.totals) {
          setChargesGrandTotalCents(Number(res.data.totals.grandTotalCents));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [businessId, projectId]);

  // ─── Pricing engine ─────────────────────────────────────────────────────────

  const {
    catalogDurationById, pricingLines, pricingTotals,
    isBillingEmpty, missingPriceNames,
    effectiveDepositPercent, vatEnabled, vatRatePercent,
  } = usePricingEngine({ services, serviceDrafts, setServiceDrafts, catalogServices, billingSettings });

  // ─── Billing computed (extracted) ───────────────────────────────────────────

  const progressPct = useMemo(() => {
    if (project?.tasksSummary) return project.tasksSummary.progressPct ?? 0;
    if (!tasks.length) return 0;
    const total = tasks.length;
    const sum = tasks.reduce((acc, t) => acc + (t.status === 'DONE' ? 100 : 0), 0);
    return Math.round(sum / total);
  }, [project?.tasksSummary, tasks]);

  const {
    billingReferenceId, summaryTotals,
    depositPercentLabel, depositPaidLabel, canEditDepositPaidDate,
    alreadyInvoicedCents, alreadyPaidCents,
    remainingToCollectCents, remainingToInvoiceCents,
    latestPdf, legalBlocks, legalConfigured,
    invoiceByQuoteId, pricingByServiceId, kpis,
  } = useBillingComputed({
    project, quotes, invoices, services, billingSettings,
    pricingTotals, pricingLines, effectiveDepositPercent,
    vatEnabled, vatRatePercent, businessId, progressPct,
    chargesGrandTotalCents,
  });

  // ─── Billing handlers ──────────────────────────────────────────────────────

  const {
    quoteEditor, setQuoteEditor, invoiceEditor, setInvoiceEditor,
    quoteEditError, invoiceEditError, quoteEditing, invoiceEditing,
    stagedInvoiceModal, setStagedInvoiceModal, stagedInvoiceError, stagedInvoiceLoading,
    creatingQuote, quoteActionId, invoiceActionId, recurringInvoiceActionId,
    referenceUpdatingId, quoteDateEditor, setQuoteDateEditor,
    cancelQuoteEditor, setCancelQuoteEditor, cancelQuoteError, cancelQuoteSaving,
    invoiceDateEditor, setInvoiceDateEditor,
    depositDateEditorOpen, setDepositDateEditorOpen,
    depositPaidDraft, setDepositPaidDraft,
    dateModalError, setDateModalError, dateModalSaving,
    handleCreateQuote, openCancelQuoteModal, handleCancelQuote,
    handleSetBillingReference, handleQuoteStatus, handleCreateInvoice,
    handleGenerateRecurringInvoice,
    openStagedInvoiceModal, closeStagedInvoiceModal, handleCreateStagedInvoice,
    handleInvoiceStatus,
    openQuoteDateModal, openInvoiceDateModal,
    handleSaveQuoteDate, handleSaveInvoiceDate, handleSaveDepositDate,
    openQuoteEditor, closeQuoteEditor, addQuoteLine, removeQuoteLine, handleSaveQuoteEdit,
    handleDeleteQuote,
    openInvoiceEditor, closeInvoiceEditor, addInvoiceLine, removeInvoiceLine, handleSaveInvoiceEdit,
    handleDeleteInvoice,
  } = useBillingHandlers({
    businessId, projectId, isAdmin,
    projectDepositPaidAt: project?.depositPaidAt,
    servicesLength: services.length,
    pricingMissingCount: pricingTotals.missingCount,
    summaryTotals, remainingToInvoiceCents,
    loadQuotes, loadInvoices, loadProject, refetchAll,
    onBillingError: setBillingError, onBillingInfo: setBillingInfo,
  });

  // ─── Share modal handler ───────────────────────────────────────────────────

  async function handleShareCreate() {
    setShareLoading(true);
    setShareError(null);
    setShareLink(null);
    try {
      const body: { clientEmail?: string; expiresInDays?: number } = {};
      if (shareEmail.trim()) body.clientEmail = shareEmail.trim();
      if (shareExpiry > 0) body.expiresInDays = shareExpiry;
      const res = await fetchJson<{ shareLink: string }>(`/api/pro/businesses/${businessId}/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok && res.data?.shareLink) {
        setShareLink(res.data.shareLink);
      } else {
        setShareError(res.error || 'Erreur lors de la création du lien.');
      }
    } catch {
      setShareError('Erreur de connexion.');
    } finally {
      setShareLoading(false);
    }
  }

  // ─── Task click from overview → switch to work tab ─────────────────────────

  const handleTaskClick = useCallback((taskId: string) => {
    setPendingTaskId(taskId);
    setActiveTab('work');
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <EmptyState title="Chargement..." description="Nous récupérons le projet." />;
  }
  if (error || !project) {
    return (
      <EmptyState
        title="Projet introuvable"
        description={error ?? 'Ce projet est indisponible.'}
        action={<Button asChild><Link href={`/app/pro/${businessId}/projects`}>Retour aux projets</Link></Button>}
      />
    );
  }

  return (
    <PageContainer className="gap-5">
      <ProjectHeaderSection
        businessId={businessId}
        projectId={projectId}
        projectName={project.name}
        clientId={project.clientId}
        clientName={project.clientName}
        archivedAt={project.archivedAt ?? null}
        statusLabel={statusLabel}
        scopeLabel={scopeLabel}
        scopeVariant={scopeVariant}
        showScopeBadge={showScopeBadge}
        isOverdue={isOverdue}
        isAdmin={isAdmin}
        markingCompleted={markingCompleted}
        actionError={actionError}
        latestPdf={latestPdf}
        onMarkCompleted={handleMarkCompleted}
        onPostpone={() => {
          if (!isAdmin) { setActionError('Réservé aux admins/owners.'); return; }
          setActionError(null);
          setActiveSetupModal('deadline');
        }}
        onBillingClick={() => setActiveTab('billing')}
        onShareClick={() => setShareOpen(true)}
      />

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((item, i) => (
          <KpiCard key={item.label} label={item.label} value={item.value} delay={i * 50} />
        ))}
      </div>

      {/* Main content card */}
      <div
        className="flex flex-1 flex-col gap-4 rounded-3xl p-3 min-w-0 overflow-x-hidden"
        style={{ background: 'var(--surface)', outline: '0.5px solid var(--border)' }}
      >
        <TabsPills
          items={tabs}
          value={activeTab}
          onChange={(key) => setActiveTab(key as typeof activeTab)}
          ariaLabel="Onglets projet"
          wrap={false}
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
          onTaskClick={handleTaskClick}
        />
      ) : null}

      {activeTab === 'work' ? (
        <WorkTab
          tasksByAssignee={tasksByAssignee}
          subtasksByParentId={subtasksByParentId}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          taskGroupExpanded={taskGroupExpanded}
          onTaskGroupToggle={(key, expanded) => setTaskGroupExpanded((prev) => ({ ...prev, [key]: expanded }))}
          taskRowExpanded={taskRowExpanded}
          onTaskRowToggle={(taskId, expanded) => setTaskRowExpanded((prev) => ({ ...prev, [taskId]: expanded }))}
          businessId={businessId}
          projectId={projectId}
          tasks={tasks}
          members={members}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onQuickAddTask={createTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          services={services.map((s) => ({ id: s.id, name: s.service?.name ?? s.titleOverride ?? '' }))}
          organizationUnits={organizationUnits}
          initialOpenTaskId={pendingTaskId}
          onInitialTaskConsumed={() => setPendingTaskId(null)}
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
          onOpenDepositDateModal={() => { setDateModalError(null); setDepositDateEditorOpen(true); }}
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

      {activeTab === 'charges' ? (
        <ChargesTab businessId={businessId} projectId={projectId} isAdmin={isAdmin} />
      ) : null}

      {activeTab === 'vault' ? (
        <VaultTab businessId={businessId} projectId={projectId} isAdmin={isAdmin} />
      ) : null}

      {activeTab === 'files' ? (
        <FilesTab
          quotes={quotes}
          invoices={invoices}
          businessId={businessId}
          projectId={projectId}
          uploading={docUploading}
          isAdmin={isAdmin}
          onUpload={uploadDocument}
          onDelete={deleteDocument}
        />
      ) : null}
      </div>

      {/* Billing modals (always mounted) */}
      <BillingModals
        isAdmin={isAdmin}
        summaryTotalsCents={summaryTotals.totalCents}
        remainingToInvoiceCents={remainingToInvoiceCents}
        stagedInvoiceModal={stagedInvoiceModal}
        setStagedInvoiceModal={setStagedInvoiceModal}
        stagedInvoiceError={stagedInvoiceError}
        stagedInvoiceLoading={stagedInvoiceLoading}
        onCloseStagedInvoice={closeStagedInvoiceModal}
        onCreateStagedInvoice={handleCreateStagedInvoice}
        quoteEditor={quoteEditor}
        setQuoteEditor={setQuoteEditor}
        quoteEditing={quoteEditing}
        quoteEditError={quoteEditError}
        onCloseQuoteEditor={closeQuoteEditor}
        onSaveQuoteEdit={handleSaveQuoteEdit}
        onAddQuoteLine={addQuoteLine}
        onRemoveQuoteLine={removeQuoteLine}
        invoiceEditor={invoiceEditor}
        setInvoiceEditor={setInvoiceEditor}
        invoiceEditing={invoiceEditing}
        invoiceEditError={invoiceEditError}
        onCloseInvoiceEditor={closeInvoiceEditor}
        onSaveInvoiceEdit={handleSaveInvoiceEdit}
        onAddInvoiceLine={addInvoiceLine}
        onRemoveInvoiceLine={removeInvoiceLine}
        quoteDateEditor={quoteDateEditor}
        setQuoteDateEditor={setQuoteDateEditor}
        dateModalSaving={dateModalSaving}
        dateModalError={dateModalError}
        setDateModalError={setDateModalError}
        onSaveQuoteDate={handleSaveQuoteDate}
        cancelQuoteEditor={cancelQuoteEditor}
        setCancelQuoteEditor={setCancelQuoteEditor}
        cancelQuoteSaving={cancelQuoteSaving}
        cancelQuoteError={cancelQuoteError}
        onCancelQuote={handleCancelQuote}
        invoiceDateEditor={invoiceDateEditor}
        setInvoiceDateEditor={setInvoiceDateEditor}
        onSaveInvoiceDate={handleSaveInvoiceDate}
        depositDateEditorOpen={depositDateEditorOpen}
        setDepositDateEditorOpen={setDepositDateEditorOpen}
        depositPaidDraft={depositPaidDraft}
        setDepositPaidDraft={setDepositPaidDraft}
        projectDepositStatus={project?.depositStatus}
        onSaveDepositDate={handleSaveDepositDate}
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
            ...prev, ...patch,
            amount: patch.amount != null ? sanitizeEuroInput(patch.amount) : prev.amount,
          }))
        }
        onApplyShortcut={applyPaymentShortcut}
        onSave={handleSavePayment}
      />

      {/* Share modal */}
      <Modal
        open={shareOpen}
        onCloseAction={() => {
          if (shareLoading) return;
          setShareOpen(false);
          setShareEmail('');
          setShareLink(null);
          setShareError(null);
          setShareCopied(false);
        }}
        title="Partager le projet avec un client"
        description="Générez un lien de suivi accessible sans connexion."
      >
        <div className="space-y-4">
          {!shareLink ? (
            <>
              <Input
                label="Email du client (optionnel)"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="client@exemple.com"
              />
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Expiration du lien
                </label>
                <select
                  value={shareExpiry}
                  onChange={(e) => setShareExpiry(Number(e.target.value))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value={7}>7 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={90}>90 jours</option>
                  <option value={0}>Illimité</option>
                </select>
              </div>
              {shareError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{shareError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShareOpen(false)} disabled={shareLoading}>
                  Annuler
                </Button>
                <Button onClick={handleShareCreate} disabled={shareLoading}>
                  {shareLoading ? 'Génération…' : 'Générer le lien'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Lien de partage
                </label>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)', color: 'var(--text)' }}
                    onFocus={(e) => e.target.select()}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(shareLink);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }}
                  >
                    {shareCopied ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
              {shareEmail.trim() && (
                <p className="text-xs" style={{ color: 'var(--success)' }}>
                  Un email a été envoyé à {shareEmail.trim()}.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={() => { setShareOpen(false); setShareLink(null); setShareEmail(''); setShareCopied(false); }}>
                  Fermer
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

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
        clientCreateMode={clientCreateMode}
        newClientName={newClientName}
        newClientEmail={newClientEmail}
        setClientSearch={setClientSearch}
        setSelectedClientId={setSelectedClientId}
        setClientCreateMode={setClientCreateMode}
        setNewClientName={setNewClientName}
        setNewClientEmail={setNewClientEmail}
        onLoadClients={(search) => void loadClients(search)}
        onAttachClient={handleAttachClient}
        onCreateAndAttachClient={handleCreateAndAttachClient}
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
        availableTags={availableTags}
        selectedTagIds={selectedTagIds}
        tagsLoading={tagsLoading}
        onToggleTag={(id) => setSelectedTagIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        })}
        onUpdateTags={handleUpdateTags}
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
    </PageContainer>
  );
}
