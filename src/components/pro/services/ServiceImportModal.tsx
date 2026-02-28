"use client";

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

type CsvRow = Record<string, string>;

type ImportMappingState = {
  code: string;
  name: string;
  description: string;
  price: string;
  vat: string;
  duration: string;
  type: string;
  category: string;
};

const IMPORT_MAX_ROWS = 500;

const emptyImportMapping: ImportMappingState = {
  code: '',
  name: '',
  description: '',
  price: '',
  vat: '',
  duration: '',
  type: '',
  category: '',
};

const IMPORT_FIELDS: Array<{ key: keyof ImportMappingState; label: string }> = [
  { key: 'code', label: 'Code (obligatoire)' },
  { key: 'name', label: 'Nom (obligatoire)' },
  { key: 'description', label: 'Description' },
  { key: 'price', label: 'Prix (HT ou TTC)' },
  { key: 'vat', label: 'TVA (%)' },
  { key: 'duration', label: 'Durée (h)' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Catégorie' },
];

type Props = {
  open: boolean;
  businessId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAfterImport: () => void;
};

export function ServiceImportModal({ open, businessId, isAdmin, onClose, onAfterImport }: Props) {
  const [importRows, setImportRows] = useState<CsvRow[]>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<ImportMappingState>(emptyImportMapping);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);

  function resetImportState() {
    setImportRows([]);
    setImportColumns([]);
    setImportMapping(emptyImportMapping);
    setImportInfo(null);
    setImportError(null);
    setCreateMissingCategories(true);
  }

  function handleClose() {
    if (importing) return;
    resetImportState();
    onClose();
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportInfo(null);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<CsvRow>) => {
        const rows = (results.data || []).filter((row) =>
          Object.values(row ?? {}).some((v) => String(v ?? '').trim().length > 0)
        );
        const fields = results.meta.fields ?? Object.keys(rows[0] ?? {});
        setImportColumns(fields);
        setImportRows(rows.slice(0, IMPORT_MAX_ROWS));
        setImportInfo(
          rows.length > IMPORT_MAX_ROWS
            ? `Prévisualisation de ${IMPORT_MAX_ROWS} lignes sur ${rows.length} (limite appliquée).`
            : `Prévisualisation de ${rows.length} lignes.`
        );
      },
      error: (err: Error) => {
        const parsed = err as unknown as Papa.ParseError;
        setImportError(parsed.message || 'Lecture CSV impossible.');
      },
    });
  }

  async function submitImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setImportError('Action réservée aux admins/owners.');
      return;
    }
    if (!importRows.length) {
      setImportError("Charge un CSV avant d'importer.");
      return;
    }
    if (!importMapping.code || !importMapping.name) {
      setImportError('Mappe au minimum les colonnes Code et Nom.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportInfo(null);

    const payload = {
      mapping: {
        code: importMapping.code || null,
        name: importMapping.name || null,
        description: importMapping.description || null,
        price: importMapping.price || null,
        vat: importMapping.vat || null,
        duration: importMapping.duration || null,
        type: importMapping.type || null,
        category: importMapping.category || null,
      },
      rows: importRows,
      options: { createMissingCategories },
    };

    const res = await fetchJson<{
      createdCount: number;
      updatedCount: number;
      skippedCount: number;
      errors?: Array<{ row: number; message: string }>;
    }>(`/api/pro/businesses/${businessId}/services/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setImporting(false);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Import impossible.';
      setImportError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setImportInfo(
      `Créés: ${res.data.createdCount} · Mis à jour: ${res.data.updatedCount} · Ignorés: ${res.data.skippedCount}`
    );
    if (res.data.errors?.length) {
      const sample = res.data.errors.slice(0, 3).map((err) => `Ligne ${err.row}: ${err.message}`).join(' | ');
      setImportError(
        res.data.errors.length > 3 ? `${sample} (+${res.data.errors.length - 3} autres)` : sample
      );
    } else {
      setImportError(null);
    }
    onAfterImport();
  }

  return (
    <Modal
      open={open}
      onCloseAction={handleClose}
      title="Importer des services (CSV)"
      description="Prévisualise, mappe les colonnes puis importe dans le catalogue."
    >
      <form className="space-y-4" onSubmit={submitImport}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--text-primary)]">Fichier CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="text-sm"
          />
          <p className="text-xs text-[var(--text-secondary)]">
            En-têtes requis. Limite {IMPORT_MAX_ROWS} lignes prévisualisées. Code et Nom doivent être mappés.
          </p>
        </div>

        {importColumns.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  {field.label}
                </label>
                <select
                  value={importMapping[field.key]}
                  onChange={(e) =>
                    setImportMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {importColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={createMissingCategories}
              onChange={(e) => setCreateMissingCategories(e.target.checked)}
            />
            Créer les catégories manquantes
          </label>
        </div>

        {importRows.length ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-secondary)]">Aperçu (10 premières lignes)</p>
            <div className="rounded-xl border border-dashed border-[var(--border)]">
              <table className="w-full divide-y divide-[var(--border)] text-xs">
                <thead className="bg-[var(--surface)]">
                  <tr>
                    {importColumns.slice(0, 6).map((col) => (
                      <th key={col} className="break-words px-3 py-2 text-left font-semibold text-[var(--text-secondary)]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]/60">
                  {importRows.slice(0, 10).map((row, idx) => (
                    <tr key={`${idx}-${row[importColumns[0]] ?? idx}`}>
                      {importColumns.slice(0, 6).map((col) => (
                        <td key={col} className="break-words px-3 py-2 text-[var(--text-primary)]">
                          {row[col] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {importInfo ? <p className="text-xs text-emerald-600">{importInfo}</p> : null}
        {importError ? <p className="text-xs font-semibold text-rose-600">{importError}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={importing}>
            Fermer
          </Button>
          <Button type="submit" disabled={importing || !importRows.length}>
            {importing ? "Import\u2026" : "Lancer l'import"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
