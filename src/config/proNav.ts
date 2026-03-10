import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  ListChecks,
  CalendarDays,
  Users,
  LayoutGrid,
  Boxes,
  Banknote,
  Settings,
  BookUser,
} from 'lucide-react';

export type BusinessRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type ActivityType = 'SERVICE' | 'COMMERCE' | 'MIXTE' | 'LIBERALE';

const ROLE_RANK: Record<BusinessRole, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };

export function hasMinRole(actorRole: string | null | undefined, minRole: BusinessRole): boolean {
  if (!actorRole) return false;
  return (ROLE_RANK[actorRole as BusinessRole] ?? 0) >= ROLE_RANK[minRole];
}

export type ProNavItemConfig = {
  id: string;
  label: string;
  href: (businessId: string) => string;
  icon: LucideIcon;
  secondary?: boolean;
  activePatterns?: (businessId: string) => RegExp[];
  minRole?: BusinessRole;
  activityTypes?: ActivityType[];
};

export type ProNavSectionConfig = {
  id: string;
  title: string;
  secondary?: boolean;
  items: ProNavItemConfig[];
};

function startsWithRegex(path: string) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:$|/)`);
}

export const proNavSections: ProNavSectionConfig[] = [
  {
    id: 'main',
    title: 'Navigation',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: (biz) => `/app/pro/${biz}`,
        activePatterns: (biz) => [
          new RegExp(`^/app/pro/${biz}/?$`),
        ],
      },
      {
        id: 'projects',
        label: 'Projets',
        icon: Briefcase,
        href: (biz) => `/app/pro/${biz}/projects`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/projects`)],
      },
      {
        id: 'tasks',
        label: 'Mes Tâches',
        icon: ListChecks,
        href: (biz) => `/app/pro/${biz}/tasks`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/tasks`)],
      },
      {
        id: 'calendar',
        label: 'Calendrier',
        icon: CalendarDays,
        href: (biz) => `/app/pro/${biz}/calendar`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/calendar`)],
      },
      {
        id: 'crm',
        label: 'CRM',
        icon: BookUser,
        href: (biz) => `/app/pro/${biz}/agenda`,
        minRole: 'MEMBER',
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/agenda`),
          startsWithRegex(`/app/pro/${biz}/clients`),
          startsWithRegex(`/app/pro/${biz}/prospects`),
        ],
      },
      {
        id: 'finances',
        label: 'Finances',
        icon: Banknote,
        href: (biz) => `/app/pro/${biz}/finances`,
        minRole: 'MEMBER',
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/finances`),
          startsWithRegex(`/app/pro/${biz}/accounting`),
        ],
      },
    ],
  },
  {
    id: 'gestion',
    title: 'Gestion',
    items: [
      {
        id: 'catalog',
        label: 'Catalogue services',
        icon: LayoutGrid,
        href: (biz) => `/app/pro/${biz}/services`,
        minRole: 'MEMBER',
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/services`)],
      },
      {
        id: 'stock',
        label: 'Stock',
        icon: Boxes,
        href: (biz) => `/app/pro/${biz}/stock`,
        minRole: 'MEMBER',
        activityTypes: ['COMMERCE', 'MIXTE'],
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/stock`)],
      },
      {
        id: 'team',
        label: 'Équipe',
        icon: Users,
        href: (biz) => `/app/pro/${biz}/team`,
        minRole: 'ADMIN',
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/team`)],
      },
    ],
  },
  {
    id: 'admin',
    title: 'Paramètres',
    secondary: true,
    items: [
      {
        id: 'settings',
        label: 'Paramètres',
        icon: Settings,
        href: (biz) => `/app/pro/${biz}/settings`,
        minRole: 'ADMIN',
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/settings`),
          startsWithRegex(`/app/pro/${biz}/organization`),
          startsWithRegex(`/app/pro/${biz}/references`),
        ],
      },
    ],
  },
];
