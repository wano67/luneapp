'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import {
  CalendarDays, Receipt, Plus, Check, X, Trash2, Send, ArrowLeft,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeaveItem = {
  id: string;
  userId: string;
  userName: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

type ExpenseItem = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  amountCents: number;
  category: string | null;
  description: string | null;
  expenseDate: string;
  status: string;
  projectName: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Congés payés',
  SICK: 'Maladie',
  PERSONAL: 'Personnel',
  MATERNITY: 'Maternité',
  PATERNITY: 'Paternité',
  OTHER: 'Autre',
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
};

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  SUBMITTED: 'Soumis',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
  REIMBURSED: 'Remboursé',
};

function statusVariant(status: string): 'pro' | 'neutral' | 'danger' {
  if (status === 'APPROVED' || status === 'REIMBURSED') return 'pro';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'leave' | 'expenses';

export default function LeaveExpensesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [tab, setTab] = useState<Tab>('leave');

  // Leave state
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveType, setLeaveType] = useState('VACATION');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSaving, setLeaveSaving] = useState(false);

  // Expense state
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseSaving, setExpenseSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const leavePath = `/api/pro/businesses/${businessId}/leave-requests`;
  const expensePath = `/api/pro/businesses/${businessId}/expense-reports`;

  // Load data
  const loadLeaves = useCallback(async () => {
    if (!businessId) return;
    setLoadingLeaves(true);
    try {
      const res = await fetchJson<{ items: LeaveItem[] }>(leavePath);
      if (res.ok && res.data?.items) setLeaves(res.data.items);
    } finally {
      setLoadingLeaves(false);
    }
  }, [businessId, leavePath]);

  const loadExpenses = useCallback(async () => {
    if (!businessId) return;
    setLoadingExpenses(true);
    try {
      const res = await fetchJson<{ items: ExpenseItem[] }>(expensePath);
      if (res.ok && res.data?.items) setExpenses(res.data.items);
    } finally {
      setLoadingExpenses(false);
    }
  }, [businessId, expensePath]);

  useEffect(() => { void loadLeaves(); }, [loadLeaves]);
  useEffect(() => { void loadExpenses(); }, [loadExpenses]);

  // Leave actions
  async function createLeave(e: React.FormEvent) {
    e.preventDefault();
    setLeaveSaving(true);
    setError(null);
    const res = await fetchJson<{ item: LeaveItem }>(leavePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: leaveType, startDate: leaveStart, endDate: leaveEnd, reason: leaveReason || undefined }),
    });
    setLeaveSaving(false);
    if (res.ok && res.data?.item) {
      setLeaves((prev) => [res.data!.item, ...prev]);
      setShowLeaveForm(false);
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
    } else {
      setError(res.error ?? 'Erreur lors de la création.');
    }
  }

  async function reviewLeave(id: string, status: 'APPROVED' | 'REJECTED') {
    const res = await fetchJson<{ item: LeaveItem }>(`${leavePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok && res.data?.item) {
      setLeaves((prev) => prev.map((l) => (l.id === id ? res.data!.item : l)));
    }
  }

  async function deleteLeave(id: string) {
    if (!window.confirm('Supprimer cette demande ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${leavePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setLeaves((prev) => prev.filter((l) => l.id !== id));
  }

  // Expense actions
  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpenseSaving(true);
    setError(null);
    const amountCents = Math.round(parseFloat(expenseAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      setError('Montant invalide.');
      setExpenseSaving(false);
      return;
    }
    const res = await fetchJson<{ item: ExpenseItem }>(expensePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: expenseTitle,
        amountCents,
        category: expenseCategory || undefined,
        description: expenseDesc || undefined,
        expenseDate: expenseDate,
      }),
    });
    setExpenseSaving(false);
    if (res.ok && res.data?.item) {
      setExpenses((prev) => [res.data!.item, ...prev]);
      setShowExpenseForm(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseCategory('');
      setExpenseDate('');
      setExpenseDesc('');
    } else {
      setError(res.error ?? 'Erreur lors de la création.');
    }
  }

  async function submitExpense(id: string) {
    const res = await fetchJson<{ item: ExpenseItem }>(`${expensePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submit: true }),
    });
    if (res.ok && res.data?.item) {
      setExpenses((prev) => prev.map((e) => (e.id === id ? res.data!.item : e)));
    }
  }

  async function reviewExpense(id: string, status: 'APPROVED' | 'REJECTED' | 'REIMBURSED') {
    const res = await fetchJson<{ item: ExpenseItem }>(`${expensePath}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok && res.data?.item) {
      setExpenses((prev) => prev.map((e) => (e.id === id ? res.data!.item : e)));
    }
  }

  async function deleteExpense(id: string) {
    if (!window.confirm('Supprimer cette note ?')) return;
    const res = await fetchJson<{ ok: boolean }>(`${expensePath}/${id}`, { method: 'DELETE' });
    if (res.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  // KPIs
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING').length;
  const approvedLeaves = leaves.filter((l) => l.status === 'APPROVED').length;
  const totalLeaveDays = leaves.filter((l) => l.status === 'APPROVED').reduce((sum, l) => sum + l.days, 0);

  const pendingExpenses = expenses.filter((e) => e.status === 'SUBMITTED').length;
  const totalExpenseAmount = expenses
    .filter((e) => e.status === 'APPROVED' || e.status === 'REIMBURSED')
    .reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/app/pro/${businessId}/team`} className="text-[var(--text-faint)] hover:text-[var(--text)]">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl font-semibold">Congés &amp; Notes de frais</h1>
          </div>
          <p className="text-sm text-[var(--text-faint)]">
            Gérez les demandes de congés et les notes de frais de l&apos;équipe.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setTab('leave')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'leave'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text)]'
          }`}
        >
          <CalendarDays className="w-4 h-4 inline mr-1" />
          Congés ({leaves.length})
        </button>
        <button
          onClick={() => setTab('expenses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'expenses'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text)]'
          }`}
        >
          <Receipt className="w-4 h-4 inline mr-1" />
          Notes de frais ({expenses.length})
        </button>
      </div>

      {/* ===================== LEAVE TAB ===================== */}
      {tab === 'leave' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{pendingLeaves}</div>
              <div className="text-xs text-[var(--text-faint)]">En attente</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{approvedLeaves}</div>
              <div className="text-xs text-[var(--text-faint)]">Approuvés</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{totalLeaveDays}j</div>
              <div className="text-xs text-[var(--text-faint)]">Jours approuvés</div>
            </Card>
          </div>

          {/* New leave form */}
          {!showLeaveForm ? (
            <Button size="sm" onClick={() => setShowLeaveForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nouvelle demande
            </Button>
          ) : (
            <Card className="p-4">
              <form onSubmit={createLeave} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <select
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                    >
                      {Object.entries(LEAVE_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Du</label>
                    <Input type="date" required value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Au</label>
                    <Input type="date" required value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Motif (optionnel)</label>
                  <Input placeholder="Motif..." value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowLeaveForm(false)}>Annuler</Button>
                  <Button type="submit" disabled={leaveSaving}>{leaveSaving ? 'En cours...' : 'Envoyer'}</Button>
                </div>
              </form>
            </Card>
          )}

          {/* Leave list */}
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Jours</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLeaves && <TableEmpty>Chargement...</TableEmpty>}
                {!loadingLeaves && leaves.length === 0 && <TableEmpty>Aucune demande de congé.</TableEmpty>}
                {!loadingLeaves && leaves.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.userName}</TableCell>
                    <TableCell>{LEAVE_TYPE_LABELS[l.type] ?? l.type}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(l.startDate).toLocaleDateString('fr-FR')} — {new Date(l.endDate).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>{l.days}j</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(l.status)}>
                        {LEAVE_STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {isAdmin && l.status === 'PENDING' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => reviewLeave(l.id, 'APPROVED')} title="Approuver">
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => reviewLeave(l.id, 'REJECTED')} title="Refuser">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {l.status === 'PENDING' && (
                        <Button size="sm" variant="outline" onClick={() => deleteLeave(l.id)} title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* ===================== EXPENSES TAB ===================== */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{pendingExpenses}</div>
              <div className="text-xs text-[var(--text-faint)]">En attente</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{expenses.length}</div>
              <div className="text-xs text-[var(--text-faint)]">Total notes</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold">{formatCents(totalExpenseAmount)}</div>
              <div className="text-xs text-[var(--text-faint)]">Montant approuvé</div>
            </Card>
          </div>

          {/* New expense form */}
          {!showExpenseForm ? (
            <Button size="sm" onClick={() => setShowExpenseForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nouvelle note
            </Button>
          ) : (
            <Card className="p-4">
              <form onSubmit={createExpense} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium">Titre</label>
                    <Input required placeholder="Ex: Déjeuner client" value={expenseTitle} onChange={(e) => setExpenseTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Montant (EUR)</label>
                    <Input required type="number" step="0.01" min="0.01" placeholder="45.00" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date</label>
                    <Input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Catégorie</label>
                    <Input placeholder="Transport, Repas, Fournitures..." value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input placeholder="Détails..." value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowExpenseForm(false)}>Annuler</Button>
                  <Button type="submit" disabled={expenseSaving}>{expenseSaving ? 'En cours...' : 'Créer'}</Button>
                </div>
              </form>
            </Card>
          )}

          {/* Expense list */}
          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collaborateur</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingExpenses && <TableEmpty>Chargement...</TableEmpty>}
                {!loadingExpenses && expenses.length === 0 && <TableEmpty>Aucune note de frais.</TableEmpty>}
                {!loadingExpenses && expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.userName}</TableCell>
                    <TableCell>
                      {e.title}
                      {e.category && <span className="text-xs text-[var(--text-faint)] ml-1">({e.category})</span>}
                    </TableCell>
                    <TableCell>{formatCents(e.amountCents)}</TableCell>
                    <TableCell className="text-sm">{new Date(e.expenseDate).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(e.status)}>
                        {EXPENSE_STATUS_LABELS[e.status] ?? e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {e.status === 'DRAFT' && (
                        <Button size="sm" variant="outline" onClick={() => submitExpense(e.id)} title="Soumettre">
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {isAdmin && e.status === 'SUBMITTED' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => reviewExpense(e.id, 'APPROVED')} title="Approuver">
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => reviewExpense(e.id, 'REJECTED')} title="Refuser">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {isAdmin && e.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" onClick={() => reviewExpense(e.id, 'REIMBURSED')} title="Marquer remboursé">
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(e.status === 'DRAFT') && (
                        <Button size="sm" variant="outline" onClick={() => deleteExpense(e.id)} title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
