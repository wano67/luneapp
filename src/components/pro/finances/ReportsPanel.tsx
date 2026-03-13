'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { Download } from 'lucide-react';

// ── Types ──

type BalanceAccount = {
  accountCode: string;
  accountName: string;
  totalDebitCents: string;
  totalCreditCents: string;
  soldeDebiteurCents: string;
  soldeCrediteurCents: string;
};

type BalanceData = {
  accounts: BalanceAccount[];
  totalDebitCents: string;
  totalCreditCents: string;
  isBalanced: boolean;
};

type GrandLivreAccount = {
  accountCode: string;
  accountName: string;
  totalDebitCents: string;
  totalCreditCents: string;
  soldeCents: string;
  lines: Array<{
    date: string;
    journalCode: string | null;
    entryNumber: number | null;
    memo: string | null;
    pieceRef: string | null;
    debitCents: string;
    creditCents: string;
  }>;
};

type GrandLivreData = { accounts: GrandLivreAccount[] };

function kpi(cents: string) {
  return formatCents(Number(cents));
}

function formatDate(iso: string) {
  try { return new Intl.DateTimeFormat('fr-FR').format(new Date(iso)); } catch { return iso; }
}

// ── Component ──

export function ReportsPanel({ businessId }: { businessId: string }) {
  const currentYear = new Date().getFullYear();
  const [activeReport, setActiveReport] = useState<'fec' | 'balance' | 'grand-livre'>('balance');
  const [year, setYear] = useState(String(currentYear));
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);

  // ── FEC ──
  const handleFecDownload = useCallback(async () => {
    const url = `/api/pro/businesses/${businessId}/accounting/fec?year=${year}`;
    const response = await fetch(url);
    if (!response.ok) return;
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `FEC${year}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [businessId, year]);

  const handlePdfDownload = useCallback(async (report: 'balance' | 'grand-livre') => {
    const url = `/api/pro/businesses/${businessId}/accounting/${report}/pdf?from=${from}&to=${to}`;
    const response = await fetch(url);
    if (!response.ok) return;
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report}-${from}-${to}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [businessId, from, to]);

  // ── Balance ──
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  // ── Grand Livre ──
  const [grandLivre, setGrandLivre] = useState<GrandLivreData | null>(null);
  const [grandLivreLoading, setGrandLivreLoading] = useState(true);

  useEffect(() => {
    if (activeReport === 'fec') return;
    let cancelled = false;
    if (activeReport === 'balance') {
      fetchJson<BalanceData>(
        `/api/pro/businesses/${businessId}/accounting/balance?from=${from}&to=${to}`
      ).then(res => {
        if (cancelled) return;
        setBalanceLoading(false);
        if (res.ok && res.data) setBalance(res.data);
      });
    } else if (activeReport === 'grand-livre') {
      fetchJson<GrandLivreData>(
        `/api/pro/businesses/${businessId}/accounting/grand-livre?from=${from}&to=${to}`
      ).then(res => {
        if (cancelled) return;
        setGrandLivreLoading(false);
        if (res.ok && res.data) setGrandLivre(res.data);
      });
    }
    return () => { cancelled = true; };
  }, [activeReport, businessId, from, to]);

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          className="w-44"
          value={activeReport}
          onChange={(e) => setActiveReport(e.target.value as 'fec' | 'balance' | 'grand-livre')}
        >
          <option value="balance">Balance Générale</option>
          <option value="grand-livre">Grand Livre</option>
          <option value="fec">Export FEC</option>
        </Select>

        {activeReport === 'fec' ? (
          <div className="flex items-center gap-2">
            <Select className="w-28" value={year} onChange={(e) => setYear(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Button size="sm" onClick={handleFecDownload}>Télécharger le FEC</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-xs text-[var(--text-secondary)]">→</span>
            <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="sm" variant="outline" className="gap-1" onClick={() => handlePdfDownload(activeReport as 'balance' | 'grand-livre')}>
              <Download size={14} /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* Balance Générale */}
      {activeReport === 'balance' ? (
        balanceLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : balance ? (
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                Balance Générale
              </p>
              {balance.isBalanced ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Équilibrée</span>
              ) : (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Déséquilibrée</span>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead className="text-right">Débit</TableHead>
                  <TableHead className="text-right">Crédit</TableHead>
                  <TableHead className="text-right">Solde débiteur</TableHead>
                  <TableHead className="text-right">Solde créditeur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.accounts.map((acc) => (
                  <TableRow key={acc.accountCode}>
                    <TableCell className="font-mono text-xs">{acc.accountCode}</TableCell>
                    <TableCell>{acc.accountName}</TableCell>
                    <TableCell className="text-right">{kpi(acc.totalDebitCents)}</TableCell>
                    <TableCell className="text-right">{kpi(acc.totalCreditCents)}</TableCell>
                    <TableCell className="text-right">{Number(acc.soldeDebiteurCents) > 0 ? kpi(acc.soldeDebiteurCents) : ''}</TableCell>
                    <TableCell className="text-right">{Number(acc.soldeCrediteurCents) > 0 ? kpi(acc.soldeCrediteurCents) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right">{kpi(balance.totalDebitCents)}</TableCell>
                  <TableCell className="text-right">{kpi(balance.totalCreditCents)}</TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        ) : null
      ) : null}

      {/* Grand Livre */}
      {activeReport === 'grand-livre' ? (
        grandLivreLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : grandLivre ? (
          <div className="space-y-3">
            {grandLivre.accounts.map((acc) => (
              <Card key={acc.accountCode} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-[var(--text-secondary)]">{acc.accountCode}</span>
                    <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{acc.accountName}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Solde : {kpi(acc.soldeCents)}
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Journal</TableHead>
                      <TableHead>Réf.</TableHead>
                      <TableHead>Libellé</TableHead>
                      <TableHead className="text-right">Débit</TableHead>
                      <TableHead className="text-right">Crédit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acc.lines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{formatDate(line.date)}</TableCell>
                        <TableCell className="text-xs">{line.journalCode ?? '—'}</TableCell>
                        <TableCell className="text-xs">{line.pieceRef ?? ''}</TableCell>
                        <TableCell className="text-xs">{line.memo ?? ''}</TableCell>
                        <TableCell className="text-right text-xs">{Number(line.debitCents) > 0 ? kpi(line.debitCents) : ''}</TableCell>
                        <TableCell className="text-right text-xs">{Number(line.creditCents) > 0 ? kpi(line.creditCents) : ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
            {grandLivre.accounts.length === 0 ? (
              <Card className="border-dashed p-6 text-center">
                <p className="text-sm text-[var(--text-secondary)]">Aucune écriture sur cette période.</p>
              </Card>
            ) : null}
          </div>
        ) : null
      ) : null}

      {/* FEC info */}
      {activeReport === 'fec' ? (
        <Card className="p-4">
          <p className="text-sm text-[var(--text-primary)]">
            Le Fichier des Écritures Comptables (FEC) est un export obligatoire pour l&apos;administration fiscale.
          </p>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Format : 18 colonnes, séparateur tabulation, dates AAAAMMJJ, décimales avec virgule. Encodage UTF-8.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
