'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { fetchJson } from '@/lib/apiClient';
import { revalidate } from '@/lib/revalidate';
import { fmtDate } from '@/lib/format';
import {
  Phone, Video, Mail, StickyNote, MessageSquare, Plus, ChevronDown, ChevronUp,
  Check, Trash2, ListChecks, ClipboardList, X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
type InteractionNote = {
  id: string;
  content: string;
  isCompleted: boolean;
  position: number;
};

type LinkedTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
};

type Interaction = {
  id: string;
  type: string;
  content: string;
  summary: string | null;
  happenedAt: string;
  nextActionDate: string | null;
  notes: InteractionNote[];
  tasks: LinkedTask[];
};

type Props = {
  businessId: string;
  clientId?: string;
  projectId?: string;
  isAdmin: boolean;
};

// ─── Helpers ────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'MEETING', label: 'RDV', icon: Video },
  { value: 'CALL', label: 'Appel', icon: Phone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'NOTE', label: 'Note', icon: StickyNote },
  { value: 'MESSAGE', label: 'Message', icon: MessageSquare },
] as const;

const TYPE_META: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  MEETING: { label: 'RDV', icon: Video, color: 'var(--info)' },
  CALL: { label: 'Appel', icon: Phone, color: 'var(--success)' },
  EMAIL: { label: 'Email', icon: Mail, color: 'var(--warning)' },
  NOTE: { label: 'Note', icon: StickyNote, color: 'var(--text-faint)' },
  MESSAGE: { label: 'Message', icon: MessageSquare, color: 'var(--shell-accent)' },
};

type FilterType = '' | 'MEETING' | 'CALL' | 'EMAIL' | 'NOTE' | 'MESSAGE';

// ─── Main component ─────────────────────────────────────────────────
export function InteractionsList({ businessId, clientId, projectId, isAdmin }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formType, setFormType] = useState('MEETING');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formNextAction, setFormNextAction] = useState('');
  const [formNotes, setFormNotes] = useState<string[]>([]);
  const [formNoteInput, setFormNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Create task modal
  const [taskModalInteraction, setTaskModalInteraction] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);

  const baseUrl = `/api/pro/businesses/${businessId}/interactions`;

  // ─── Load ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function doLoad() {
      setLoading(true);
      const params = new URLSearchParams();
      if (clientId) params.set('clientId', clientId);
      if (projectId) params.set('projectId', projectId);
      if (filterType) params.set('type', filterType);
      params.set('limit', '100');
      const res = await fetchJson<{ items: Interaction[] }>(`${baseUrl}?${params}`);
      if (cancelled) return;
      if (res.ok && res.data) setItems(res.data.items);
      setLoading(false);
    }
    void doLoad();
    return () => { cancelled = true; };
  }, [baseUrl, clientId, projectId, filterType]);

  const reload = useCallback(async () => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (projectId) params.set('projectId', projectId);
    if (filterType) params.set('type', filterType);
    params.set('limit', '100');
    const res = await fetchJson<{ items: Interaction[] }>(`${baseUrl}?${params}`);
    if (res.ok && res.data) setItems(res.data.items);
  }, [baseUrl, clientId, projectId, filterType]);

  // ─── Create interaction ─────────────────────────────────────────
  async function handleCreate() {
    if (!formContent.trim()) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      type: formType,
      content: formContent.trim(),
      ...(clientId ? { clientId } : {}),
      ...(projectId ? { projectId } : {}),
    };
    if (formDate) payload.happenedAt = new Date(formDate).toISOString();
    if (formNextAction) payload.nextActionDate = new Date(formNextAction).toISOString();
    if (formNotes.length > 0) payload.notes = formNotes;

    const res = await fetchJson(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setCreateOpen(false);
      resetForm();
      void reload();
      revalidate('pro:interactions');
    } else {
      toast.error(res.error ?? 'Erreur lors de la creation.');
    }
  }

  function resetForm() {
    setFormType('MEETING');
    setFormContent('');
    setFormDate('');
    setFormNextAction('');
    setFormNotes([]);
    setFormNoteInput('');
  }

  function addFormNote() {
    const val = formNoteInput.trim();
    if (!val) return;
    setFormNotes((prev) => [...prev, val]);
    setFormNoteInput('');
  }

  // ─── Note toggle ────────────────────────────────────────────────
  async function toggleNote(interactionId: string, note: InteractionNote) {
    await fetchJson(`${baseUrl}/${interactionId}/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCompleted: !note.isCompleted }),
    });
    setItems((prev) =>
      prev.map((i) =>
        i.id === interactionId
          ? { ...i, notes: i.notes.map((n) => (n.id === note.id ? { ...n, isCompleted: !n.isCompleted } : n)) }
          : i
      )
    );
  }

  // ─── Add note to existing interaction ───────────────────────────
  async function addNote(interactionId: string, content: string) {
    const res = await fetchJson<{ item: InteractionNote }>(`${baseUrl}/${interactionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok && res.data) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === interactionId ? { ...i, notes: [...i.notes, res.data!.item] } : i
        )
      );
    }
  }

  // ─── Delete note ────────────────────────────────────────────────
  async function deleteNote(interactionId: string, noteId: string) {
    await fetchJson(`${baseUrl}/${interactionId}/notes/${noteId}`, { method: 'DELETE' });
    setItems((prev) =>
      prev.map((i) =>
        i.id === interactionId ? { ...i, notes: i.notes.filter((n) => n.id !== noteId) } : i
      )
    );
  }

  // ─── Save summary ──────────────────────────────────────────────
  async function saveSummary(interactionId: string, summary: string) {
    await fetchJson(`${baseUrl}/${interactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: summary || null }),
    });
    setItems((prev) =>
      prev.map((i) => (i.id === interactionId ? { ...i, summary: summary || null } : i))
    );
  }

  // ─── Delete interaction ─────────────────────────────────────────
  async function handleDelete(interactionId: string) {
    if (!window.confirm('Supprimer cette interaction ?')) return;
    const res = await fetchJson(`${baseUrl}/${interactionId}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== interactionId));
      setExpandedId(null);
      toast.success('Interaction supprimee.');
      revalidate('pro:interactions');
    }
  }

  // ─── Create linked task ─────────────────────────────────────────
  async function handleCreateTask() {
    if (!taskTitle.trim() || !taskModalInteraction) return;
    setTaskSaving(true);
    const payload: Record<string, unknown> = { title: taskTitle.trim() };
    if (taskDueDate) payload.dueDate = new Date(taskDueDate).toISOString();
    const res = await fetchJson<{ item: LinkedTask }>(`${baseUrl}/${taskModalInteraction}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setTaskSaving(false);
    if (res.ok && res.data) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === taskModalInteraction ? { ...i, tasks: [...i.tasks, res.data!.item] } : i
        )
      );
      setTaskModalInteraction(null);
      setTaskTitle('');
      setTaskDueDate('');
      toast.success('Tache creee.');
      revalidate('pro:tasks');
    } else {
      toast.error(res.error ?? 'Erreur.');
    }
  }

  // ─── Render ─────────────────────────────────────────────────────
  const filtered = filterType ? items.filter((i) => i.type === filterType) : items;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Interactions</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {items.length} interaction{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" /> Nouvelle interaction
          </Button>
        ) : null}
      </div>

      {/* Type filter pills */}
      <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--surface-2)' }}>
        <button
          type="button"
          onClick={() => setFilterType('')}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: !filterType ? 'var(--surface)' : 'transparent',
            color: !filterType ? 'var(--text)' : 'var(--text-faint)',
            boxShadow: !filterType ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
          }}
        >
          Tout
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterType(opt.value as FilterType)}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            style={{
              background: filterType === opt.value ? 'var(--surface)' : 'transparent',
              color: filterType === opt.value ? 'var(--text)' : 'var(--text-faint)',
              boxShadow: filterType === opt.value ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton height="64px" />
          <Skeleton height="64px" />
          <Skeleton height="64px" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center">
          <MessageSquare size={32} style={{ color: 'var(--text-faint)' }} className="mx-auto" />
          <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text)' }}>Aucune interaction</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>
            {isAdmin ? 'Commencez par ajouter une interaction.' : 'Les interactions apparaitront ici.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <InteractionCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onToggleNote={(note) => void toggleNote(item.id, note)}
              onAddNote={(content) => void addNote(item.id, content)}
              onDeleteNote={(noteId) => void deleteNote(item.id, noteId)}
              onSaveSummary={(summary) => void saveSummary(item.id, summary)}
              onDelete={() => void handleDelete(item.id)}
              onCreateTask={() => { setTaskModalInteraction(item.id); setTaskTitle(''); setTaskDueDate(''); }}
              businessId={businessId}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onCloseAction={() => { if (!saving) { setCreateOpen(false); resetForm(); } }}
        title="Nouvelle interaction"
        description="Enregistrez un echange, un RDV ou une note."
      >
        <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-3">
          <Select label="Type" value={formType} onChange={(e) => setFormType(e.target.value)}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <label className="block space-y-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Description</span>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              required
              rows={3}
              maxLength={5000}
              placeholder="De quoi s&apos;agit-il ?"
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            <Input label="Prochaine action" type="date" value={formNextAction} onChange={(e) => setFormNextAction(e.target.value)} />
          </div>

          {/* Preparation notes */}
          <div className="space-y-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>Questions / Preparation</span>
            {formNotes.map((note, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <ListChecks size={12} style={{ color: 'var(--text-faint)' }} />
                <span className="flex-1">{note}</span>
                <button type="button" onClick={() => setFormNotes((p) => p.filter((_, j) => j !== i))}>
                  <X size={12} style={{ color: 'var(--text-faint)' }} />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={formNoteInput}
                onChange={(e) => setFormNoteInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFormNote(); } }}
                placeholder="Ajouter une question..."
                maxLength={500}
                className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addFormNote} disabled={!formNoteInput.trim()}>
                <Plus size={14} />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !formContent.trim()}>
              {saving ? 'Creation...' : 'Creer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create task modal */}
      <Modal
        open={!!taskModalInteraction}
        onCloseAction={() => { if (!taskSaving) setTaskModalInteraction(null); }}
        title="Creer une tache"
        description="La tache sera liee a cette interaction."
      >
        <form onSubmit={(e) => { e.preventDefault(); void handleCreateTask(); }} className="space-y-3">
          <Input
            label="Titre"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            maxLength={200}
            autoFocus
            placeholder="Ex : Envoyer le devis..."
          />
          <Input
            label="Echeance"
            type="date"
            value={taskDueDate}
            onChange={(e) => setTaskDueDate(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" type="button" onClick={() => setTaskModalInteraction(null)} disabled={taskSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={taskSaving || !taskTitle.trim()}>
              {taskSaving ? 'Creation...' : 'Creer la tache'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Interaction card ─────────────────────────────────────────────
function InteractionCard({
  item, isAdmin, expanded, onToggle, onToggleNote, onAddNote, onDeleteNote, onSaveSummary, onDelete, onCreateTask, businessId,
}: {
  item: Interaction;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onToggleNote: (note: InteractionNote) => void;
  onAddNote: (content: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSaveSummary: (summary: string) => void;
  onDelete: () => void;
  onCreateTask: () => void;
  businessId: string;
}) {
  const meta = TYPE_META[item.type] ?? TYPE_META.NOTE;
  const Icon = meta.icon;
  const [noteInput, setNoteInput] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(item.summary ?? '');

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{ width: 32, height: 32, background: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
        >
          <Icon size={16} style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
            {item.content}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${meta.color} 12%, transparent)`, color: meta.color }}>
              {meta.label}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(item.happenedAt)}</span>
            {item.notes.length > 0 ? (
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {item.notes.filter((n) => n.isCompleted).length}/{item.notes.length} notes
              </span>
            ) : null}
            {item.tasks.length > 0 ? (
              <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {item.tasks.length} tache{item.tasks.length > 1 ? 's' : ''}
              </span>
            ) : null}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-faint)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-faint)' }} />}
      </button>

      {/* Expanded content */}
      {expanded ? (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-4">
          {/* Full content */}
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-faint)' }}>Description</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{item.content}</p>
          </div>

          {/* Notes / Preparation */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ListChecks size={13} style={{ color: 'var(--text-faint)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>Preparation</p>
            </div>
            {item.notes.length > 0 ? (
              <div className="space-y-1.5">
                {item.notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-2 group">
                    <button
                      type="button"
                      onClick={() => onToggleNote(note)}
                      className="shrink-0 mt-0.5 flex items-center justify-center rounded border-2 transition-all"
                      style={{
                        width: 18, height: 18,
                        borderColor: note.isCompleted ? 'var(--success)' : 'var(--border)',
                        background: note.isCompleted ? 'var(--success)' : 'transparent',
                      }}
                    >
                      {note.isCompleted ? <Check size={11} color="white" strokeWidth={3} /> : null}
                    </button>
                    <span
                      className={`text-sm flex-1 ${note.isCompleted ? 'line-through opacity-60' : ''}`}
                      style={{ color: 'var(--text)' }}
                    >
                      {note.content}
                    </span>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      >
                        <X size={12} style={{ color: 'var(--text-faint)' }} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Aucune note de preparation.</p>
            )}
            {isAdmin ? (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && noteInput.trim()) {
                      e.preventDefault();
                      onAddNote(noteInput.trim());
                      setNoteInput('');
                    }
                  }}
                  placeholder="Ajouter une note..."
                  maxLength={500}
                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => { if (noteInput.trim()) { onAddNote(noteInput.trim()); setNoteInput(''); } }}
                  disabled={!noteInput.trim()}
                >
                  <Plus size={12} />
                </Button>
              </div>
            ) : null}
          </div>

          {/* Summary / Compte-rendu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList size={13} style={{ color: 'var(--text-faint)' }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>Compte-rendu</p>
              </div>
              {isAdmin && !editingSummary ? (
                <Button variant="outline" size="sm" onClick={() => { setSummaryDraft(item.summary ?? ''); setEditingSummary(true); }}>
                  {item.summary ? 'Modifier' : 'Ajouter'}
                </Button>
              ) : null}
            </div>
            {editingSummary ? (
              <div className="space-y-2">
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  autoFocus
                  placeholder="Resumez les points cles de cet echange..."
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSummary(false)}>Annuler</Button>
                  <Button size="sm" onClick={() => { onSaveSummary(summaryDraft); setEditingSummary(false); }}>Enregistrer</Button>
                </div>
              </div>
            ) : item.summary ? (
              <p
                className={`text-sm whitespace-pre-wrap ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                style={{ color: 'var(--text-secondary)' }}
                onClick={isAdmin ? () => { setSummaryDraft(item.summary ?? ''); setEditingSummary(true); } : undefined}
              >
                {item.summary}
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Aucun compte-rendu.</p>
            )}
          </div>

          {/* Linked tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-faint)' }}>Taches liees</p>
              {isAdmin ? (
                <Button variant="outline" size="sm" onClick={onCreateTask}>
                  <Plus size={12} className="mr-1" /> Tache
                </Button>
              ) : null}
            </div>
            {item.tasks.length > 0 ? (
              <div className="space-y-1">
                {item.tasks.map((task) => (
                  <a
                    key={task.id}
                    href={`/app/pro/${businessId}/tasks/${task.id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: task.status === 'DONE' ? 'var(--success)' : task.status === 'IN_PROGRESS' ? 'var(--info)' : 'var(--text-faint)' }}
                    />
                    <span className={task.status === 'DONE' ? 'line-through opacity-60' : ''} style={{ color: 'var(--text)' }}>
                      {task.title}
                    </span>
                    {task.dueDate ? (
                      <span className="ml-auto text-xs" style={{ color: 'var(--text-faint)' }}>{fmtDate(task.dueDate)}</span>
                    ) : null}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Aucune tache liee.</p>
            )}
          </div>

          {/* Actions */}
          {isAdmin ? (
            <div className="flex justify-end pt-1 border-t border-[var(--border)]">
              <Button variant="danger" size="sm" onClick={onDelete}>
                <Trash2 size={12} className="mr-1" /> Supprimer
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
