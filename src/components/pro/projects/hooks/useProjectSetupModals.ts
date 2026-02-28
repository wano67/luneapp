import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { parseEuroToCents } from '@/lib/money';

type SetupModalKey = null | 'client' | 'deadline' | 'services' | 'tasks' | 'team' | 'documents';

type ClientItem = { id: string; name: string; email?: string | null };
type MemberItem = {
  membershipId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: string;
  organizationUnit?: { id: string; name: string } | null;
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
type ServiceTemplateMap = Record<string, Array<{ id: string; title: string }>>;

type QuickServiceDraft = {
  name: string;
  code: string;
  price: string;
  billingUnit: string;
};

interface UseProjectSetupModalsParams {
  businessId: string;
  projectId: string;
  isAdmin: boolean;
  projectClientId: string | null;
  projectStartDate: string | null;
  projectEndDate: string | null;
  clients: ClientItem[];
  catalogSearchResults: Array<{ id: string; code: string; name: string; defaultPriceCents: string | null; type: string | null }>;
  serviceTemplates: ServiceTemplateMap;
  templatesLoading: Record<string, boolean>;
  members: MemberItem[];
  tasks: TaskItem[];
  services: Array<{ id: string; serviceId: string }>;
  patchProject: (body: Record<string, unknown>) => Promise<{ ok: boolean; error?: string | null }>;
  refetchAll: () => Promise<void>;
  loadClients: (search?: string) => Promise<void>;
  loadCatalogServices: (search?: string) => Promise<void>;
  loadMembers: () => Promise<void>;
  loadTasks: () => Promise<void>;
  loadDocuments: (clientId: string) => Promise<void>;
  loadServiceTemplates: (serviceId: string) => Promise<void>;
  setMembers: React.Dispatch<React.SetStateAction<MemberItem[]>>;
  onBillingInfo: (msg: string) => void;
  onBillingError: (msg: string | null) => void;
}

export function useProjectSetupModals(params: UseProjectSetupModalsParams) {
  const {
    businessId,
    projectId,
    isAdmin,
    projectClientId,
    projectStartDate,
    projectEndDate,
    serviceTemplates,
    templatesLoading,
    patchProject,
    refetchAll,
    loadClients,
    loadCatalogServices,
    loadMembers,
    loadTasks,
    loadDocuments,
    loadServiceTemplates,
    setMembers,
    onBillingInfo,
  } = params;

  // ─── States ─────────────────────────────────────────────────────────────────
  const [activeSetupModal, setActiveSetupModal] = useState<SetupModalKey>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [serviceSelections, setServiceSelections] = useState<Record<string, number>>({});
  const [quickServiceDraft, setQuickServiceDraft] = useState<QuickServiceDraft>({
    name: '',
    code: '',
    price: '',
    billingUnit: 'ONE_OFF',
  });
  const [quickServiceSaving, setQuickServiceSaving] = useState(false);
  const [quickServiceError, setQuickServiceError] = useState<string | null>(null);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  const [generateTasksOnAdd, setGenerateTasksOnAdd] = useState(true);
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskDueOffsetDays, setTaskDueOffsetDays] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<'Administratif' | 'Projet'>('Administratif');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // ─── Derived ────────────────────────────────────────────────────────────────
  const selectedServiceIds = useMemo(
    () => Object.keys(serviceSelections).filter((id) => (serviceSelections[id] ?? 0) > 0),
    [serviceSelections]
  );

  // ─── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setSelectedClientId(projectClientId);
    setStartDateInput(projectStartDate ? projectStartDate.slice(0, 10) : '');
    setEndDateInput(projectEndDate ? projectEndDate.slice(0, 10) : '');
  }, [projectClientId, projectStartDate, projectEndDate]);

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
      if (projectClientId) {
        void loadDocuments(projectClientId);
      }
    }
  }, [activeSetupModal, loadClients, loadCatalogServices, loadMembers, loadTasks, loadDocuments, projectClientId]);

  useEffect(() => {
    if (!generateTasksOnAdd) return;
    const selectedIds = Object.keys(serviceSelections);
    selectedIds.forEach((serviceId) => {
      if (!serviceTemplates[serviceId] && !templatesLoading[serviceId]) {
        void loadServiceTemplates(serviceId);
      }
    });
  }, [generateTasksOnAdd, serviceSelections, serviceTemplates, templatesLoading, loadServiceTemplates]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const closeModal = useCallback(() => {
    setActiveSetupModal(null);
    setModalError(null);
    setSaving(false);
    setDocumentFile(null);
    setQuickServiceError(null);
    setQuickServiceSaving(false);
    setQuickServiceDraft({ name: '', code: '', price: '', billingUnit: 'ONE_OFF' });
  }, []);

  const handleAttachClient = useCallback(async () => {
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
  }, [selectedClientId, patchProject, refetchAll, closeModal]);

  const handleUpdateDates = useCallback(async () => {
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
  }, [startDateInput, endDateInput, patchProject, refetchAll, closeModal]);

  const handleAddServices = useCallback(async () => {
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
  }, [isAdmin, serviceSelections, taskDueOffsetDays, businessId, projectId, generateTasksOnAdd, taskAssigneeId, refetchAll, closeModal]);

  const handleQuickCreateService = useCallback(async () => {
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
        body: JSON.stringify({ code, name, defaultPriceCents: priceCents }),
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
      onBillingInfo('Service ajouté au projet.');
      closeModal();
    } catch (err) {
      setQuickServiceError(getErrorMessage(err));
    } finally {
      setQuickServiceSaving(false);
    }
  }, [isAdmin, quickServiceDraft, businessId, projectId, refetchAll, loadCatalogServices, onBillingInfo, closeModal]);

  const handleAssignTasks = useCallback(async () => {
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
  }, [taskAssignments, businessId, refetchAll, closeModal]);

  const handleInviteMember = useCallback(async () => {
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
  }, [inviteEmail, inviteRole, businessId, setMembers, refetchAll, closeModal]);

  const handleUploadDocument = useCallback(async () => {
    if (!projectClientId) {
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
      const res = await fetch(`/api/pro/businesses/${businessId}/clients/${projectClientId}/documents`, {
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
  }, [projectClientId, documentFile, documentKind, businessId, refetchAll, closeModal]);

  return {
    activeSetupModal,
    setActiveSetupModal,
    saving,
    modalError,
    setModalError,
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
  };
}
