"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2, Users, ListChecks } from 'lucide-react';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type Props = { businessId: string };

type OrgUnit = { id: string; name: string; order: number };
type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  organizationUnit: { id: string; name: string } | null;
};
type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  organizationUnitId: string | null;
};

const TABS = [
  { key: 'team', label: 'Équipe' },
  { key: 'tasks', label: 'Tâches' },
  { key: 'calendar', label: 'Calendrier' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function OrganizationPage({ businessId }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const requestedTab = (searchParams?.get('tab') ?? TABS[0].key) as TabKey;
  const currentTab = useMemo(
    () => (TABS.some((t) => t.key === requestedTab) ? requestedTab : TABS[0].key),
    [requestedTab]
  );

  const handleTabChange = (key: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (currentTab === 'calendar') {
      router.replace(`/app/pro/${businessId}/calendar`);
    }
  }, [currentTab, businessId, router]);

  // ─── Data ─────────────────────────────────────────────────────────────────
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [unitsRes, membersRes] = await Promise.all([
        fetchJson<{ items: OrgUnit[] }>(`/api/pro/businesses/${businessId}/organization/units`),
        fetchJson<{ items: Member[] }>(`/api/pro/businesses/${businessId}/members`),
      ]);
      if (!unitsRes.ok || !membersRes.ok) {
        setError(unitsRes.error ?? membersRes.error ?? 'Chargement impossible.');
        return;
      }
      setUnits(unitsRes.data?.items ?? []);
      setMembers(membersRes.data?.items ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const loadTasks = useCallback(async () => {
    const res = await fetchJson<{ items: TaskItem[] }>(`/api/pro/businesses/${businessId}/tasks`);
    if (res.ok && res.data?.items) setTasks(res.data.items);
  }, [businessId]);

  useEffect(() => {
    void loadData();
    if (currentTab === 'tasks') void loadTasks();
  }, [loadData, loadTasks, currentTab]);

  // ─── Unit CRUD ────────────────────────────────────────────────────────────
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitSaving, setUnitSaving] = useState(false);

  async function createUnit() {
    if (!unitName.trim()) return;
    setUnitSaving(true);
    const res = await fetchJson<{ item: OrgUnit }>(`/api/pro/businesses/${businessId}/organization/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: unitName.trim() }),
    });
    setUnitSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Création impossible.');
      return;
    }
    toast.success('Pôle créé.');
    setUnitModalOpen(false);
    setUnitName('');
    await loadData();
  }

  async function deleteUnit(unitId: string) {
    const res = await fetchJson(`/api/pro/businesses/${businessId}/organization/units/${unitId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      toast.error(res.error ?? 'Suppression impossible.');
      return;
    }
    toast.success('Pôle supprimé.');
    await loadData();
  }

  // ─── Grouped data ─────────────────────────────────────────────────────────
  const membersByUnit = useMemo(() => {
    const map: Record<string, Member[]> = {};
    const unassigned: Member[] = [];
    for (const m of members) {
      const uid = m.organizationUnit?.id;
      if (uid) {
        (map[uid] ??= []).push(m);
      } else {
        unassigned.push(m);
      }
    }
    return { map, unassigned };
  }, [members]);

  const tasksByUnit = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    const unassigned: TaskItem[] = [];
    for (const t of tasks) {
      if (t.organizationUnitId) {
        (map[t.organizationUnitId] ??= []).push(t);
      } else {
        unassigned.push(t);
      }
    }
    return { map, unassigned };
  }, [tasks]);

  // ─── Render ───────────────────────────────────────────────────────────────
  function renderContent() {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton width="30%" height="16px" />
              <Skeleton width="60%" height="12px" />
            </Card>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Card className="p-4 space-y-2">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <Button size="sm" variant="outline" onClick={() => loadData()}>Réessayer</Button>
        </Card>
      );
    }

    if (currentTab === 'team') {
      return (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setUnitModalOpen(true)}>
                <Plus size={14} className="mr-1" /> Nouveau pôle
              </Button>
            </div>
          )}

          {units.length === 0 && membersByUnit.unassigned.length === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--text-secondary)]">
              Aucun pôle créé. Créez des pôles pour organiser votre équipe.
            </Card>
          ) : (
            <>
              {units.map((unit) => {
                const unitMembers = membersByUnit.map[unit.id] ?? [];
                return (
                  <Card key={unit.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[var(--text-secondary)]" />
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{unit.name}</h3>
                        <Badge variant="neutral">{unitMembers.length} membre{unitMembers.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => deleteUnit(unit.id)}
                          className="rounded-lg p-1.5 text-[var(--text-faint)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                          aria-label="Supprimer le pôle"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    {unitMembers.length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {unitMembers.map((m) => (
                          <div key={m.userId} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-bold text-[var(--accent)]">
                              {(m.name ?? m.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{m.name ?? m.email}</p>
                              <p className="truncate text-[10px] text-[var(--text-faint)]">{m.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-faint)]">Aucun membre assigné à ce pôle.</p>
                    )}
                  </Card>
                );
              })}

              {membersByUnit.unassigned.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[var(--text-faint)]" />
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Non assignés</h3>
                    <Badge variant="neutral">{membersByUnit.unassigned.length}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {membersByUnit.unassigned.map((m) => (
                      <div key={m.userId} className="flex items-center gap-2 rounded-lg border border-[var(--border)]/60 p-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--text-secondary)]">
                          {(m.name ?? m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--text-primary)]">{m.name ?? m.email}</p>
                          <p className="truncate text-[10px] text-[var(--text-faint)]">{m.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      );
    }

    if (currentTab === 'tasks') {
      return (
        <div className="space-y-4">
          {units.length === 0 ? (
            <Card className="p-6 text-center text-sm text-[var(--text-secondary)]">
              Créez des pôles pour organiser les tâches par équipe.
            </Card>
          ) : (
            <>
              {units.map((unit) => {
                const unitTasks = tasksByUnit.map[unit.id] ?? [];
                return (
                  <Card key={unit.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ListChecks size={16} className="text-[var(--text-secondary)]" />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{unit.name}</h3>
                      <Badge variant="neutral">{unitTasks.length} tâche{unitTasks.length !== 1 ? 's' : ''}</Badge>
                    </div>
                    {unitTasks.length > 0 ? (
                      <div className="space-y-1">
                        {unitTasks.slice(0, 10).map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--border)]/60 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant={t.status === 'DONE' ? 'success' : t.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>
                                {t.status === 'DONE' ? 'Fait' : t.status === 'IN_PROGRESS' ? 'En cours' : t.status === 'BLOCKED' ? 'Bloqué' : 'À faire'}
                              </Badge>
                              <span className="truncate text-xs text-[var(--text-primary)]">{t.title}</span>
                            </div>
                            {t.dueDate && (
                              <span className="shrink-0 text-[10px] text-[var(--text-faint)]">
                                {new Date(t.dueDate).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        ))}
                        {unitTasks.length > 10 && (
                          <p className="text-xs text-[var(--text-faint)] text-center">+ {unitTasks.length - 10} autres</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-faint)]">Aucune tâche assignée à ce pôle.</p>
                    )}
                  </Card>
                );
              })}

              {tasksByUnit.unassigned.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ListChecks size={16} className="text-[var(--text-faint)]" />
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Sans pôle</h3>
                    <Badge variant="neutral">{tasksByUnit.unassigned.length}</Badge>
                  </div>
                  <p className="text-xs text-[var(--text-faint)]">
                    {tasksByUnit.unassigned.length} tâche{tasksByUnit.unassigned.length !== 1 ? 's' : ''} sans pôle assigné.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <ProPageShell
      backHref={`/app/pro/${businessId}`}
      backLabel="Dashboard"
      title="Organisation"
      subtitle="Pôles, équipe et tâches internes."
      tabs={TABS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="space-y-4">{renderContent()}</div>

      <Modal
        open={unitModalOpen}
        onCloseAction={() => { if (!unitSaving) setUnitModalOpen(false); }}
        title="Nouveau pôle"
        description="Créez un pôle pour regrouper les membres de votre équipe."
      >
        <div className="space-y-3">
          <Input
            label="Nom du pôle"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="Design, Développement, Commercial…"
            disabled={unitSaving}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnitModalOpen(false)} disabled={unitSaving}>Annuler</Button>
            <Button onClick={createUnit} disabled={unitSaving || !unitName.trim()}>
              {unitSaving ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </ProPageShell>
  );
}
