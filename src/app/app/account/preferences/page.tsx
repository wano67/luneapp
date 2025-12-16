'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Alert } from '@/components/ui/alert';
import { fetchJson } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';

type Prefs = {
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
};

export default function PreferencesPage() {
  const [language, setLanguage] = useState<Prefs['language']>('fr');
  const [theme, setTheme] = useState<Prefs['theme']>('system');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const res = await fetchJson<Prefs>('/api/account/preferences', {}, controller.signal);
      if (controller.signal.aborted) return;
      if (res.ok && res.data) {
        setLanguage(res.data.language);
        setTheme(res.data.theme);
      }
    })();
    return () => controller.abort();
  }, []);

  async function save(next: Partial<Prefs>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetchJson<Prefs>(
      '/api/account/preferences',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: next.language ?? language,
          theme: next.theme ?? theme,
        }),
      }
    );

    if (!res.ok || !res.data) {
      setError(res.error ?? 'Impossible de sauvegarder les préférences.');
      setRequestId(res.requestId);
      setSaving(false);
      return;
    }

    setLanguage(res.data.language);
    setTheme(res.data.theme);
    setSaved(true);
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Préférences"
        description="Langue et thème de l’interface. Sauvegarde immédiate."
      />

      {error ? (
        <Alert
          variant="danger"
          title="Erreur"
          description={error}
          actions={requestId ? <span className="text-xs text-[var(--text-muted)]">Ref: {requestId}</span> : null}
        />
      ) : null}

      <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="space-y-2">
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Langue</span>
            <select
              value={language}
              onChange={(e) => void save({ language: e.target.value as Prefs['language'] })}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--text-secondary)]">Thème</span>
            <select
              value={theme}
              onChange={(e) => void save({ theme: e.target.value as Prefs['theme'] })}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <option value="system">Système</option>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--text-secondary)]">
            Les préférences sont appliquées immédiatement.
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => void save({ language, theme })}
          >
            {saved ? 'Sauvegardé' : saving ? 'Sauvegarde...' : 'Re-sauvegarder'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
