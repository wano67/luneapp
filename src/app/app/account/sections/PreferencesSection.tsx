'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { fetchJson } from '@/lib/apiClient';
import { applyThemePref, resolveTheme, type ThemePref } from '@/lib/theme';

type Prefs = {
  language: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
};

export function PreferencesSection() {
  const [language, setLanguage] = useState<Prefs['language']>('fr');
  const [theme, setTheme] = useState<Prefs['theme']>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<Prefs>('/api/account/preferences', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data) {
        setLanguage(res.data.language);
        setTheme(res.data.theme);
        setResolved(resolveTheme(res.data.theme));
        applyThemePref(res.data.theme as ThemePref);
      }
    })();
    return () => ctrl.abort();
  }, []);

  async function save(next: Partial<Prefs>) {
    setSaving(true);
    setError(null);
    const res = await fetchJson<Prefs>('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: next.language ?? language, theme: next.theme ?? theme }),
    });

    setSaving(false);
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Impossible de sauvegarder.');
      return;
    }
    setLanguage(res.data.language);
    setTheme(res.data.theme);
    setResolved(resolveTheme(res.data.theme));
    applyThemePref(res.data.theme as ThemePref);
  }

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Préférences</p>
        <p className="text-sm text-[var(--text-secondary)]">Langue et thème de l&apos;interface. Sauvegarde immédiate.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Select
            label="Langue"
            value={language}
            onChange={(e) => void save({ language: e.target.value as Prefs['language'] })}
            disabled={saving}
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
          <p className="text-xs text-[var(--text-secondary)]">Langue de l&apos;interface utilisateur.</p>
        </div>
        <div className="space-y-1">
          <Select
            label={<>Thème {resolved ? `(actuellement: ${resolved})` : ''}</>}
            value={theme}
            onChange={(e) => void save({ theme: e.target.value as Prefs['theme'] })}
            disabled={saving}
          >
            <option value="system">Système</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </Select>
          <p className="text-xs text-[var(--text-secondary)]">Apparence de l&apos;application (clair, sombre, ou automatique selon votre système).</p>
        </div>
      </div>
    </Card>
  );
}
