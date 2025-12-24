// src/app/app/pro/[businessId]/projects/[projectId]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';
import { ReferencePicker } from '../../references/ReferencePicker';
import { PageHeader } from '../../../../components/PageHeader';

type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
type ProjectQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'SIGNED';
type ProjectDepositStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID';
type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type TaskPhase = 'CADRAGE' | 'UX' | 'DESIGN' | 'DEV' | 'SEO' | 'LAUNCH' | 'FOLLOW_UP' | null;

type ProjectServiceItem = {
  id: string;
  projectId: string;
  serviceId: string;
  quantity: number;
  priceCents: string | null;
  notes: string | null;
  createdAt: string;
  service: { id: string; code: string; name: string; type: string | null; defaultPriceCents?: string | null };
};

type Project = {
  id: string;
  businessId: string;
  clientId: string | null;
  clientName: string | null;
  categoryReferenceId?: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: { id: string; name: string }[];
  name: string;
  status: ProjectStatus;
  quoteStatus: ProjectQuoteStatus;
  depositStatus: ProjectDepositStatus;
  startedAt: string | null;
  archivedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  counts?: { tasks: number; projectServices: number; interactions: number };
  projectServices?: ProjectServiceItem[];
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  createdAt: string;
  updatedAt: string;
};

type ProjectDetailResponse = { item: Project };

type TaskItem = {
  id: string;
  projectId: string | null;
  title: string;
  phase: TaskPhase;
  status: TaskStatus;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  assigneeUserId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
};

type ServiceOption = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  defaultPriceCents?: string | null;
  templateCount?: number;
};

type InteractionType = 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';

type Interaction = {
  id: string;
  businessId: string;
  clientId: string | null;
  projectId: string | null;
  type: InteractionType;
  content: string;
  happenedAt: string;
  nextActionDate: string | null;
  createdAt: string;
  createdByUserId: string | null;
};

type PricingItem = {
  serviceId: string | null;
  label: string;
  quantity: number;
  unitPriceCents: string;
  totalCents: string;
};

type Pricing = {
  businessId: string;
  projectId: string;
  clientId: string | null;
  currency: string;
  depositPercent: number;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  items: PricingItem[];
};

type QuoteStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'CANCELLED' | 'EXPIRED';

type Quote = {
  id: string;
  businessId: string;
  projectId: string;
  clientId: string | null;
  status: QuoteStatus;
  number?: string | null;
  depositPercent: number;
  currency: string;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  note: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  items?: PricingItem[];
};

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'CANCELLED';

type Invoice = {
  id: string;
  businessId: string;
  projectId: string;
  clientId: string | null;
  quoteId: string | null;
  status: InvoiceStatus;
  number?: string | null;
  depositPercent: number;
  currency: string;
  totalCents: string;
  depositCents: string;
  balanceCents: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FinanceLine = {
  id: string;
  businessId: string;
  projectId: string | null;
  type: 'INCOME' | 'EXPENSE';
  amountCents: string;
  category: string;
  date: string;
  note: string | null;
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: 'Planifié',
  ACTIVE: 'En cours',
  ON_HOLD: 'Pause',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

const QUOTE_LABELS: Record<ProjectQuoteStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  SIGNED: 'Signé',
};

const DEPOSIT_LABELS: Record<ProjectDepositStatus, string> = {
  NOT_REQUIRED: 'Non requis',
  PENDING: 'En attente',
  PAID: 'Payé',
};

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  SIGNED: 'Signé',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'À faire' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'DONE', label: 'Terminé' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    amount
  );
}

function centsToNumber(value: string | null | undefined) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return num / 100;
}

function formatCents(value: string | null | undefined, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    centsToNumber(value ?? '0')
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value ?? '—';
  }
}

function computeProgress(summary?: Project['tasksSummary'], tasks?: TaskItem[]) {
  if (summary) return summary;
  if (!tasks || tasks.length === 0) return { total: 0, open: 0, done: 0, progressPct: 0 };
  let total = 0;
  let open = 0;
  let done = 0;
  let sum = 0;
  for (const t of tasks) {
    total += 1;
    const pct = t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0;
    sum += pct;
    if (t.status === 'DONE') done += 1;
    else open += 1;
  }
  return { total, open, done, progressPct: Math.round(sum / total) };
}

function phaseLabel(phase: TaskPhase) {
  switch (phase) {
    case 'CADRAGE':
      return 'Cadrage';
    case 'UX':
      return 'UX';
    case 'DESIGN':
      return 'Design';
    case 'DEV':
      return 'Dev';
    case 'SEO':
      return 'SEO';
    case 'LAUNCH':
      return 'Lancement';
    case 'FOLLOW_UP':
      return 'Suivi';
    default:
      return 'Sans phase';
  }
}

function interactionTypeLabel(value: InteractionType) {
  switch (value) {
    case 'CALL':
      return 'Appel';
    case 'MEETING':
      return 'Réunion';
    case 'EMAIL':
      return 'Email';
    case 'NOTE':
      return 'Note';
    case 'MESSAGE':
      return 'Message';
    default:
      return value;
  }
}

type KpiTileProps = {
  title: string;
  value: string;
  helper?: string;
  href?: string;
};

function KpiTile({ title, value, helper, href }: KpiTileProps) {
  const content = (
    <div className="card-interactive block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{title}</p>
      <p className="text-xl font-semibold text-[var(--text-primary)]">{value}</p>
      {helper ? <p className="text-xs text-[var(--text-secondary)]">{helper}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const projectId = (params?.projectId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.activeBusiness?.role === 'OWNER' || activeCtx?.activeBusiness?.role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [project, setProject] = useState<Project | null>(null);
  const [services, setServices] = useState<ProjectServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [categoryReferenceId, setCategoryReferenceId] = useState<string>('');
  const [tagReferenceIds, setTagReferenceIds] = useState<string[]>([]);
  const [referencesSaving, setReferencesSaving] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [referencesMessage, setReferencesMessage] = useState<string | null>(null);
  const [referencesRequestId, setReferencesRequestId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ProjectServiceItem | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [priceCents, setPriceCents] = useState('');
  const [notes, setNotes] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [startLoading, setStartLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [taskActionId, setTaskActionId] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const [quoteStatusValue, setQuoteStatusValue] = useState<ProjectQuoteStatus>('DRAFT');
  const [depositStatusValue, setDepositStatusValue] = useState<ProjectDepositStatus>('PENDING');
  const [savingCommercial, setSavingCommercial] = useState(false);
  const [commercialMessage, setCommercialMessage] = useState<string | null>(null);
  const [archiveAction, setArchiveAction] = useState<'archive' | 'unarchive' | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveRequestId, setArchiveRequestId] = useState<string | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  const interactionsControllerRef = useRef<AbortController | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [interactionsError, setInteractionsError] = useState<string | null>(null);
  const [interactionRequestId, setInteractionRequestId] = useState<string | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('CALL');
  const [interactionContent, setInteractionContent] = useState('');
  const [interactionDate, setInteractionDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [interactionNextAction, setInteractionNextAction] = useState('');
  const [interactionInfo, setInteractionInfo] = useState<string | null>(null);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);

  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [billingRequestId, setBillingRequestId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [finances, setFinances] = useState<FinanceLine[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingInfo, setBillingInfo] = useState<string | null>(null);

  function resetServiceForm() {
    setEditingService(null);
    setServiceId('');
    setQuantity(1);
    setPriceCents('');
    setNotes('');
    setServiceError(null);
  }

  async function loadInteractions(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      interactionsControllerRef.current?.abort();
      interactionsControllerRef.current = controller;
    }

    try {
      setInteractionsLoading(true);
      setInteractionsError(null);
      setInteractionRequestId(null);

      const res = await fetchJson<{ items: Interaction[] }>(
        `/api/pro/businesses/${businessId}/interactions?projectId=${projectId}&limit=10`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setInteractionRequestId(res.requestId);

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les interactions.';
        setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setInteractions([]);
        return;
      }

      setInteractions(res.data.items);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setInteractionsError(getErrorMessage(err));
      setInteractions([]);
    } finally {
      if (!effectiveSignal?.aborted) setInteractionsLoading(false);
    }
  }

  async function loadBilling() {
    try {
      setBillingLoading(true);
      setBillingError(null);
      setBillingInfo(null);
      const [pricingRes, quotesRes, invoicesRes, financesRes] = await Promise.all([
        fetchJson<{ pricing: Pricing }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/pricing`,
          { cache: 'no-store' }
        ),
        fetchJson<{ items: Quote[] }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
          { cache: 'no-store' }
        ),
        fetchJson<{ items: Invoice[] }>(
          `/api/pro/businesses/${businessId}/projects/${projectId}/invoices`,
          { cache: 'no-store' }
        ),
        fetchJson<{ items: FinanceLine[] }>(
          `/api/pro/businesses/${businessId}/finances?projectId=${projectId}`,
          { cache: 'no-store' }
        ),
      ]);

      setBillingRequestId(
        pricingRes.requestId ||
          quotesRes.requestId ||
          invoicesRes.requestId ||
          financesRes.requestId ||
          null
      );

      if (pricingRes.ok && pricingRes.data?.pricing) setPricing(pricingRes.data.pricing);
      else if (!pricingRes.ok) setBillingError(pricingRes.error ?? 'Pricing indisponible.');

      if (quotesRes.ok && quotesRes.data?.items) setQuotes(quotesRes.data.items);
      else if (!quotesRes.ok) setBillingError(quotesRes.error ?? 'Devis indisponibles.');

      if (invoicesRes.ok && invoicesRes.data?.items) setInvoices(invoicesRes.data.items);
      else if (!invoicesRes.ok) setBillingError(invoicesRes.error ?? 'Factures indisponibles.');

      if (financesRes.ok && financesRes.data?.items) {
        setFinances(financesRes.data.items.slice(0, 5));
      } else if (!financesRes.ok) {
        setBillingError(financesRes.error ?? 'Finances indisponibles.');
      }
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setBillingLoading(false);
    }
  }

  async function createQuote() {
    if (!isAdmin) {
      setBillingError(readOnlyMessage);
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    const res = await fetchJson<{ quote: Quote }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    setBillingRequestId(res.requestId);
    if (!res.ok || !res.data?.quote) {
      setBillingError(
        res.requestId ? `${res.error ?? 'Création impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création impossible.'
      );
      return;
    }
    setBillingInfo('Devis créé.');
    await loadBilling();
  }

  async function updateQuoteStatus(quoteIdValue: string, status: QuoteStatus) {
    if (!isAdmin) {
      setBillingError(readOnlyMessage);
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    const res = await fetchJson<{ quote: Quote }>(
      `/api/pro/businesses/${businessId}/quotes/${quoteIdValue}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    setBillingRequestId(res.requestId);
    if (!res.ok || !res.data?.quote) {
      setBillingError(
        res.requestId ? `${res.error ?? 'Mise à jour impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Mise à jour impossible.'
      );
      return;
    }
    setBillingInfo('Statut devis mis à jour.');
    await loadBilling();
  }

  async function createInvoiceFromQuote(quoteIdValue: string) {
    if (!isAdmin) {
      setBillingError(readOnlyMessage);
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    const res = await fetchJson<{ invoice: Invoice }>(
      `/api/pro/businesses/${businessId}/quotes/${quoteIdValue}/invoices`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    setBillingRequestId(res.requestId);
    if (!res.ok || !res.data?.invoice) {
      setBillingError(
        res.requestId ? `${res.error ?? 'Création facture impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Création facture impossible.'
      );
      return;
    }
    setBillingInfo('Facture créée.');
    await loadBilling();
  }

  async function updateInvoiceStatus(invoiceIdValue: string, status: InvoiceStatus) {
    if (!isAdmin) {
      setBillingError(readOnlyMessage);
      return;
    }
    setBillingError(null);
    setBillingInfo(null);
    const res = await fetchJson<{ invoice: Invoice }>(
      `/api/pro/businesses/${businessId}/invoices/${invoiceIdValue}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    setBillingRequestId(res.requestId);
    if (!res.ok || !res.data?.invoice) {
      setBillingError(
        res.requestId ? `${res.error ?? 'Mise à jour facture impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Mise à jour facture impossible.'
      );
      return;
    }
    setBillingInfo('Statut facture mis à jour.');
    await loadBilling();
  }

  function startEditInteraction(interaction: Interaction) {
    setEditingInteraction(interaction);
    setInteractionType(interaction.type);
    setInteractionContent(interaction.content);
    setInteractionDate(interaction.happenedAt.slice(0, 16));
    setInteractionNextAction(interaction.nextActionDate ? interaction.nextActionDate.slice(0, 16) : '');
    setInteractionInfo(null);
    setInteractionsError(null);
  }

  async function deleteInteraction(interaction: Interaction) {
    if (!isAdmin) {
      setInteractionsError(readOnlyMessage);
      return;
    }
    if (!window.confirm('Supprimer cette interaction ?')) return;
    setInteractionsError(null);
    setInteractionInfo(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/interactions/${interaction.id}`,
      { method: 'DELETE' }
    );
    setInteractionRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    if (editingInteraction?.id === interaction.id) {
      setEditingInteraction(null);
      setInteractionType('CALL');
      setInteractionContent('');
      setInteractionNextAction('');
      setInteractionDate(new Date().toISOString().slice(0, 16));
    }
    await loadInteractions();
  }

  async function loadProject(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ProjectDetailResponse>(
        `/api/pro/businesses/${businessId}/projects/${projectId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Projet introuvable.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setProject(null);
        setServices([]);
        return;
      }
      setRequestId(res.requestId ?? null);
      setProject(res.data.item);
      setCategoryReferenceId(res.data.item.categoryReferenceId ?? '');
      setTagReferenceIds(res.data.item.tagReferences?.map((t) => t.id) ?? []);
      setServices(res.data.item.projectServices ?? []);
      setQuoteStatusValue(res.data.item.quoteStatus);
      setDepositStatusValue(res.data.item.depositStatus);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  async function loadTasks() {
    try {
      setTasksLoading(true);
      const res = await fetchJson<{ items: TaskItem[] }>(
        `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
      );
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        setTaskError(res.requestId ? `${res.error ?? 'Impossible de charger les tâches.'} (Ref: ${res.requestId})` : res.error ?? 'Impossible de charger les tâches.');
        setTasks([]);
        return;
      }
      setTasks(res.data.items);
      setTaskError(null);
    } catch (err) {
      console.error(err);
      setTaskError(getErrorMessage(err));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    void loadProject();
    void loadTasks();
    void loadInteractions();
    void loadBilling();
    return () => {
      controllerRef.current?.abort();
      interactionsControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, projectId]);

  const progress = useMemo(() => computeProgress(project?.tasksSummary, tasks), [project, tasks]);

  const billedTotal = useMemo(
    () =>
      invoices
        .filter((inv) => inv.status === 'PAID')
        .reduce((acc, inv) => acc + centsToNumber(inv.totalCents), 0),
    [invoices]
  );

  const toInvoice = useMemo(() => centsToNumber(pricing?.balanceCents ?? '0'), [pricing]);

  const piecesCount = useMemo(() => quotes.length + invoices.length, [quotes, invoices]);

  const servicesTotal = useMemo(() => {
    if (pricing) return Number(pricing.totalCents);
    return services.reduce((acc, s) => {
      const unit = s.priceCents ? Number(s.priceCents) : s.service.defaultPriceCents ? Number(s.service.defaultPriceCents) : 0;
      return acc + unit * s.quantity;
    }, 0);
  }, [pricing, services]);

  const nextAction = useMemo(() => {
    const upcoming = interactions
      .filter((i) => i.nextActionDate)
      .sort(
        (a, b) => new Date(a.nextActionDate ?? '').getTime() - new Date(b.nextActionDate ?? '').getTime()
      );
    return upcoming.length ? upcoming[0] : null;
  }, [interactions]);

  const eligibleQuoteForInvoice = useMemo(() => {
    return quotes.find((q) => q.status === 'SIGNED') ?? quotes.find((q) => q.status === 'SENT') ?? null;
  }, [quotes]);

  async function openServiceModal(existing?: ProjectServiceItem) {
    if (!isAdmin) {
      setActionMessage(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    if (project?.archivedAt) {
      setActionMessage('Projet archivé : modification des services désactivée.');
      return;
    }
    if (!serviceOptions.length) {
      const res = await fetchJson<{ items: ServiceOption[] }>(
        `/api/pro/businesses/${businessId}/services`
      );
      if (res.ok && res.data)
        setServiceOptions(res.data.items.map((item) => ({ ...item, templateCount: item.templateCount ?? 0 })));
    }
    if (existing) {
      setEditingService(existing);
      setServiceId(existing.serviceId);
      setQuantity(existing.quantity);
      setPriceCents(existing.priceCents ?? '');
      setNotes(existing.notes ?? '');
    } else {
      resetServiceForm();
    }
    setServiceModalOpen(true);
  }

  async function submitService(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setServiceError(readOnlyMessage);
      return;
    }
    if (!serviceId) {
      setServiceError('Choisis un service.');
      return;
    }
    setSavingService(true);
    setServiceError(null);
    setActionMessage(null);
    const payload = {
      serviceId,
      quantity,
      priceCents: priceCents ? Number(priceCents) : undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const url = editingService
        ? `/api/pro/businesses/${businessId}/projects/${projectId}/services/${editingService.id}`
        : `/api/pro/businesses/${businessId}/projects/${projectId}/services`;
      const method = editingService ? 'PATCH' : 'POST';
      const res = await fetchJson<ProjectServiceItem>(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok || !res.data) {
        setServiceError(
          res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
        );
        return;
      }
      setServiceModalOpen(false);
      resetServiceForm();
      setActionMessage(editingService ? 'Service mis à jour.' : 'Service ajouté.');
      await loadProject();
      await loadBilling();
    } catch (err) {
      setServiceError(getErrorMessage(err));
    } finally {
      setSavingService(false);
    }
  }

  async function deleteService(item: ProjectServiceItem) {
    if (!isAdmin) {
      setActionMessage(readOnlyMessage);
      return;
    }
    if (project?.archivedAt) {
      setActionMessage('Projet archivé : suppression bloquée.');
      return;
    }
    if (!window.confirm(`Supprimer ${item.service.code} ?`)) return;
    setActionMessage(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services/${item.id}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setActionMessage(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setActionMessage('Service supprimé.');
    await loadProject();
    await loadBilling();
  }

  async function performArchive(action: 'archive' | 'unarchive') {
    if (!isAdmin) {
      setArchiveError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setArchiveLoading(true);
    setArchiveError(null);
    setArchiveRequestId(null);
    const res = await fetchJson<{ id: string; archivedAt: string | null }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/${action === 'archive' ? 'archive' : 'unarchive'}`,
      { method: 'POST' }
    );
    setArchiveRequestId(res.requestId);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Action impossible.';
      setArchiveError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setArchiveLoading(false);
      return;
    }
    setArchiveAction(null);
    setArchiveLoading(false);
    await loadProject();
  }

  async function startProject() {
    if (!isAdmin) {
      setActionMessage(readOnlyMessage);
      return;
    }
    if (!project || project.startedAt || project.archivedAt) return;
    setStartLoading(true);
    setActionMessage(null);
    const res = await fetchJson<{ startedAt: string; tasksCreated: number }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/start`,
      { method: 'POST' }
    );
    if (!res.ok) {
      setActionMessage(
        res.requestId ? `${res.error ?? 'Démarrage impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Démarrage impossible.'
      );
    } else {
      setActionMessage('Projet démarré.');
      await loadProject();
      await loadTasks();
    }
    setStartLoading(false);
  }

  async function submitInteraction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setInteractionsError(readOnlyMessage);
      return;
    }
    setSavingInteraction(true);
    setInteractionsError(null);
    setInteractionInfo(null);
    const isEdit = Boolean(editingInteraction);

    const content = interactionContent.trim();
    if (!content) {
      setInteractionsError('Contenu requis.');
      setSavingInteraction(false);
      return;
    }
    const happenedAtValue = interactionDate ? new Date(interactionDate) : new Date();
    if (Number.isNaN(happenedAtValue.getTime())) {
      setInteractionsError('Date invalide.');
      setSavingInteraction(false);
      return;
    }
    const nextActionValue = interactionNextAction ? new Date(interactionNextAction) : null;
    if (nextActionValue && Number.isNaN(nextActionValue.getTime())) {
      setInteractionsError('Prochaine action invalide.');
      setSavingInteraction(false);
      return;
    }

    const payload: Record<string, unknown> = {
      projectId,
      type: interactionType,
      content,
      happenedAt: happenedAtValue.toISOString(),
    };
    if (project?.clientId) payload.clientId = project.clientId;
    if (nextActionValue) payload.nextActionDate = nextActionValue.toISOString();
    else if (isEdit && !interactionNextAction) payload.nextActionDate = null;

    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/interactions/${editingInteraction?.id}`
      : `/api/pro/businesses/${businessId}/interactions`;
    const res = await fetchJson<Interaction>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setInteractionRequestId(res.requestId);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      setSavingInteraction(false);
      return;
    }

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Création impossible.';
      setInteractionsError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSavingInteraction(false);
      return;
    }

    setInteractionInfo(isEdit ? 'Interaction mise à jour.' : 'Interaction ajoutée.');
    setEditingInteraction(null);
    setInteractionType('CALL');
    setInteractionContent('');
    setInteractionNextAction('');
    setInteractionDate(new Date().toISOString().slice(0, 16));
    await loadInteractions();
    setSavingInteraction(false);
  }

  async function updateTask(task: TaskItem, updates: Partial<TaskItem>) {
    if (!isAdmin) {
      setTaskError(readOnlyMessage);
      return;
    }
    setTaskActionId(task.id);
    setTaskError(null);
    const res = await fetchJson<TaskItem>(`/api/pro/businesses/${businessId}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: updates.status ?? task.status,
        progress: updates.progress ?? task.progress,
        dueDate: updates.dueDate ?? task.dueDate,
      }),
    });
    if (!res.ok) {
      setTaskError(
        res.requestId ? `${res.error ?? 'Mise à jour impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Mise à jour impossible.'
      );
    } else {
      await loadTasks();
      await loadProject();
    }
    setTaskActionId(null);
  }

  async function saveCommercial() {
    if (!project || !isAdmin) {
      setCommercialMessage(readOnlyMessage);
      return;
    }
    setSavingCommercial(true);
    setCommercialMessage(null);
    const res = await fetchJson<ProjectDetailResponse>(
      `/api/pro/businesses/${businessId}/projects/${projectId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteStatus: quoteStatusValue,
          depositStatus: depositStatusValue,
        }),
      }
    );
    if (!res.ok || !res.data) {
      setCommercialMessage(
        res.requestId ? `${res.error ?? 'Enregistrement impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Enregistrement impossible.'
      );
    } else {
      setCommercialMessage('Statuts mis à jour.');
      setProject(res.data.item);
      setCategoryReferenceId(res.data.item.categoryReferenceId ?? '');
      setTagReferenceIds(res.data.item.tagReferences?.map((t) => t.id) ?? []);
    }
    setSavingCommercial(false);
  }

  async function saveReferences() {
    if (!isAdmin) {
      setReferencesError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setReferencesSaving(true);
    setReferencesError(null);
    setReferencesMessage(null);
    setReferencesRequestId(null);

    const res = await fetchJson<ProjectDetailResponse>(
      `/api/pro/businesses/${businessId}/projects/${projectId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryReferenceId: categoryReferenceId || null,
          tagReferenceIds,
        }),
      }
    );

    setReferencesRequestId(res.requestId ?? null);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de mettre à jour les références.';
      setReferencesError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
    } else {
      setProject(res.data.item);
      setCategoryReferenceId(res.data.item.categoryReferenceId ?? '');
      setTagReferenceIds(res.data.item.tagReferences?.map((t) => t.id) ?? []);
      setReferencesMessage('Références mises à jour.');
    }

    setReferencesSaving(false);
  }

  const loadingView = (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <Card className="p-5">
        <p className="text-sm text-[var(--text-secondary)]">Chargement du projet…</p>
      </Card>
    </div>
  );

  const notFoundView = (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <Card className="space-y-2 p-5">
        <p className="text-sm font-semibold text-rose-400">{error ?? 'Projet introuvable.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/app/pro/${businessId}/projects`}>Retour à la liste</Link>
        </Button>
      </Card>
    </div>
  );

  if (loading) return loadingView;
  if (!project) return notFoundView;

  const canStart =
    !project.startedAt &&
    !project.archivedAt &&
    (project.quoteStatus === 'SIGNED' || project.quoteStatus === 'ACCEPTED') &&
    (project.depositStatus === 'PAID' || project.depositStatus === 'NOT_REQUIRED');

  const headerSubtitle = project.clientName ? `Client : ${project.clientName}` : 'Client non assigné';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-4">
      <RoleBanner role={activeCtx?.activeBusiness?.role} />

      <PageHeader
        backHref={`/app/pro/${businessId}/projects`}
        backLabel="Projets"
        title={project.name}
        subtitle={headerSubtitle}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{STATUS_LABELS[project.status]}</Badge>
        <Badge variant="neutral">Devis {QUOTE_LABELS[project.quoteStatus]}</Badge>
        <Badge variant="neutral">Acompte {DEPOSIT_LABELS[project.depositStatus]}</Badge>
        {project.startedAt ? <Badge variant="neutral">Démarré {formatDate(project.startedAt)}</Badge> : null}
        {project.archivedAt ? <Badge variant="performance">Archivé</Badge> : null}
        <Badge variant="neutral">ID {project.id}</Badge>
        {requestId ? <Badge variant="neutral">Ref {requestId}</Badge> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile title="Facturé" value={formatCurrency(billedTotal)} helper="Total payé" />
        <KpiTile
          title="À facturer"
          value={formatCurrency(toInvoice)}
          helper={pricing ? 'Solde restant' : 'Pricing à calculer'}
        />
        <KpiTile
          title="Tâches"
          value={`${progress.done}/${progress.total || 0}`}
          helper={`${progress.progressPct}% complété`}
          href={`/app/pro/${businessId}/tasks?projectId=${project.id}`}
        />
        <KpiTile title="Pièces" value={`${piecesCount}`} helper="Devis + factures" />
      </div>

      <div className="sticky top-[116px] z-30 -mx-4 border-b border-[var(--border)] bg-[var(--background)]/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap gap-2 text-sm font-medium text-[var(--text-secondary)]">
          <a className="card-interactive rounded-md px-3 py-1 no-underline" href="#overview">
            Aperçu
          </a>
          <a className="card-interactive rounded-md px-3 py-1 no-underline" href="#services">
            Services
          </a>
          <a className="card-interactive rounded-md px-3 py-1 no-underline" href="#billing">
            Facturation
          </a>
          <a className="card-interactive rounded-md px-3 py-1 no-underline" href="#tasks">
            Tâches
          </a>
          <a className="card-interactive rounded-md px-3 py-1 no-underline" href="#activity">
            Activité
          </a>
        </div>
      </div>

      <section id="overview" className="space-y-3">
        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {project.categoryReferenceName ? (
                <Badge variant="neutral">Catégorie : {project.categoryReferenceName}</Badge>
              ) : (
                <Badge variant="neutral">Sans catégorie</Badge>
              )}
              {project.tagReferences?.length ? (
                project.tagReferences.map((tag) => (
                  <Badge key={tag.id} variant="neutral" className="bg-[var(--surface-hover)]">
                    #{tag.name}
                  </Badge>
                ))
              ) : (
                <Badge variant="neutral">Aucun tag</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {project.archivedAt ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setArchiveAction('unarchive');
                    setArchiveError(null);
                  }}
                  disabled={!isAdmin}
                >
                  Restaurer
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setArchiveAction('archive');
                    setArchiveError(null);
                  }}
                  disabled={!isAdmin}
                >
                  Archiver
                </Button>
              )}
              {!isAdmin ? (
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Lecture seule : archiver/restaurer nécessite ADMIN/OWNER.
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Début</p>
              <p className="text-sm text-[var(--text-primary)]">{formatDate(project.startDate)}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Échéance</p>
              <p className="text-sm text-[var(--text-primary)]">{formatDate(project.endDate)}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Avancement</span>
                <span className="font-semibold text-[var(--text-primary)]">{progress.progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface)]">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${progress.progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {progress.done} terminée(s) · {progress.open} ouverte(s)
              </p>
            </Card>
          </div>
        </Card>
      </section>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Références</p>
            <p className="text-xs text-[var(--text-secondary)]">Catégorie + tags utilisés pour filtrer et organiser.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {referencesMessage ? <span className="text-[11px] text-emerald-600">{referencesMessage}</span> : null}
            {referencesError ? <span className="text-[11px] text-rose-600">{referencesError}</span> : null}
            {referencesRequestId ? (
              <span className="text-[10px] text-[var(--text-secondary)]">Ref: {referencesRequestId}</span>
            ) : null}
            <Button size="sm" variant="outline" onClick={saveReferences} disabled={!isAdmin || referencesSaving}>
              {referencesSaving ? 'Sauvegarde…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
        <ReferencePicker
          businessId={businessId}
          categoryId={categoryReferenceId || null}
          tagIds={tagReferenceIds}
          onCategoryChange={(id: string | null) => setCategoryReferenceId(id ?? '')}
          onTagsChange={(ids: string[]) => setTagReferenceIds(ids)}
          disabled={!isAdmin || referencesSaving}
        />
        {!isAdmin ? (
          <p className="text-xs text-[var(--text-secondary)]">
            Lecture seule : ADMIN/OWNER requis pour modifier les références.
          </p>
        ) : null}
      </Card>

      {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)] px-1">{readOnlyInfo}</p> : null}

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Validation commerciale</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Met à jour le statut du devis et de l’acompte pour débloquer le démarrage.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={saveCommercial} disabled={!isAdmin || savingCommercial}>
            {savingCommercial ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Statut du devis"
            value={quoteStatusValue}
            onChange={(e) => setQuoteStatusValue(e.target.value as ProjectQuoteStatus)}
            disabled={!isAdmin || savingCommercial}
          >
            {Object.entries(QUOTE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Statut de l’acompte"
            value={depositStatusValue}
            onChange={(e) => setDepositStatusValue(e.target.value as ProjectDepositStatus)}
            disabled={!isAdmin || savingCommercial}
          >
            {Object.entries(DEPOSIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {!project.startedAt && !canStart ? (
          <p className="text-xs text-amber-600">
            Démarrage bloqué tant que le devis n’est pas SIGNED/ACCEPTED et l’acompte non PAID ou NOT_REQUIRED.
          </p>
        ) : null}
        {commercialMessage ? <p className="text-xs text-[var(--text-secondary)]">{commercialMessage}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Démarrage du projet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Devis signé + acompte payé pour lancer le projet et générer les tâches.
            </p>
          </div>
          {project.startedAt ? (
            <Badge variant="neutral">Démarré le {formatDate(project.startedAt)}</Badge>
          ) : project.archivedAt ? (
            <Badge variant="performance">Archivé</Badge>
          ) : (
            <Button onClick={startProject} disabled={!canStart || startLoading || !isAdmin} variant="primary">
              {startLoading ? 'Démarrage…' : 'Démarrer le projet'}
            </Button>
          )}
        </div>
        {project.archivedAt ? (
          <p className="text-sm text-amber-600">Projet archivé : restaurer pour démarrer.</p>
        ) : !canStart && !project.startedAt ? (
          <p className="text-sm text-amber-600">
            Pré-requis : devis SIGNED/ACCEPTED et acompte PAID ou NOT_REQUIRED.
          </p>
        ) : null}
        {!isAdmin ? (
          <p className="text-xs text-[var(--text-secondary)]">Seuls les admins/owners peuvent démarrer un projet.</p>
        ) : null}
        {actionMessage ? <p className="text-xs text-[var(--text-secondary)]">{actionMessage}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Services vendus</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Quantités, prix et notes sont synchronisés avec le devis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" asChild disabled={!isAdmin}>
              <Link href={`/app/pro/${businessId}/services`}>Gérer le catalogue</Link>
            </Button>
            <Button
              size="sm"
              onClick={() => openServiceModal()}
              variant="outline"
              disabled={Boolean(project.archivedAt) || !isAdmin}
            >
              Ajouter un service
            </Button>
          </div>
        </div>
        {project.archivedAt ? (
          <p className="text-xs text-amber-600">Projet archivé : ajout/édition de services désactivés.</p>
        ) : null}

        {services.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucun service ajouté.</p>
        ) : (
          <div className="space-y-2">
            {services.map((item) => {
              const unit = item.priceCents ?? item.service.defaultPriceCents ?? null;
              const subtotal = unit ? (Number(unit) * item.quantity) / 100 : 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {item.service.code} · {item.service.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {item.quantity} × {unit ? formatCurrency(Number(unit) / 100) : '—'} · Sous-total {formatCurrency(subtotal)}
                    </p>
                    {item.notes ? <p className="text-xs text-[var(--text-secondary)]">{item.notes}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openServiceModal(item)}
                      disabled={Boolean(project.archivedAt) || !isAdmin}
                    >
                      Éditer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteService(item)}
                      disabled={Boolean(project.archivedAt) || !isAdmin}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              );
            })}
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Total services : {formatCurrency(servicesTotal / 100)}
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Facturation (devis & factures)</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Total, acompte 30%, PDF et suivi paiement. Actions réservées aux admins.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {billingInfo ? <span className="text-[11px] text-emerald-600">{billingInfo}</span> : null}
            {billingError ? <span className="text-[11px] text-rose-600">{billingError}</span> : null}
            {billingRequestId ? (
              <span className="text-[10px] text-[var(--text-secondary)]">Req: {billingRequestId}</span>
            ) : null}
          </div>
        </div>

        {billingLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement facturation…</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
                <p className="text-xs text-[var(--text-secondary)]">Total</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {formatCents(pricing?.totalCents)}
                </p>
              </Card>
              <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
                <p className="text-xs text-[var(--text-secondary)]">Acompte (30%)</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {formatCents(pricing?.depositCents)}
                </p>
              </Card>
              <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
                <p className="text-xs text-[var(--text-secondary)]">Solde</p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  {formatCents(pricing?.balanceCents)}
                </p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={createQuote} disabled={!isAdmin || billingLoading}>
                Créer un devis
              </Button>
              <Button
                size="sm"
                onClick={() => loadBilling()}
                variant="outline"
                disabled={billingLoading}
              >
                Rafraîchir
              </Button>
              {eligibleQuoteForInvoice ? (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => createInvoiceFromQuote(eligibleQuoteForInvoice.id)}
                  disabled={!isAdmin || billingLoading}
                >
                  Créer facture (devis {eligibleQuoteForInvoice.id})
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Facture: aucun devis signé
                </Button>
              )}
            </div>

            <div className="space-y-2 overflow-x-auto">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Devis du projet
              </p>
              {quotes.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  Aucun devis. Ajoute des services puis crée un devis pour ce projet.
                </p>
              ) : (
                <div className="space-y-2">
                  {quotes.map((quote) => (
                    <div
                      key={quote.id}
                      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Devis {quote.number ?? `#${quote.id}`} · {formatCents(quote.totalCents)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {quote.items?.length ?? 0} lignes · Acompte {formatCents(quote.depositCents)} · Solde{' '}
                          {formatCents(quote.balanceCents)}
                        </p>
                        {quote.issuedAt ? (
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            Émis le {formatDate(quote.issuedAt)} · Expire {quote.expiresAt ? formatDate(quote.expiresAt) : '—'}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {quote.number ? (
                          <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                            {quote.number}
                          </Badge>
                        ) : null}
                        <Badge variant="neutral">{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={`/api/pro/businesses/${businessId}/quotes/${quote.id}/pdf`}
                            target="_blank"
                          >
                            PDF
                          </Link>
                        </Button>
                        {quote.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuoteStatus(quote.id, 'SENT')}
                            disabled={!isAdmin}
                          >
                            Marquer envoyé
                          </Button>
                        ) : null}
                        {quote.status === 'SENT' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => updateQuoteStatus(quote.id, 'SIGNED')}
                            disabled={!isAdmin}
                          >
                            Marquer signé
                          </Button>
                        ) : null}
                        {quote.status !== 'CANCELLED' && quote.status !== 'SIGNED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuoteStatus(quote.id, 'CANCELLED')}
                            disabled={!isAdmin}
                          >
                            Annuler
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 overflow-x-auto">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Factures du projet
              </p>
              {invoices.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Aucune facture pour l’instant.</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Facture {invoice.number ?? `#${invoice.id}`} · {formatCents(invoice.totalCents)}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Acompte {formatCents(invoice.depositCents)} · Solde {formatCents(invoice.balanceCents)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Échéance {invoice.dueAt ? formatDate(invoice.dueAt) : '—'} · Statut {INVOICE_STATUS_LABELS[invoice.status]}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invoice.number ? (
                          <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                            {invoice.number}
                          </Badge>
                        ) : null}
                        <Badge variant="neutral">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            href={`/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`}
                            target="_blank"
                          >
                            PDF
                          </Link>
                        </Button>
                        {invoice.status === 'DRAFT' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateInvoiceStatus(invoice.id, 'SENT')}
                            disabled={!isAdmin}
                          >
                            Marquer envoyée
                          </Button>
                        ) : null}
                        {invoice.status === 'SENT' ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => updateInvoiceStatus(invoice.id, 'PAID')}
                            disabled={!isAdmin}
                          >
                            Marquer payée
                          </Button>
                        ) : null}
                        {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateInvoiceStatus(invoice.id, 'CANCELLED')}
                            disabled={!isAdmin}
                          >
                            Annuler
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 overflow-x-auto">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Finances liées au projet
              </p>
              {finances.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Aucune ligne Finance pour ce projet.</p>
              ) : (
                <div className="space-y-1">
                  {finances.map((f) => (
                    <div key={f.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{f.category}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{formatDate(f.date)} · {f.note ?? ''}</p>
                      </div>
                      <p className={f.type === 'INCOME' ? 'text-emerald-600 text-sm font-semibold' : 'text-rose-600 text-sm font-semibold'}>
                        {formatCents(f.amountCents)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Interactions projet</p>
            <p className="text-xs text-[var(--text-secondary)]">10 dernières interactions + prochaine action.</p>
          </div>
          {nextAction ? (
            <Badge variant="personal">Next {formatDate(nextAction.nextActionDate)}</Badge>
          ) : (
            <Badge variant="neutral">Aucune prochaine action</Badge>
          )}
        </div>

        {interactionsError ? <p className="text-xs font-semibold text-rose-500">{interactionsError}</p> : null}

        {interactionsLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des interactions…</p>
        ) : interactions.length === 0 ? (
          <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucune interaction pour ce projet. Planifie le prochain point client pour sécuriser l’avancement.
            </p>
            <Button
              size="sm"
              onClick={() => document.getElementById('project-interaction-content')?.scrollIntoView()}
              disabled={!isAdmin}
            >
              Ajouter une interaction
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {interactions.map((interaction) => (
              <div
                key={interaction.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="pro">{interactionTypeLabel(interaction.type)}</Badge>
                    {interaction.nextActionDate ? (
                      <Badge variant="personal">Next {formatDate(interaction.nextActionDate)}</Badge>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {formatDateTime(interaction.happenedAt)}
                  </p>
                </div>
                <p className="text-sm text-[var(--text-primary)]">{interaction.content}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditInteraction(interaction)}
                    disabled={!isAdmin}
                  >
                    Modifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteInteraction(interaction)} disabled={!isAdmin}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ajouter une interaction</p>
          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">Lecture seule pour les rôles Viewer/Membre.</p>
          ) : null}
          <form onSubmit={submitInteraction} className="grid gap-3 md:grid-cols-2">
            <Select
              label="Type"
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value as InteractionType)}
              disabled={!isAdmin || savingInteraction}
            >
              <option value="CALL">Appel</option>
              <option value="MEETING">Réunion</option>
              <option value="EMAIL">Email</option>
              <option value="NOTE">Note</option>
              <option value="MESSAGE">Message</option>
            </Select>
            <Input
              label="Date"
              type="datetime-local"
              value={interactionDate}
              onChange={(e) => setInteractionDate(e.target.value)}
              disabled={!isAdmin || savingInteraction}
            />
            <Input
              label="Prochaine action (optionnel)"
              type="datetime-local"
              value={interactionNextAction}
              onChange={(e) => setInteractionNextAction(e.target.value)}
              disabled={!isAdmin || savingInteraction}
            />
            <label className="flex w-full flex-col gap-1 md:col-span-2" id="project-interaction-content">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Contenu</span>
              <textarea
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                value={interactionContent}
                onChange={(e) => setInteractionContent(e.target.value)}
                rows={3}
                disabled={!isAdmin || savingInteraction}
                placeholder="Compte-rendu, décision, risques, prochaines étapes…"
                required
              />
            </label>
            <div className="flex items-center justify-end gap-2 md:col-span-2">
              {interactionInfo ? <span className="text-xs text-emerald-500">{interactionInfo}</span> : null}
              {editingInteraction ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingInteraction(null);
                    setInteractionType('CALL');
                    setInteractionContent('');
                    setInteractionNextAction('');
                    setInteractionDate(new Date().toISOString().slice(0, 16));
                  }}
                  disabled={savingInteraction}
                >
                  Annuler l’édition
                </Button>
              ) : null}
              <Button type="submit" disabled={!isAdmin || savingInteraction}>
                {savingInteraction ? 'Enregistrement…' : editingInteraction ? 'Mettre à jour' : 'Ajouter une interaction'}
              </Button>
            </div>
          </form>
        </div>

        {interactionRequestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {interactionRequestId}</p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches du projet</p>
            <p className="text-xs text-[var(--text-secondary)]">Groupées par phase. Mises à jour en direct.</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/app/pro/${businessId}/tasks?projectId=${projectId}`}>Voir dans Tâches</Link>
          </Button>
        </div>
        {taskError ? <p className="text-xs text-rose-500">{taskError}</p> : null}
        {tasksLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des tâches…</p>
        ) : tasks.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">
              {project.startedAt
                ? 'Aucune tâche générée : aucun service vendu n’a de template.'
                : 'Aucune tâche pour ce projet.'}
            </p>
            {project.startedAt ? (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/app/pro/${businessId}/services`}>Configurer templates dans le catalogue</Link>
              </Button>
            ) : !project.startedAt ? (
              <Button
                size="sm"
                variant="outline"
                onClick={startProject}
                disabled={startLoading || !canStart || !isAdmin}
              >
                {startLoading ? 'Démarrage…' : 'Démarrer pour générer les tâches'}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {['CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP', null].map((phase) => {
              const group = tasks.filter((t) => (t.phase ?? null) === phase);
              if (group.length === 0) return null;
              return (
                <div key={phase ?? 'none'} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                      {phaseLabel(phase as TaskPhase)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {group.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Échéance {formatDate(task.dueDate)} · {task.assigneeName ?? task.assigneeEmail ?? 'Non assigné'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Select
                              value={task.status}
                              onChange={(e) => updateTask(task, { status: e.target.value as TaskStatus })}
                              disabled={!isAdmin || taskActionId === task.id}
                            >
                              {TASK_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={task.progress}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateTask(task, { progress: Number(e.target.value) })
                              }
                              disabled={!isAdmin || taskActionId === task.id}
                              className="w-24"
                              aria-label="Progression"
                            />
                            <Input
                              type="date"
                              value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateTask(task, { dueDate: e.target.value || null })
                              }
                              disabled={!isAdmin || taskActionId === task.id}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(archiveAction)}
        onCloseAction={() => {
          if (archiveLoading) return;
          setArchiveAction(null);
        }}
        title={archiveAction === 'archive' ? 'Archiver le projet ?' : 'Restaurer le projet ?'}
        description={
          archiveAction === 'archive'
            ? 'Le projet sera figé : démarrage et modification des services bloqués.'
            : 'Le projet repasse en actif.'
        }
      >
        <div className="space-y-4">
          {archiveError ? <p className="text-sm font-semibold text-rose-500">{archiveError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setArchiveAction(null)} disabled={archiveLoading}>
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={() => (archiveAction ? performArchive(archiveAction) : undefined)}
              disabled={archiveLoading || !isAdmin}
            >
              {archiveLoading
                ? 'Action…'
                : archiveAction === 'archive'
                  ? 'Archiver'
                  : 'Restaurer'}
            </Button>
          </div>
          {archiveRequestId ? (
            <p className="text-[10px] text-[var(--text-faint)]">Req: {archiveRequestId}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={serviceModalOpen}
        onCloseAction={() => {
          if (savingService) return;
          setServiceModalOpen(false);
          resetServiceForm();
        }}
        title={editingService ? 'Modifier le service' : 'Ajouter un service'}
        description="Sélectionne un service du catalogue."
      >
        <form onSubmit={submitService} className="space-y-3">
            <Select
              label="Service"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              disabled={savingService || !isAdmin}
            >
              <option value="">— Choisir —</option>
              {serviceOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.code} · {opt.name} (Templates: {opt.templateCount ?? 0})
                </option>
              ))}
            </Select>
          <Input
            label="Quantité"
            type="number"
            min={1}
            value={quantity}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setQuantity(Math.max(1, Number(e.target.value)))}
            disabled={savingService || !isAdmin}
          />
          <Input
            label="Prix unitaire (centimes) — optionnel"
            type="number"
            min={0}
            value={priceCents}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPriceCents(e.target.value)}
            disabled={savingService || !isAdmin}
          />
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Notes</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={savingService || !isAdmin}
              rows={3}
            />
          </label>
          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Ajout/édition de services réservé aux admins/owners.
            </p>
          ) : null}
          {serviceError ? <p className="text-xs text-rose-500">{serviceError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setServiceModalOpen(false)} disabled={savingService}>
              Annuler
            </Button>
            <Button type="submit" disabled={savingService || !isAdmin}>
              {savingService ? 'Enregistrement…' : editingService ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
