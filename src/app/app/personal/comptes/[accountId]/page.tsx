'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { fmtKpi, fmtDate } from '@/lib/format';
import { loanMonthlyPaymentCents, loanTotalInterestCents, annualYieldCents, formatRateBps } from '@/lib/finance';
import { PRODUCT_MAP } from '@/config/bankingProducts';
import { emitWalletRefresh } from '@/lib/personalEvents';

const InlineTransactionModal = dynamic(() => import('./InlineTransactionModal'), { ssr: false });

type Account = {
  id: string;
  name: string;
  type: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH' | 'LOAN';
  currency: string;
  institution: string | null;
  iban: string | null;
  bankCode: string | null;
  productCode: string | null;
  interestRateBps: number | null;
  loanPrincipalCents: string | null;
  loanDurationMonths: number | null;
  loanStartDate: string | null;
  balanceCents: string;
  delta30Cents: string;
  createdAt: string;
};

type Txn = {
  id: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
  amountCents: string;
  currency: string;
  label: string;
  note?: string | null;
  account: { id: string; name: string };
  category: { id: string; name: string } | null;
};

const TYPE_LABEL: Record<Account['type'], string> = {
  CURRENT: 'Compte courant',
  SAVINGS: 'Épargne',
  INVEST: 'Investissement',
  CASH: 'Espèces',
  LOAN: 'Prêt',
};

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId ?? '';

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<Txn[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Transaction modal
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);

  // Transaction detail modal
  const [detailTxn, setDetailTxn] = useState<Txn | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const aRes = await fetchJson<{ account: Account }>(
        `/api/personal/accounts/${encodeURIComponent(accountId)}`
      );
      if (aRes.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!aRes.ok || !aRes.data) throw new Error(aRes.error ?? `Erreur compte`);
      setAccount(aRes.data.account);

      const tRes = await fetchJson<{ items: Txn[] }>(
        `/api/personal/transactions?accountId=${encodeURIComponent(accountId)}&limit=10`
      );
      if (!tRes.ok || !tRes.data) throw new Error(tRes.error ?? `Erreur transactions`);
      setItems(tRes.data.items ?? []);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = useMemo(() => account?.name ?? 'Compte', [account]);

  const miniStats = useMemo(() => {
    const income = items
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    const expense = items
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + BigInt(t.amountCents), 0n);
    return { income, expense, count: items.length };
  }, [items]);

  const product = account?.productCode ? PRODUCT_MAP.get(account.productCode) ?? null : null;

  function openCreateTxn() {
    setEditingTxn(null);
    setTxnModalOpen(true);
  }

  function openEditTxn(txn: Txn) {
    setDetailTxn(null);
    setEditingTxn(txn);
    setTxnModalOpen(true);
  }

  async function onDeleteTxn(txnId: string) {
    const ok = window.confirm('Supprimer cette transaction ?');
    if (!ok) return;
    setDeleteLoading(true);
    try {
      const res = await fetchJson(`/api/personal/transactions/${encodeURIComponent(txnId)}`, { method: 'DELETE' });
      if (!res.ok) return;
      setDetailTxn(null);
      void load();
      emitWalletRefresh();
    } catch {
      // Silent
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <PageContainer className="space-y-5">
      <PageHeader
        title={loading ? 'Chargement…' : title}
        subtitle={
          account
            ? `Solde : ${formatCentsToEuroDisplay(account.balanceCents)} · Var. 30j : ${formatCentsToEuroDisplay(account.delta30Cents)}`
            : 'Historique des transactions du compte.'
        }
        backHref="/app/personal/comptes"
        backLabel="Comptes"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}`}>
                Toutes les transactions
              </Link>
            </Button>
            <Button size="sm" onClick={openCreateTxn}>
              Nouvelle transaction
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="p-4 text-sm text-[var(--danger)]">{error}</Card>
      ) : null}

      {/* ─── Account Info Card ─── */}
      {account && !loading ? (
        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Informations du compte</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-[var(--text-faint)]">Type</p>
              <p className="font-medium">{TYPE_LABEL[account.type]}</p>
            </div>
            {account.institution ? (
              <div>
                <p className="text-xs text-[var(--text-faint)]">Banque</p>
                <p className="font-medium">{account.institution}</p>
              </div>
            ) : null}
            {product ? (
              <div>
                <p className="text-xs text-[var(--text-faint)]">Produit</p>
                <p className="font-medium">{product.name}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-[var(--text-faint)]">Devise</p>
              <p className="font-medium">{account.currency}</p>
            </div>
            {account.iban ? (
              <div>
                <p className="text-xs text-[var(--text-faint)]">IBAN</p>
                <p className="font-medium font-mono text-xs">{account.iban}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs text-[var(--text-faint)]">Créé le</p>
              <p className="font-medium">{fmtDate(account.createdAt)}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ─── Loan Schedule Card ─── */}
      {account && account.type === 'LOAN' && account.loanPrincipalCents && account.interestRateBps && account.loanDurationMonths ? (
        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Échéancier du prêt</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-[var(--text-faint)]">Capital emprunté</p>
              <p className="font-medium">{fmtKpi(account.loanPrincipalCents)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)]">Taux annuel</p>
              <p className="font-medium">{formatRateBps(account.interestRateBps)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)]">Mensualité</p>
              <p className="font-bold" style={{ color: 'var(--shell-accent)' }}>
                {fmtKpi(loanMonthlyPaymentCents(BigInt(account.loanPrincipalCents), account.interestRateBps, account.loanDurationMonths).toString())}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)]">Durée</p>
              <p className="font-medium">{account.loanDurationMonths} mois</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)]">Total des intérêts</p>
              <p className="font-medium text-[var(--danger)]">
                {fmtKpi(loanTotalInterestCents(BigInt(account.loanPrincipalCents), account.interestRateBps, account.loanDurationMonths).toString())}
              </p>
            </div>
            {account.loanStartDate ? (
              <div>
                <p className="text-xs text-[var(--text-faint)]">Date de début</p>
                <p className="font-medium">{fmtDate(account.loanStartDate)}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* ─── Savings Yield Card ─── */}
      {account && account.type === 'SAVINGS' && account.interestRateBps ? (
        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Rendement</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-[var(--text-faint)]">Taux annuel</p>
              <p className="font-medium text-[var(--success)]">{formatRateBps(account.interestRateBps)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)]">Rendement annuel estimé</p>
              <p className="font-medium">
                ~{fmtKpi(annualYieldCents(BigInt(account.balanceCents || '0'), account.interestRateBps).toString())}
              </p>
            </div>
            {product?.maxDepositCents ? (
              <div>
                <p className="text-xs text-[var(--text-faint)]">Plafond de versement</p>
                <p className="font-medium">{fmtKpi(String(product.maxDepositCents))}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Encaissements (sélection)</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCentsToEuroDisplay(miniStats.income.toString())}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Dépenses (sélection)</p>
          <p className="mt-1 text-lg font-semibold">
            {formatCentsToEuroDisplay(miniStats.expense.toString())}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--text-faint)]">Transactions chargées</p>
          <p className="mt-1 text-lg font-semibold">{miniStats.count}</p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Dernières opérations</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/personal/transactions?accountId=${encodeURIComponent(accountId)}&import=1`}>
              Import CSV
            </Link>
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">Aucune transaction pour ce compte.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTxn(t)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors rounded-lg px-2 -mx-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.label}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {new Date(t.date).toLocaleDateString('fr-FR')}
                    {t.category ? ` · ${t.category.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCentsToEuroDisplay(t.amountCents)}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">{t.type === 'INCOME' ? 'Revenu' : t.type === 'EXPENSE' ? 'Dépense' : 'Virement'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
      {/* ─── Inline Transaction Modal ─── */}
      {account ? (
        <InlineTransactionModal
          open={txnModalOpen}
          onClose={() => { setTxnModalOpen(false); setEditingTxn(null); }}
          onSuccess={() => { void load(); emitWalletRefresh(); }}
          accountId={accountId}
          accountName={account.name}
          accountCurrency={account.currency}
          editTxn={editingTxn}
        />
      ) : null}

      {/* ─── Transaction Detail Modal ─── */}
      <Modal
        open={!!detailTxn}
        onCloseAction={() => setDetailTxn(null)}
        title="Détail de la transaction"
      >
        {detailTxn ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: BigInt(detailTxn.amountCents) < 0n ? 'var(--danger)' : 'var(--success)' }}>
                {formatCentsToEuroDisplay(detailTxn.amountCents)}
              </p>
              <p className="mt-1 text-sm text-[var(--text-faint)]">
                {detailTxn.type === 'INCOME' ? 'Revenu' : detailTxn.type === 'EXPENSE' ? 'Dépense' : 'Virement'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-[var(--text-faint)]">Libellé</p>
                <p className="font-medium">{detailTxn.label}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-faint)]">Date</p>
                <p className="font-medium">{new Date(detailTxn.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              {detailTxn.category ? (
                <div>
                  <p className="text-xs text-[var(--text-faint)]">Catégorie</p>
                  <p className="font-medium">{detailTxn.category.name}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-[var(--text-faint)]">Devise</p>
                <p className="font-medium">{detailTxn.currency}</p>
              </div>
              {detailTxn.note ? (
                <div className="col-span-2">
                  <p className="text-xs text-[var(--text-faint)]">Note</p>
                  <p className="font-medium whitespace-pre-wrap">{detailTxn.note}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDeleteTxn(detailTxn.id)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Suppression…' : 'Supprimer'}
              </Button>
              <Button
                size="sm"
                onClick={() => openEditTxn(detailTxn)}
              >
                Modifier
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
