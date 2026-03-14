'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import {
  Plus, Trash2, Pencil, Play, Pause, Send, X, Mail,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SequenceItem = {
  id: string;
  name: string;
  subject: string;
  body: string;
  delayDays: number;
  position: number;
  status: string;
  sendCount: number;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'En pause',
  ARCHIVED: 'Archivée',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmailSequencesPage() {
  usePageTitle('Séquences email');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/email-sequences`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [items, setItems] = useState<SequenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayDays, setDelayDays] = useState('0');
  const [saving, setSaving] = useState(false);

  // Send dialog
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<'all_clients' | 'all_prospects'>('all_clients');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: SequenceItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setItems(res.data.items);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setName('');
    setSubject('');
    setBody('');
    setDelayDays('0');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(item: SequenceItem) {
    setEditingId(item.id);
    setName(item.name);
    setSubject(item.subject);
    setBody(item.body);
    setDelayDays(String(item.delayDays));
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      delayDays: parseInt(delayDays) || 0,
    };

    if (editingId) {
      const res = await fetchJson<{ item: SequenceItem }>(`${basePath}/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) {
        setItems((prev) => prev.map((i) => (i.id === editingId ? res.data!.item : i)));
      } else {
        setError(res.error ?? 'Mise à jour impossible.');
      }
    } else {
      const res = await fetchJson<{ item: SequenceItem }>(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) {
        setItems((prev) => [...prev, res.data!.item]);
      } else {
        setError(res.error ?? 'Création impossible.');
      }
    }

    setSaving(false);
    resetForm();
  }

  async function toggleStatus(item: SequenceItem) {
    const newStatus = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const res = await fetchJson<{ item: SequenceItem }>(`${basePath}/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok && res.data?.item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data!.item : i)));
    }
  }

  async function deleteItem(item: SequenceItem) {
    if (!window.confirm(`Supprimer "${item.name}" ?`)) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${item.id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function executeSend() {
    if (!sendingId) return;
    setInfo(null);
    const res = await fetchJson<{ queued: number; scheduledAt: string }>(`${basePath}/${sendingId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: sendTarget }),
    });
    if (res.ok && res.data) {
      setInfo(`${res.data.queued} email(s) programmé(s) pour le ${new Date(res.data.scheduledAt).toLocaleDateString('fr-FR')}.`);
      void load();
    } else {
      setError(res.error ?? 'Erreur lors de l\'envoi.');
    }
    setSendingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Séquences email</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Créez des séquences d&apos;emails automatiques pour vos clients et prospects.
            </p>
          </div>
        </div>
        {isAdmin && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle séquence
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}
      {info && (
        <div className="text-sm text-[var(--success)] bg-[var(--success-bg)] border border-[var(--success-border)] px-3 py-2 rounded">
          {info}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{editingId ? 'Modifier' : 'Nouvelle séquence'}</h2>
            <button onClick={resetForm} className="text-[var(--text-faint)] hover:text-[var(--text)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Nom interne</label>
                <Input required placeholder="Ex: Bienvenue nouveau client" value={name} onChange={(e) => setName(e.target.value)} disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Délai (jours)</label>
                <Input type="number" min="0" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} disabled={saving} />
                <p className="text-xs text-[var(--text-faint)] mt-1">0 = envoi immédiat</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Objet de l&apos;email</label>
              <Input required placeholder="Objet..." value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} />
              <p className="text-xs text-[var(--text-faint)] mt-1">Variables : {'{name}'}, {'{business}'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Corps de l&apos;email</label>
              <textarea
                required
                rows={5}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-y"
                placeholder="Bonjour {name},..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Annuler</Button>
              <Button type="submit" disabled={saving}>{saving ? 'En cours...' : editingId ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Send dialog */}
      {sendingId && (
        <Card className="p-4 space-y-3">
          <h3 className="font-medium">Envoyer la séquence</h3>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={sendTarget === 'all_clients'} onChange={() => setSendTarget('all_clients')} />
              Tous les clients
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={sendTarget === 'all_prospects'} onChange={() => setSendTarget('all_prospects')} />
              Tous les prospects
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={executeSend}><Send className="w-3.5 h-3.5 mr-1" /> Programmer l&apos;envoi</Button>
            <Button size="sm" variant="outline" onClick={() => setSendingId(null)}>Annuler</Button>
          </div>
        </Card>
      )}

      {/* List */}
      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Séquence</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Délai</TableHead>
              <TableHead>Envois</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && <TableEmpty>Aucune séquence. Créez-en une pour automatiser vos emails.</TableEmpty>}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-sm">{item.subject}</TableCell>
                <TableCell>{item.delayDays === 0 ? 'Immédiat' : `${item.delayDays}j`}</TableCell>
                <TableCell>{item.sendCount}</TableCell>
                <TableCell>
                  <Badge variant={item.status === 'ACTIVE' ? 'pro' : 'neutral'}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {item.status === 'ACTIVE' && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setSendingId(item.id)} title="Envoyer">
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(item)} disabled={!isAdmin} title={item.status === 'ACTIVE' ? 'Mettre en pause' : 'Activer'}>
                    {item.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startEdit(item)} disabled={!isAdmin}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteItem(item)} disabled={!isAdmin}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
