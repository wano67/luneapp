'use client';

import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, RefreshCw, Trash2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

type Props = {
  apiBase: string; // e.g. "/api/pro/businesses/123/calendar/sync" or "/api/personal/calendar/sync"
};

export function CalendarSyncPanel({ apiBase }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<{ token: string | null }>(apiBase);
    if (res.ok && res.data) setToken(res.data.token);
    setLoading(false);
  }, [apiBase]);

  useEffect(() => { void load(); }, [load]);

  const generate = useCallback(async () => {
    setGenerating(true);
    const res = await fetchJson<{ token: string }>(apiBase, { method: 'POST' });
    if (res.ok && res.data) setToken(res.data.token);
    setGenerating(false);
  }, [apiBase]);

  const revoke = useCallback(async () => {
    await fetchJson(apiBase, { method: 'DELETE' });
    setToken(null);
  }, [apiBase]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const icalUrl = token ? `${origin}/api/ical/${token}` : null;
  const caldavUrl = token ? `${origin}/api/caldav/${token}/` : null;

  const copyUrl = useCallback(async (url: string, label: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (loading) {
    return <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>;
  }

  if (!token) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          Synchronisez votre calendrier Lune avec votre téléphone ou ordinateur.
        </p>
        <Button onClick={generate} disabled={generating}>
          <RefreshCw size={14} className="mr-1.5" />
          {generating ? 'Génération…' : 'Générer l\u2019URL de synchronisation'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* iCal URL */}
      <UrlRow label="URL iCal (lecture seule)" url={icalUrl!} copied={copied === 'ical'} onCopy={() => void copyUrl(icalUrl!, 'ical')} />

      {/* CalDAV URL */}
      <UrlRow label="URL CalDAV (lecture + écriture)" url={caldavUrl!} copied={copied === 'caldav'} onCopy={() => void copyUrl(caldavUrl!, 'caldav')} />

      {/* Instructions */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Smartphone size={14} className="text-[var(--text-secondary)]" />
          <p className="text-xs font-semibold text-[var(--text)]">Comment synchroniser</p>
        </div>
        <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
          <p><strong>iPhone/iPad :</strong> Réglages → Calendrier → Comptes → Ajouter → Autre → S&apos;abonner à un calendrier → collez l&apos;URL iCal.</p>
          <p><strong>Android :</strong> Installez DAVx5 → ajoutez un compte CalDAV avec l&apos;URL CalDAV ci-dessus.</p>
          <p><strong>Google Calendar :</strong> Paramètres → Ajouter un calendrier → À partir de l&apos;URL → collez l&apos;URL iCal.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={generate} disabled={generating}>
          <RefreshCw size={14} className="mr-1.5" />
          Regénérer
        </Button>
        <Button variant="outline" onClick={revoke} className="!text-[var(--danger)] !border-[var(--danger)]">
          <Trash2 size={14} className="mr-1.5" />
          Révoquer
        </Button>
      </div>
    </div>
  );
}

function UrlRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--text)]">
          {url}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded p-1 hover:bg-[var(--surface-hover)] transition-colors"
        >
          {copied ? <Check size={14} className="text-[var(--success)]" /> : <Copy size={14} className="text-[var(--text-secondary)]" />}
        </button>
      </div>
    </div>
  );
}
