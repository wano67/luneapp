// src/app/app/pro/[businessId]/finances/expenses/[expenseId]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type FinanceType = 'INCOME' | 'EXPENSE';

type FinanceDetail = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName?: string | null;
  type: FinanceType;
  amountCents: string;
  amount: number;
  category: string;
  date: string;
  note: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type FinanceResponse = { item: FinanceDetail };

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCents(value: string | null | undefined, currency = 'EUR') {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num / 100);
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const expenseId = (params?.expenseId ?? '') as string;

  const [expense, setExpense] = useState<FinanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function load(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<FinanceResponse>(
        `/api/pro/businesses/${businessId}/finances/${expenseId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Dépense introuvable.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setExpense(null);
        return;
      }
      setExpense(res.data.item);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
      setExpense(null);
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, expenseId]);

  const requestHint = requestId ? `Ref: ${requestId}` : null;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Dépense
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dépense #{expenseId}</h1>
            <p className="text-sm text-[var(--text-secondary)]">Détail d&apos;une dépense enregistrée.</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/app/pro/${businessId}/finances`}>Retour finances</Link>
          </Button>
        </div>
        {requestHint ? <p className="text-xs text-[var(--text-secondary)]">{requestHint}</p> : null}
      </Card>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement de la dépense…</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <p className="text-xs text-[var(--danger)]">Vérifie l&apos;identifiant ou tes droits.</p>
        </Card>
      ) : expense ? (
        <div className="space-y-4">
          <Card className="space-y-2 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge variant="neutral">{expense.type === 'EXPENSE' ? 'Dépense' : 'Revenu'}</Badge>
              <Badge variant="neutral">{expense.category}</Badge>
            </div>
            <p className="text-2xl font-semibold text-[var(--text-primary)]">
              {formatCents(expense.amountCents)} · {expense.projectName ?? expense.projectId ?? 'Projet ?'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Date : {formatDate(expense.date)}</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Créé le {formatDate(expense.createdAt)} · Mis à jour {formatDate(expense.updatedAt)}
            </p>
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Note / Metadata</p>
              <p className="text-sm text-[var(--text-primary)]">{expense.note ?? '—'}</p>
              {expense.metadata ? (
                <pre className="mt-2 overflow-auto rounded-lg bg-black/5 p-2 text-xs text-[var(--text-secondary)]">
                  {JSON.stringify(expense.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Dépense introuvable.</p>
        </Card>
      )}
    </div>
  );
}
