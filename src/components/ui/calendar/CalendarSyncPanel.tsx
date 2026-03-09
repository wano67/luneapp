'use client';

import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, RefreshCw, Trash2, Smartphone, CalendarPlus } from 'lucide-react';
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetchJson<{ token: string | null }>(apiBase).then(res => {
      if (res.ok && res.data) setToken(res.data.token);
      setLoading(false);
    });
  }, [apiBase]);

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
  const webcalUrl = token ? `webcal://${origin.replace(/^https?:\/\//, '')}/api/ical/${token}` : null;
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
          {generating ? 'Génération…' : 'Activer la synchronisation'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary action — one-tap subscribe */}
      <a
        href={webcalUrl!}
        className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--shell-accent)' }}
      >
        <CalendarPlus size={18} />
        Ajouter à mon calendrier
      </a>
      <p className="text-xs text-center text-[var(--text-secondary)]">
        Fonctionne sur iPhone, iPad, Mac et Android. Le calendrier se met à jour automatiquement.
      </p>

      {/* Instructions */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Smartphone size={14} className="text-[var(--text-secondary)]" />
          <p className="text-xs font-semibold text-[var(--text)]">Ajout rapide sur mobile</p>
        </div>
        <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
          <p><strong>iPhone/iPad :</strong> Appuyez sur le bouton ci-dessus depuis votre téléphone. iOS vous propose directement de s&apos;abonner au calendrier.</p>
          <p><strong>Android :</strong> Ouvrez cette page sur votre téléphone et appuyez sur le bouton. Si ça ne fonctionne pas, copiez l&apos;URL iCal et ajoutez-la dans Google Calendar (Paramètres → Ajouter → À partir de l&apos;URL).</p>
          <p><strong>Mac :</strong> Appuyez sur le bouton, Calendar.app s&apos;ouvre automatiquement.</p>
        </div>
      </div>

      {/* Advanced section (URLs for manual setup) */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs font-medium hover:underline"
        style={{ color: 'var(--text-secondary)' }}
      >
        {showAdvanced ? '▾ Masquer les options avancées' : '▸ Options avancées (URLs manuelles, CalDAV)'}
      </button>

      {showAdvanced ? (
        <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 p-3">
          {/* iCal URL */}
          <UrlRow label="URL iCal (lecture seule)" url={icalUrl!} copied={copied === 'ical'} onCopy={() => void copyUrl(icalUrl!, 'ical')} />

          {/* CalDAV URL */}
          <UrlRow label="URL CalDAV (lecture + écriture)" url={caldavUrl!} copied={copied === 'caldav'} onCopy={() => void copyUrl(caldavUrl!, 'caldav')} />

          <p className="text-[11px] text-[var(--text-secondary)]">
            CalDAV permet d&apos;ajouter des événements depuis votre app calendrier. Sur Android, utilisez DAVx5 avec l&apos;URL CalDAV.
          </p>
        </div>
      ) : null}

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
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--text)]">
          {url}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded p-1 hover:bg-[var(--surface-hover)] transition-colors"
        >
          {copied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} className="text-[var(--text-secondary)]" />}
        </button>
      </div>
    </div>
  );
}
