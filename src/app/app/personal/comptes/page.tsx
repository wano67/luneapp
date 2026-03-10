'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layouts/PageContainer';
import Modal from '@/components/ui/modal';
import { fmtKpi } from '@/lib/format';
import { BANK_MAP } from '@/config/banks';
import dynamic from 'next/dynamic';
import CreateAccountWizard, { type WizardResult } from './CreateAccountWizard';
import BankGroup from './BankGroup';
import { type AccountItem } from './AccountCard';
import { AccountEditModal } from './AccountEditModal';

const CsvImportModal = dynamic(() => import('@/components/CsvImportModal'), { ssr: false });
import { useFileDropHandler } from '@/components/file-drop/FileDropProvider';
import { emitWalletRefresh } from '@/lib/personalEvents';
import { useToast } from '@/components/ui/toast';
import { Building2, PenLine, Upload, Plus } from 'lucide-react';

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function getErrorFromJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  if (!('error' in json)) return null;
  const err = (json as { error?: unknown }).error;
  return typeof err === 'string' ? err : null;
}

/* ═══ Category grouping ═══ */

type CategoryKey = 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'LOAN';
const CATEGORY_ORDER: CategoryKey[] = ['CHECKING', 'SAVINGS', 'INVESTMENT', 'LOAN'];
const CATEGORY_LABEL: Record<CategoryKey, string> = {
  CHECKING: 'Espèces',
  SAVINGS: 'Épargne',
  INVESTMENT: 'Investissement',
  LOAN: 'Prêts',
};
const CATEGORY_TYPES: Record<CategoryKey, AccountItem['type'][]> = {
  CHECKING: ['CASH', 'CURRENT'],
  SAVINGS: ['SAVINGS'],
  INVESTMENT: ['INVEST'],
  LOAN: ['LOAN'],
};

const CATEGORY_TYPE_KEY: Record<CategoryKey, string> = {
  CHECKING: 'courant',
  SAVINGS: 'epargne',
  INVESTMENT: 'investissement',
  LOAN: 'prets',
};

const CATEGORY_ICON: Record<CategoryKey, string> = {
  CHECKING: '\uD83D\uDCB3',
  SAVINGS: '\uD83C\uDFE6',
  INVESTMENT: '\uD83D\uDCC8',
  LOAN: '\uD83C\uDFE0',
};

export default function ComptesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importAutoOpenedRef = useRef(false);
  const powensCallbackRef = useRef(false);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccountItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // create modal
  const [open, setOpen] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);

  // Add account modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Powens
  const [powensConnecting, setPowensConnecting] = useState(false);
  const [powensSyncing, setPowensSyncing] = useState(false);
  const [powensConnected, setPowensConnected] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/accounts', { credentials: 'include' });
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      const json = await safeJson(res);
      if (!res.ok) throw new Error(getErrorFromJson(json) ?? 'Erreur');

      const itemsRaw =
        json && typeof json === 'object' && 'items' in json
          ? (json as { items?: unknown }).items
          : [];

      setItems(Array.isArray(itemsRaw) ? (itemsRaw as AccountItem[]) : []);
      setError(null);
    } catch {
      setError('Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Vérifier le statut Powens et sync automatique si connecté
    fetch('/api/personal/powens/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then(async (d) => {
        if (!d?.connected) return;
        setPowensConnected(true);
        // Auto-sync en arrière-plan pour actualiser les soldes
        try {
          setPowensSyncing(true);
          const res = await fetch('/api/personal/powens/sync', {
            method: 'POST',
            credentials: 'include',
          });
          if (res.ok) {
            await load();
            emitWalletRefresh();
          }
        } catch {
          // silent — l'utilisateur voit les données du dernier sync
        } finally {
          setPowensSyncing(false);
        }
      })
      .catch(() => {});
  }, []);

  // Callback Powens (retour de la webview — Powens ajoute ?connection_id=X)
  useEffect(() => {
    if (powensCallbackRef.current) return;
    const connectionId = searchParams?.get('connection_id');
    if (!connectionId) return;
    powensCallbackRef.current = true;

    setPowensSyncing(true);
    fetch('/api/personal/powens/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        const json = await safeJson(res);
        if (res.ok && json && typeof json === 'object') {
          const data = json as { accountsSynced?: number; transactionsAdded?: number };
          toast.success(`${data.accountsSynced || 0} comptes synchronisés, ${data.transactionsAdded || 0} transactions importées`);
          setPowensConnected(true);
          await load();
          emitWalletRefresh();
        } else {
          toast.error('Erreur lors de la synchronisation bancaire');
        }
      })
      .catch(() => toast.error('Erreur lors de la synchronisation bancaire'))
      .finally(() => setPowensSyncing(false));

    // Nettoyer les params
    router.replace('/app/personal/comptes');
  }, [searchParams, router, toast]);

  useEffect(() => {
    if (importAutoOpenedRef.current) return;
    const shouldOpen = searchParams?.get('import') === '1';
    if (!shouldOpen) return;
    importAutoOpenedRef.current = true;
    setImportFile(null);
    setImportError(null);
    setOpenImport(true);
  }, [searchParams]);

  const handleCsvFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files as ArrayLike<File>);
    if (!list.length) return;
    const file = list[0];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isCsv = ext === 'csv' || file.type === 'text/csv';
    if (!isCsv) {
      setImportError(`Votre fichier est un fichier .${ext || 'inconnu'}. Le format requis est .csv.`);
      setImportFile(null);
      setOpenImport(true);
      return;
    }
    setImportError(null);
    setImportFile(file);
    setOpenImport(true);
  }, []);

  useFileDropHandler(handleCsvFiles, { enabled: true });

  /* ═══ Computed values ═══ */

  const nonLoanItems = useMemo(() => items.filter((a) => a.type !== 'LOAN'), [items]);
  const loanItems = useMemo(() => items.filter((a) => a.type === 'LOAN'), [items]);

  const visibleItems = useMemo(
    () => (showHidden ? items : items.filter((a) => !a.hidden)),
    [items, showHidden]
  );
  const hasHiddenAccounts = useMemo(() => items.some((a) => a.hidden), [items]);

  const totalCents = useMemo(() => {
    return nonLoanItems.reduce<bigint>((acc, a) => acc + BigInt(a.balanceCents || '0'), 0n);
  }, [nonLoanItems]);

  const totalDelta30 = useMemo(() => {
    return nonLoanItems.reduce<bigint>((acc, a) => acc + BigInt(a.delta30Cents || '0'), 0n);
  }, [nonLoanItems]);

  const loanEncoursCents = useMemo(() => {
    return loanItems.reduce<bigint>((acc, a) => acc + BigInt(a.loanPrincipalCents || '0'), 0n);
  }, [loanItems]);

  const hasLoans = loanItems.length > 0;
  const deltaPositive = totalDelta30 >= 0n;

  /* ═══ Bank grouping per category ═══ */

  type BankGroupData = {
    bankKey: string;
    bankName: string;
    bankWebsiteUrl: string | null;
    accounts: AccountItem[];
    totalCents: bigint;
  };
  type CategoryGroupData = {
    category: CategoryKey;
    bankGroups: BankGroupData[];
    totalCents: bigint;
  };

  const categoryGroups = useMemo<CategoryGroupData[]>(() => {
    return CATEGORY_ORDER
      .map((cat) => {
        const types = CATEGORY_TYPES[cat];
        const catAccounts = visibleItems.filter((a) => types.includes(a.type));
        if (!catAccounts.length) return null;

        const bankMap = new Map<string, AccountItem[]>();
        for (const a of catAccounts) {
          let key: string;
          if (a.bankCode && BANK_MAP.has(a.bankCode)) {
            key = a.bankCode;
          } else if (a.institution) {
            key = `OTHER:${a.institution}`;
          } else {
            key = 'UNKNOWN';
          }
          const arr = bankMap.get(key);
          if (arr) arr.push(a);
          else bankMap.set(key, [a]);
        }

        const bankGroups: BankGroupData[] = [];
        for (const [key, accounts] of bankMap) {
          let bankName: string;
          let bankWebsiteUrl: string | null = null;
          if (key === 'UNKNOWN') {
            bankName = 'Autre';
          } else if (key.startsWith('OTHER:')) {
            bankName = key.slice(6);
          } else {
            const bank = BANK_MAP.get(key)!;
            bankName = bank.name;
            bankWebsiteUrl = bank.websiteUrl;
          }
          const total = accounts.reduce(
            (s, a) => s + BigInt(cat === 'LOAN' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0')),
            0n
          );
          bankGroups.push({ bankKey: key, bankName, bankWebsiteUrl, accounts, totalCents: total });
        }

        bankGroups.sort((a, b) => {
          const aOrder = a.bankKey === 'UNKNOWN' ? 2 : a.bankKey.startsWith('OTHER:') ? 1 : 0;
          const bOrder = b.bankKey === 'UNKNOWN' ? 2 : b.bankKey.startsWith('OTHER:') ? 1 : 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.bankName.localeCompare(b.bankName, 'fr');
        });

        const catTotal = catAccounts.reduce(
          (s, a) => s + BigInt(cat === 'LOAN' ? (a.loanPrincipalCents || '0') : (a.balanceCents || '0')),
          0n
        );
        return { category: cat, bankGroups, totalCents: catTotal };
      })
      .filter((g): g is CategoryGroupData => g !== null);
  }, [visibleItems]);

  /* ═══ Powens handlers ═══ */

  async function handlePowensConnect() {
    setPowensConnecting(true);
    try {
      const res = await fetch('/api/personal/powens/connect', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await safeJson(res);
      if (res.ok && json && typeof json === 'object' && 'webviewUrl' in json) {
        window.location.href = (json as { webviewUrl: string }).webviewUrl;
        return;
      }
      const errMsg = getErrorFromJson(json) ?? 'Impossible de se connecter';
      toast.error(errMsg);
    } catch {
      toast.error('Impossible de se connecter');
    } finally {
      setPowensConnecting(false);
    }
  }

  async function handlePowensAddBank() {
    setPowensConnecting(true);
    try {
      const res = await fetch('/api/personal/powens/add-connection', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await safeJson(res);
      if (res.ok && json && typeof json === 'object' && 'webviewUrl' in json) {
        window.location.href = (json as { webviewUrl: string }).webviewUrl;
        return;
      }
      toast.error(getErrorFromJson(json) ?? 'Impossible de se connecter');
    } catch {
      toast.error('Impossible de se connecter');
    } finally {
      setPowensConnecting(false);
    }
  }

  /* ═══ Create handler (wizard) ═══ */

  async function onWizardSubmit(data: WizardResult) {
    setCreating(true);
    setWizardError(null);
    try {
      const res = await fetch('/api/personal/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          currency: data.currency,
          institution: data.institution,
          iban: data.iban,
          initialCents: data.initialCents,
          bankCode: data.bankCode,
          productCode: data.productCode,
          interestRateBps: data.interestRateBps,
          loanPrincipalCents: data.loanPrincipalCents,
          loanDurationMonths: data.loanDurationMonths,
          loanStartDate: data.loanStartDate,
        }),
      });

      const json = await safeJson(res);
      if (!res.ok) {
        setWizardError(getErrorFromJson(json) ?? 'Création impossible.');
        return;
      }

      setOpen(false);
      setWizardError(null);
      setSuccessMessage('Compte créé avec succès.');
      await load();
      emitWalletRefresh();
    } catch {
      setWizardError('Création impossible.');
    } finally {
      setCreating(false);
    }
  }

  /* ═══ Edit handler ═══ */

  function openEditModal(account: AccountItem) {
    setEditingAccount(account);
    setSuccessMessage(null);
    setEditOpen(true);
  }

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 style={{ color: 'var(--text)', fontSize: 28, fontWeight: 700 }}>Mes Comptes</h1>
        <div className="flex gap-2 flex-wrap">
          {hasHiddenAccounts ? (
            <Button variant="outline" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? 'Masquer les cachés' : 'Voir les cachés'}
            </Button>
          ) : null}
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Ajouter un compte
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">Erreur</p>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      ) : null}

      {/* KPI Cards */}
      <div className={`grid grid-cols-1 gap-4 ${hasLoans ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        <Card className="p-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text-faint)]">Patrimoine net</span>
          {loading ? (
            <div className="h-8 w-28 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
          ) : (
            <span className="text-2xl font-extrabold" style={{ color: 'var(--shell-accent)' }}>
              {fmtKpi(totalCents.toString())}
            </span>
          )}
        </Card>
        <Card className="p-4 flex flex-col gap-1">
          <span className="text-sm font-medium text-[var(--text-faint)]">Variation 30 jours</span>
          {loading ? (
            <div className="h-8 w-28 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
          ) : (
            <span
              className="text-2xl font-extrabold"
              style={{ color: deltaPositive ? 'var(--success)' : 'var(--danger)' }}
            >
              {deltaPositive ? '+' : ''}{fmtKpi(totalDelta30.toString())}
            </span>
          )}
        </Card>
        {hasLoans ? (
          <Card className="p-4 flex flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-faint)]">Encours prêts</span>
            {loading ? (
              <div className="h-8 w-28 rounded-lg bg-[var(--surface-2)] animate-skeleton-pulse" />
            ) : (
              <>
                <span className="text-2xl font-extrabold" style={{ color: 'var(--danger)' }}>
                  {fmtKpi(loanEncoursCents.toString())}
                </span>
                <span className="text-xs text-[var(--text-faint)]">
                  {loanItems.length} {loanItems.length > 1 ? 'prêts' : 'prêt'}
                </span>
              </>
            )}
          </Card>
        ) : null}
      </div>

      {/* Accounts grouped by category */}
      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">
            Aucun compte. Connecte ta banque ou crée un compte manuellement.
          </p>
          <div className="mt-3">
            <Button onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              Ajouter un compte
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-bold text-[var(--text)]">
            {items.length} {items.length > 1 ? 'comptes' : 'compte'}
          </h2>
          {categoryGroups.map(({ category: cat, bankGroups, totalCents: groupTotal }) => (
            <section
              key={cat}
              className="rounded-2xl bg-[var(--shell-accent)] p-3 sm:p-5 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{CATEGORY_ICON[cat]}</span>
                  <span className="text-sm font-medium text-white/80">{CATEGORY_LABEL[cat]}</span>
                </div>
                <Link
                  href={`/app/personal/comptes/type/${CATEGORY_TYPE_KEY[cat]}`}
                  className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:opacity-90 transition-opacity"
                  style={{ fontFamily: 'var(--font-barlow), sans-serif' }}
                >
                  Détails
                  <span aria-hidden>→</span>
                </Link>
              </div>

              <p className="text-3xl font-extrabold text-white mb-5">
                {fmtKpi(groupTotal.toString())}
              </p>

              <div className="flex flex-col gap-4">
                {bankGroups.map((bg) => (
                  <div key={bg.bankKey} className="rounded-xl bg-white/10 p-3 sm:p-4 backdrop-blur-sm">
                    <BankGroup
                      bankName={bg.bankName}
                      bankWebsiteUrl={bg.bankWebsiteUrl}
                      totalCents={bg.totalCents}
                      accounts={bg.accounts}
                      onEdit={openEditModal}
                      onNavigate={(id) => router.push(`/app/personal/comptes/${id}`)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Create Modal (Wizard) */}
      <Modal
        open={open}
        onCloseAction={() => {
          if (creating) return;
          setOpen(false);
          setWizardError(null);
        }}
        title="Créer un compte"
        description="Choisis une catégorie pour commencer."
      >
        <CreateAccountWizard
          onSubmit={onWizardSubmit}
          onCancel={() => {
            setOpen(false);
            setWizardError(null);
          }}
          submitting={creating}
          error={wizardError}
        />
      </Modal>

      {/* Edit Modal */}
      <AccountEditModal
        open={editOpen}
        account={editingAccount}
        onClose={() => {
          setEditOpen(false);
          setEditingAccount(null);
        }}
        onSaved={async () => {
          await load();
          emitWalletRefresh();
        }}
      />

      <CsvImportModal
        open={openImport}
        file={importFile}
        onCloseAction={() => {
          setOpenImport(false);
          setImportFile(null);
          setImportError(null);
        }}
        accounts={items.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        defaultAccountId={items[0]?.id}
        onConfirmImport={async () => {
          await load();
          emitWalletRefresh();
          if (importFile) setLastImportedFileName(importFile.name);
          setImportFile(null);
          setImportError(null);
        }}
        onSelectFiles={handleCsvFiles}
        externalError={importError}
      />

      {/* Add Account Modal */}
      <Modal
        open={showAddModal}
        onCloseAction={() => setShowAddModal(false)}
        title="Ajouter un compte"
        description="Choisis un mode d&apos;ajout."
      >
        <div className="flex flex-col gap-3">
          <button
            className="flex items-start gap-4 rounded-xl border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
            disabled={powensConnecting}
            onClick={() => {
              setShowAddModal(false);
              if (powensConnected) {
                handlePowensAddBank();
              } else {
                handlePowensConnect();
              }
            }}
          >
            <div className="rounded-lg bg-[var(--shell-accent)]/10 p-2.5 text-[var(--shell-accent)]">
              <Building2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">
                {powensConnected ? 'Ajouter une banque' : 'Connecter ma banque'}
              </p>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                Importez automatiquement vos comptes et transactions
              </p>
            </div>
          </button>

          <button
            className="flex items-start gap-4 rounded-xl border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-2)] transition-colors"
            onClick={() => {
              setShowAddModal(false);
              setWizardError(null);
              setSuccessMessage(null);
              setOpen(true);
            }}
          >
            <div className="rounded-lg bg-[var(--text-faint)]/10 p-2.5 text-[var(--text-faint)]">
              <PenLine size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">Créer manuellement</p>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                Ajoutez un compte en saisissant les détails
              </p>
            </div>
          </button>

          <button
            className="flex items-center gap-2 justify-center rounded-xl py-2.5 text-xs font-medium text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
            onClick={() => {
              setShowAddModal(false);
              setImportFile(null);
              setImportError(null);
              setOpenImport(true);
            }}
          >
            <Upload size={14} />
            Importer un fichier CSV
          </button>
        </div>
      </Modal>

      {lastImportedFileName ? (
        <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          Import réussi — {lastImportedFileName}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-3 text-sm text-[var(--success)]">
          {successMessage}
        </div>
      ) : null}
    </PageContainer>
  );
}
