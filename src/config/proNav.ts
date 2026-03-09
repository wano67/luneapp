import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  CalendarDays,
  Users,
  Folder,
  Boxes,
  Banknote,
  Settings2,
  Contact2,
} from 'lucide-react';

export type ProNavItemConfig = {
  id: string;
  label: string;
  href: (businessId: string) => string;
  icon: LucideIcon;
  secondary?: boolean;
  activePatterns?: (businessId: string) => RegExp[];
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
    id: 'pilotage',
    title: 'Pilotage',
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
    ],
  },
  {
    id: 'operations',
    title: 'Opérations',
    items: [
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
        icon: ClipboardList,
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
        id: 'team',
        label: 'Équipe',
        icon: Users,
        href: (biz) => `/app/pro/${biz}/team`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/team`)],
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    items: [
      {
        id: 'crm',
        label: 'CRM',
        icon: Contact2,
        href: (biz) => `/app/pro/${biz}/agenda`,
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/agenda`),
          startsWithRegex(`/app/pro/${biz}/clients`),
          startsWithRegex(`/app/pro/${biz}/prospects`),
        ],
      },
    ],
  },
  {
    id: 'catalog',
    title: 'Catalogue & Stock',
    items: [
      {
        id: 'catalog',
        label: 'Catalogue services',
        icon: Folder,
        href: (biz) => `/app/pro/${biz}/services`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/services`)],
      },
      {
        id: 'stock',
        label: 'Stock',
        icon: Boxes,
        href: (biz) => `/app/pro/${biz}/stock`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/stock`)],
      },
    ],
  },
  {
    id: 'finances',
    title: 'Finances',
    items: [
      {
        id: 'finances',
        label: 'Finances',
        icon: Banknote,
        href: (biz) => `/app/pro/${biz}/finances`,
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/finances`),
          startsWithRegex(`/app/pro/${biz}/accounting`),
        ],
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
        icon: Settings2,
        href: (biz) => `/app/pro/${biz}/settings`,
        activePatterns: (biz) => [
          startsWithRegex(`/app/pro/${biz}/settings`),
          startsWithRegex(`/app/pro/${biz}/organization`),
          startsWithRegex(`/app/pro/${biz}/references`),
        ],
      },
    ],
  },
];
