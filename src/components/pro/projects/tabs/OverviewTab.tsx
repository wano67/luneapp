"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import {
  SectionCard,
  InitialsAvatar,
  formatDate,
  formatTaskStatus,
  getStatusBadgeClasses,
} from '@/components/pro/projects/workspace-ui';
import { ServiceProgressRow, type ServiceTask } from '@/components/pro/projects/ServiceProgressRow';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';
import { ProjectSetupChecklist, type ChecklistItem } from '@/components/pro/projects/ProjectSetupChecklist';

type OverviewServiceEntry = {
  service: { id: string; service: { name: string } };
  tasks: ServiceTask[];
};

type OverviewTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

type OverviewMember = {
  membershipId: string;
  user: { name: string | null; email: string | null };
};

type OverviewActivity = {
  taskId: string;
  title: string;
  status: string;
  serviceName?: string | null;
  occurredAt: string | null;
  actor: { name: string | null; email: string | null } | null;
};

export type OverviewTabProps = {
  showSetup: boolean;
  checklistItems: ChecklistItem[];
  onChecklistAction: (key: string) => void;
  servicesWithTasks: OverviewServiceEntry[];
  servicesOverview: OverviewServiceEntry[];
  showServicesToggle: boolean;
  showAllServicesOverview: boolean;
  onToggleServicesOverview: () => void;
  upcomingTasks: OverviewTask[];
  upcomingTasksOverview: OverviewTask[];
  showActionsToggle: boolean;
  showAllActionsOverview: boolean;
  onToggleActionsOverview: () => void;
  projectMembersPreview: OverviewMember[];
  projectMembersOverflow: number;
  isAdmin: boolean;
  accessInfo: string | null;
  onOpenAccessModal: () => void;
  activityOverview: OverviewActivity[];
  showActivityToggle: boolean;
  showAllActivity: boolean;
  onToggleActivity: () => void;
  businessId: string;
  projectId: string;
  onTaskClick?: (taskId: string) => void;
};

export function OverviewTab({
  showSetup,
  checklistItems,
  onChecklistAction,
  servicesWithTasks,
  servicesOverview,
  showServicesToggle,
  showAllServicesOverview,
  onToggleServicesOverview,
  upcomingTasks,
  upcomingTasksOverview,
  showActionsToggle,
  showAllActionsOverview,
  onToggleActionsOverview,
  projectMembersPreview,
  projectMembersOverflow,
  isAdmin,
  accessInfo,
  onOpenAccessModal,
  activityOverview,
  showActivityToggle,
  showAllActivity,
  onToggleActivity,
  businessId,
  projectId,
  onTaskClick,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      {showSetup ? (
        <ProjectSetupChecklist items={checklistItems} onAction={onChecklistAction} />
      ) : null}
      {!showSetup && checklistItems.some((it) => !it.done) ? (
        <ProjectSetupChecklist items={checklistItems} onAction={onChecklistAction} />
      ) : null}

      <SectionCard className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Services inclus</p>
          <div className="flex flex-wrap items-center gap-2">
            {showServicesToggle ? (
              <Button type="button" size="sm" variant="ghost" onClick={onToggleServicesOverview}>
                {showAllServicesOverview ? 'Voir moins' : 'Voir +'}
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=work`}>Ouvrir Tâches</Link>
            </Button>
          </div>
        </div>
        {servicesWithTasks.length ? (
          <div className="space-y-3">
            {servicesOverview.map(({ service, tasks: svcTasks }) => (
              <ServiceProgressRow
                key={service.id}
                service={{ id: service.id, name: service.service.name }}
                tasks={svcTasks}
                businessId={businessId}
                projectId={projectId}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        ) : (
          <GuidedCtaCard
            title="Aucun service ajouté au projet."
            description="Ajoute des services pour structurer le travail et la facturation."
            primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` }}
          />
        )}
      </SectionCard>

      <SectionCard className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Prochaines actions</p>
          {showActionsToggle ? (
            <Button type="button" size="sm" variant="ghost" onClick={onToggleActionsOverview}>
              {showAllActionsOverview ? 'Voir moins' : 'Voir +'}
            </Button>
          ) : null}
        </div>
        {upcomingTasks.length ? (
          <div className="space-y-1">
            {upcomingTasksOverview.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onTaskClick?.(task.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--surface-2)]/80"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-[var(--text-primary)]">{task.title}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    {task.assigneeName || task.assigneeEmail || 'Non assigné'}
                    {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    getStatusBadgeClasses(task.status)
                  )}
                >
                  {formatTaskStatus(task.status)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <GuidedCtaCard
            title="Aucune tâche planifiée."
            description="Crée des tâches pour organiser le travail."
            primary={{ label: 'Créer une tâche', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` }}
          />
        )}
      </SectionCard>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <SectionCard className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Équipe (accès au projet)</p>
            {isAdmin ? (
              <Button size="sm" variant="outline" onClick={onOpenAccessModal}>
                Gérer l&apos;accès
              </Button>
            ) : null}
          </div>
          {projectMembersPreview.length ? (
            <div className="flex flex-wrap items-center gap-3">
              {projectMembersPreview.map((member) => (
                <div
                  key={member.membershipId}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                >
                  <InitialsAvatar name={member.user.name} email={member.user.email} size={24} />
                  <span className="max-w-[140px] truncate text-[var(--text-primary)]">
                    {member.user.name ?? member.user.email ?? '—'}
                  </span>
                </div>
              ))}
              {projectMembersOverflow > 0 ? (
                <span className="rounded-full border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                  +{projectMembersOverflow}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              Aucun accès configuré pour ce projet.
            </p>
          )}
          {accessInfo ? <p className="text-xs text-[var(--success)]">{accessInfo}</p> : null}
        </SectionCard>

        <SectionCard className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Activité récente</p>
            {showActivityToggle ? (
              <Button type="button" size="sm" variant="ghost" onClick={onToggleActivity}>
                {showAllActivity ? 'Voir moins' : 'Voir +'}
              </Button>
            ) : null}
          </div>
          {activityOverview.length ? (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              {activityOverview.map((item) => (
                <div
                  key={`${item.taskId}-${item.occurredAt ?? ''}`}
                  className="flex items-start gap-3 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2 overflow-hidden"
                >
                  <InitialsAvatar name={item.actor?.name} email={item.actor?.email} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--text-primary)] line-clamp-2 break-words text-sm">
                      <span className="font-medium">{item.actor?.name ?? item.actor?.email ?? "Quelqu'un"}</span>
                      {' '}a marqué «&nbsp;{item.title}&nbsp;» comme{' '}
                      <span className={cn(
                        'inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide align-middle',
                        getStatusBadgeClasses(item.status)
                      )}>
                        {formatTaskStatus(item.status)}
                      </span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      {item.serviceName ? `${item.serviceName} · ` : ''}{formatDate(item.occurredAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Aucune activité récente.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
