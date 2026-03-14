'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import {
  Plus, Trash2, Pencil, Power, PowerOff, X, Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AutomationItem = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  config: Record<string, unknown>;
  projectId: string | null;
  enabled: boolean;
  createdAt: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  TASK_COMPLETED: 'Tâche terminée',
  TASK_STATUS_CHANGED: 'Changement statut tâche',
  TASK_ASSIGNED: 'Tâche assignée',
  INVOICE_CREATED: 'Facture créée',
  PROJECT_STATUS_CHANGED: 'Changement statut projet',
};

const ACTION_LABELS: Record<string, string> = {
  NOTIFY_TEAM: 'Notifier l\'équipe',
  NOTIFY_CLIENT: 'Notifier le client',
  CREATE_TASK: 'Créer une tâche',
  CHANGE_PROJECT_STATUS: 'Changer statut projet',
};

const TRIGGERS = Object.entries(TRIGGER_LABELS);
const ACTIONS = Object.entries(ACTION_LABELS);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AutomationsPage() {
  usePageTitle('Automatisations');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/automations`;

  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';

  const [items, setItems] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('TASK_COMPLETED');
  const [action, setAction] = useState('NOTIFY_TEAM');
  const [configTaskTitle, setConfigTaskTitle] = useState('');
  const [configNewStatus, setConfigNewStatus] = useState('COMPLETED');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<{ items: AutomationItem[] }>(basePath);
      if (res.ok && res.data?.items) {
        setItems(res.data.items);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger les automations.');
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setName('');
    setTrigger('TASK_COMPLETED');
    setAction('NOTIFY_TEAM');
    setConfigTaskTitle('');
    setConfigNewStatus('COMPLETED');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(item: AutomationItem) {
    setEditingId(item.id);
    setName(item.name);
    setTrigger(item.trigger);
    setAction(item.action);
    setConfigTaskTitle((item.config?.taskTitle as string) ?? '');
    setConfigNewStatus((item.config?.newStatus as string) ?? 'COMPLETED');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const config: Record<string, unknown> = {};
    if (action === 'CREATE_TASK' && configTaskTitle.trim()) {
      config.taskTitle = configTaskTitle.trim();
    }
    if (action === 'CHANGE_PROJECT_STATUS') {
      config.newStatus = configNewStatus;
    }

    const payload = { name: name.trim(), trigger, action, config };

    if (editingId) {
      const res = await fetchJson<{ item: AutomationItem }>(`${basePath}/${editingId}`, {
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
      const res = await fetchJson<{ item: AutomationItem }>(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok && res.data?.item) {
        setItems((prev) => [res.data!.item, ...prev]);
      } else {
        setError(res.error ?? 'Création impossible.');
      }
    }

    setSaving(false);
    resetForm();
  }

  async function toggleEnabled(item: AutomationItem) {
    const res = await fetchJson<{ item: AutomationItem }>(`${basePath}/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    if (res.ok && res.data?.item) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data!.item : i)));
    }
  }

  async function deleteItem(item: AutomationItem) {
    if (!window.confirm(`Supprimer "${item.name}" ?`)) return;
    const res = await fetchJson<{ ok: boolean }>(`${basePath}/${item.id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    else setError(res.error ?? 'Suppression impossible.');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--accent)]" />
          <div>
            <h1 className="text-xl font-semibold">Automations</h1>
            <p className="text-sm text-[var(--text-faint)]">
              Créez des règles qui s&apos;exécutent automatiquement lors d&apos;événements.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/pro/${businessId}/references`} className="text-sm text-primary underline">
            Retour aux références
          </Link>
          {isAdmin && !showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nouvelle
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{editingId ? 'Modifier' : 'Nouvelle automation'}</h2>
            <button onClick={resetForm} className="text-[var(--text-faint)] hover:text-[var(--text)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nom</label>
              <Input
                required
                placeholder="Ex: Notifier l&apos;équipe quand une tâche est terminée"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Déclencheur (Quand...)</label>
                <select
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  disabled={saving}
                >
                  {TRIGGERS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Action (Alors...)</label>
                <select
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={saving}
                >
                  {ACTIONS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conditional config fields */}
            {action === 'CREATE_TASK' && (
              <div>
                <label className="text-sm font-medium">Titre de la tâche créée</label>
                <Input
                  placeholder="Ex: Vérifier : {taskTitle}"
                  value={configTaskTitle}
                  onChange={(e) => setConfigTaskTitle(e.target.value)}
                  disabled={saving}
                />
                <p className="text-xs text-[var(--text-faint)] mt-1">
                  Utilisez {'{taskTitle}'} pour insérer le nom de la tâche d&apos;origine.
                </p>
              </div>
            )}

            {action === 'CHANGE_PROJECT_STATUS' && (
              <div>
                <label className="text-sm font-medium">Nouveau statut projet</label>
                <select
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  value={configNewStatus}
                  onChange={(e) => setConfigNewStatus(e.target.value)}
                  disabled={saving}
                >
                  <option value="COMPLETED">Terminé</option>
                  <option value="ACTIVE">Actif</option>
                  <option value="ON_HOLD">En pause</option>
                  <option value="CANCELLED">Annulé</option>
                </select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'En cours...' : editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* List */}
      <Card className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Automation</TableHead>
              <TableHead>Déclencheur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableEmpty>Chargement...</TableEmpty>}
            {!loading && items.length === 0 && (
              <TableEmpty>Aucune automation. Créez-en une pour automatiser votre workflow.</TableEmpty>
            )}
            {!loading && items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="neutral">{TRIGGER_LABELS[item.trigger] ?? item.trigger}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="pro">{ACTION_LABELS[item.action] ?? item.action}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={item.enabled ? 'pro' : 'neutral'}>
                    {item.enabled ? 'Actif' : 'Désactivé'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleEnabled(item)}
                    disabled={!isAdmin}
                    title={item.enabled ? 'Désactiver' : 'Activer'}
                  >
                    {item.enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(item)}
                    disabled={!isAdmin}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteItem(item)}
                    disabled={!isAdmin}
                  >
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
