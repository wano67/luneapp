// src/components/CsvImportModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30);

  const cands: Array<',' | ';' | '\t'> = [',', ';', '\t'];

  const scoreFor = (d: ',' | ';' | '\t') => {
    const counts = lines.map((l) => parseCSV(l, d)[0]?.length ?? 1);
    const multi = counts.filter((c) => c >= 2).length;
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)] ?? 1;
    const stable = counts.filter((c) => c === mode).length;
    return multi * 10 + stable;
  };

  let best: ',' | ';' | '\t' = ';';
  let bestScore = -1;

  for (const d of cands) {
    const s = scoreFor(d);
    if (s > bestScore) {
      bestScore = s;
      best = d;
    }
  }

  return best;
}

function parseCSV(text: string, delimiter: ',' | ';' | '\t') {
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  let row: string[] = [];

  const pushCell = () => {
    row.push(cur);
    cur = '';
  };

  const pushRow = () => {
    if (row.length === 1 && row[0].trim() === '') return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushCell();
      pushRow();
      continue;
    }

    cur += ch;
  }

  pushCell();
  pushRow();

  return rows;
}

function normHeader(s: string) {
  return s.trim().toLowerCase();
}

function suggestMapping(headers: string[]) {
  const h = headers.map(normHeader);

  const findOne = (candidates: string[]) => {
    const idx = h.findIndex((x) => candidates.includes(x));
    return idx >= 0 ? headers[idx] : '';
  };

  return {
    date: findOne(['date', 'transaction date', 'datedoperation', 'date opération', 'date operation', 'date_op']),
    label: findOne(['label', 'libellé', 'libelle', 'description', 'motif', 'name', 'intitulé', 'intitule']),
    amount: findOne(['amount', 'montant', 'amount_eur', 'valeur', 'value', 'somme']),
    currency: findOne(['currency', 'devise']),
    note: findOne(['note', 'memo', 'comment', 'details', 'détails']),
    category: findOne(['category', 'catégorie', 'categorie']),
  };
}

function csvEscape(v: string) {
  const s = String(v ?? '');
  if (/[",;\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function buildNormalizedCsv(
  headers: string[],
  rows: string[][],
  mapping: { date: string; label: string; amount: string; currency: string; note: string; category: string }
) {
  const idx = (key: string) => headers.findIndex((h) => h === key);

  const iDate = idx(mapping.date);
  const iLabel = idx(mapping.label);
  const iAmount = idx(mapping.amount);
  const iCurrency = mapping.currency ? idx(mapping.currency) : -1;
  const iNote = mapping.note ? idx(mapping.note) : -1;
  const iCategory = mapping.category ? idx(mapping.category) : -1;

  const out: string[] = [];
  out.push('date,label,amount,currency,note,category');

  for (const r of rows) {
    const date = (r[iDate] ?? '').trim();
    const label = (r[iLabel] ?? '').trim();
    const amount = (r[iAmount] ?? '').trim();
    const currency = iCurrency >= 0 ? (r[iCurrency] ?? '').trim() : '';
    const note = iNote >= 0 ? (r[iNote] ?? '').trim() : '';
    const category = iCategory >= 0 ? (r[iCategory] ?? '').trim() : '';

    if (!date && !label && !amount) continue;

    out.push(
      [
        csvEscape(date),
        csvEscape(label),
        csvEscape(amount),
        csvEscape(currency),
        csvEscape(note),
        csvEscape(category),
      ].join(',')
    );
  }

  return out.join('\n');
}

function findHeaderRowIndex(rows: string[][]) {
  const tokens = ['date', 'label', 'libell', 'montant', 'amount', 'currency', 'devise', 'note', 'category', 'categorie'];

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i].map((c) => normHeader(String(c ?? '')));
    const joined = r.join(' ');
    const hasToken = tokens.some((t) => joined.includes(t));
    const hasCols = r.length >= 2;
    if (hasCols && hasToken) return i;
  }

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    if ((rows[i]?.length ?? 0) >= 3) return i;
  }

  return 0;
}

function formatEURfromCents(cents: string) {
  const n = Number(cents);
  const v = Number.isFinite(n) ? n / 100 : 0;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);
}

type AccountOption = { id: string; name: string; currency: string };

type PreviewResponse = {
  delimiter: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ row: number; reason: string; data?: any }>;
  preview: Array<{
    dateIso: string;
    label: string;
    amountCents: string;
    currency: string;
    note: string | null;
    categoryName: string | null;
  }>;
};

type ImportResponse = {
  imported: number;
  invalidRows: number;
  errors?: Array<{ row: number; reason: string }>;
  summary?: {
    accountId: string;
    fromDateIso: string | null;
    toDateIso: string | null;
    incomeCents: string;
    expenseAbsCents: string;
  };
};

type CsvImportModalProps = {
  open: boolean;
  onClose: () => void;
  accounts: AccountOption[];
  defaultAccountId?: string;
  lockedAccountId?: string;
  onImported?: () => void;
};

export default function CsvImportModal({
  open,
  onClose,
  accounts,
  defaultAccountId,
  lockedAccountId,
  onImported,
}: CsvImportModalProps) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string>(defaultAccountId || lockedAccountId || '');
  const [file, setFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);
  const [mapping, setMapping] = useState<{
    date: string;
    label: string;
    amount: string;
    currency: string;
    note: string;
    category: string;
  }>({ date: '', label: '', amount: '', currency: '', note: '', category: '' });

  useEffect(() => {
    if (!open) {
      setFile(null);
      setServerError(null);
      setPreview(null);
      setImportResult(null);
      setLoadingPreview(false);
      setLoadingImport(false);
      setAccountId(defaultAccountId || lockedAccountId || '');
      setRawHeaders([]);
      setRawRows([]);
      setMapping({ date: '', label: '', amount: '', currency: '', note: '', category: '' });
      setShowPreviewPanel(false);
    }
  }, [open, defaultAccountId, lockedAccountId]);

  const canSelectAccount = !lockedAccountId;
  const hasPreview = !!preview;
  const previewSummary = useMemo(() => {
    if (!preview) return 'Sélectionne un fichier puis prévisualise.';
    return `${preview.validRows}/${preview.totalRows} valides · ${preview.invalidRows} invalides`;
  }, [preview]);
  const effectiveAccountId = lockedAccountId || accountId;
  const mappingOk = !!mapping.date && !!mapping.label && !!mapping.amount;
  const canSubmit = !!file && !!effectiveAccountId && /^\d+$/.test(effectiveAccountId) && mappingOk;
  const totalRows = rawRows.length;

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setPreview(null);
    setImportResult(null);
    setServerError(null);
    setRawHeaders([]);
    setRawRows([]);
    setMapping({ date: '', label: '', amount: '', currency: '', note: '', category: '' });

    if (f) {
      try {
        const text = await f.text();
        const delim = detectDelimiter(text);
        const table = parseCSV(text, delim);
        const headerIndex = findHeaderRowIndex(table);
        const headers = (table[headerIndex] ?? []).map((x) => String(x ?? '').trim());
        const rows = table.slice(headerIndex + 1);
        setRawHeaders(headers);
        setRawRows(rows);

        const sug = suggestMapping(headers);
        setMapping({
          date: sug.date,
          label: sug.label,
          amount: sug.amount,
          currency: sug.currency,
          note: sug.note,
          category: sug.category,
        });
      } catch (err: any) {
        setServerError(err?.message ?? 'Lecture du fichier impossible');
      }
    }
  }

  async function runRequest(dryRun: boolean, normalizedFile: File) {
    if (!effectiveAccountId) {
      setServerError('Choisis un compte.');
      return null;
    }
    const fd = new FormData();
    fd.append('accountId', effectiveAccountId);
    fd.append('dryRun', dryRun ? 'true' : 'false');
    fd.append('file', normalizedFile);

    try {
      const res = await fetch('/api/personal/transactions/import', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (res.status === 401) {
        const from = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app';
        router.push(`/login?from=${encodeURIComponent(from)}`);
        return null;
      }
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        setServerError(typeof json?.error === 'string' ? json.error : 'Import impossible');
        return null;
      }
      setServerError(null);
      return json;
    } catch (e: any) {
      setServerError(e?.message ?? 'Erreur réseau.');
      return null;
    }
  }

  async function handlePreview() {
    if (!file || !mappingOk) {
      setServerError('Mappe au moins Date / Libellé / Montant.');
      return;
    }
    setLoadingPreview(true);
    setImportResult(null);
    const normalizedCsv = buildNormalizedCsv(rawHeaders, rawRows, mapping);
    const normalizedFile = new File(
      [normalizedCsv],
      file.name.replace(/\.csv$/i, '') + '.normalized.csv',
      { type: 'text/csv' }
    );
    const res = await runRequest(true, normalizedFile);
    if (res) setPreview(res as PreviewResponse);
    setLoadingPreview(false);
  }

  async function handleImport() {
    if (!file || !mappingOk) {
      setServerError('Mappe au moins Date / Libellé / Montant.');
      return;
    }
    setLoadingImport(true);
    const normalizedCsv = buildNormalizedCsv(rawHeaders, rawRows, mapping);
    const normalizedFile = new File(
      [normalizedCsv],
      file.name.replace(/\.csv$/i, '') + '.normalized.csv',
      { type: 'text/csv' }
    );
    const res = await runRequest(false, normalizedFile);
    if (res) {
      setImportResult(res as ImportResponse);
      setPreview(null);
      onImported?.();
    }
    setLoadingImport(false);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (loadingImport || loadingPreview) return;
        onClose();
      }}
      title="Importer un CSV"
      description="Prévisualise puis importe tes transactions."
    >
      <div className="max-h-[78vh] overflow-hidden">
        {serverError ? (
          <div className="mb-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {serverError}
          </div>
        ) : null}

        {importResult?.summary ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">Import terminé ✅</p>
              <p className="mt-1 text-sm text-emerald-100/90">
                {importResult.imported} transaction(s) importée(s)
                {importResult.invalidRows ? ` • ${importResult.invalidRows} ignorée(s)` : ''}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-4">
                <p className="text-xs text-slate-400">Période</p>
                <p className="mt-1 text-sm text-slate-100">
                  {importResult.summary.fromDateIso
                    ? new Date(importResult.summary.fromDateIso).toLocaleDateString('fr-FR')
                    : '—'}{' '}
                  →{' '}
                  {importResult.summary.toDateIso
                    ? new Date(importResult.summary.toDateIso).toLocaleDateString('fr-FR')
                    : '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/50 p-4">
                <p className="text-xs text-slate-400">Totaux</p>
                <p className="mt-1 text-sm">
                  <span className="text-emerald-300">
                    + {formatEURfromCents(importResult.summary.incomeCents)}
                  </span>
                  <span className="text-slate-500"> • </span>
                  <span className="text-rose-300">
                    - {formatEURfromCents(importResult.summary.expenseAbsCents)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-h-[calc(78vh-72px)] space-y-4 overflow-auto pr-1">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-300">Compte cible</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={!canSelectAccount || loadingPreview || loadingImport}
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm text-slate-50"
                >
                  <option value="">Choisir un compte</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">Fichier CSV</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFileChange}
                  disabled={loadingPreview || loadingImport}
                  className="w-full text-sm text-slate-200"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Format: date,label,amount,currency,note,category
                </p>
              </div>
            </div>

            {showPreviewPanel && rawHeaders.length ? (
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-50">Associer les colonnes</p>
                  <p className="text-xs text-slate-400">
                    {totalRows.toLocaleString('fr-FR')} ligne(s) détectée(s)
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { key: 'date', label: 'Date *' },
                    { key: 'label', label: 'Libellé *' },
                    { key: 'amount', label: 'Montant *' },
                    { key: 'currency', label: 'Devise' },
                    { key: 'note', label: 'Note' },
                    { key: 'category', label: 'Catégorie' },
                  ].map((f) => (
                    <div key={f.key}>
                      <label className="mb-1.5 block text-sm text-slate-300">{f.label}</label>
                      <select
                        value={(mapping as any)[f.key]}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-slate-50"
                      >
                        <option value="">—</option>
                        {rawHeaders.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/40">
                  <div className="max-h-[360px] overflow-auto">
                    <table className="w-full table-fixed text-sm">
                      <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                        <tr className="text-left text-xs text-slate-300">
                          <th className="sticky left-0 z-20 w-14 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                            #
                          </th>

                          {rawHeaders.map((h) => (
                            <th
                              key={h}
                              className="min-w-[220px] border-b border-[var(--border)] px-3 py-2"
                              title={h}
                            >
                              <span className="block truncate">{h}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody className="text-slate-100">
                        {rawRows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-black/0' : 'bg-black/10'}>
                            <td className="sticky left-0 z-10 w-14 border-b border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 text-xs text-slate-400">
                              {i + 1}
                            </td>

                            {rawHeaders.map((_, j) => (
                              <td key={j} className="border-b border-[var(--border)] px-3 py-2 align-top">
                                <div className="max-w-[360px] whitespace-pre-wrap break-words text-slate-200">
                                  {r[j] ?? ''}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-500">
                    <span>Aperçu : 50 premières lignes</span>
                    <span>Scroll horizontal + vertical</span>
                  </div>
                </div>
              </div>
            ) : null}

            {showPreviewPanel ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-50">Prévisualisation</p>
                  <p className="text-xs text-slate-400">{previewSummary}</p>
                </div>

                {preview?.errors?.length ? (
                  <div className="mt-3 space-y-2">
                    {preview.errors.slice(0, 8).map((err, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100"
                      >
                        Ligne {err.row}: {err.reason}
                      </div>
                    ))}
                  </div>
                ) : null}

                {preview?.preview?.length ? (
                  <div className="mt-4 space-y-2 text-xs text-slate-300">
                    {preview.preview.map((p, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)]/80 bg-[var(--surface)]/70 px-3 py-2">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-slate-400">{new Date(p.dateIso).toLocaleDateString('fr-FR')}</span>
                        <span className={Number(p.amountCents) < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                          {Number(p.amountCents) / 100} {p.currency}
                        </span>
                        {p.categoryName ? (
                          <span className="rounded-full border border-[var(--border)] px-2 py-[2px] text-[11px] text-slate-300">
                            {p.categoryName}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="sticky bottom-0 mt-3 border-t border-[var(--border)] bg-[var(--background-alt)]/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loadingImport || loadingPreview}>
              Fermer
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreviewPanel((v) => !v);
                if (!showPreviewPanel) handlePreview();
              }}
              disabled={loadingImport || loadingPreview || !mappingOk || !file}
              className="min-w-[140px]"
            >
              <span className="inline-flex items-center gap-2">
                Prévisualiser
                {importResult?.imported ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
            </Button>
            <Button
              onClick={handleImport}
              disabled={loadingImport || !canSubmit || !!importResult?.imported}
              className="min-w-[140px]"
            >
              {importResult?.imported ? 'Importé ✅' : loadingImport ? 'Import…' : 'Importer'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
