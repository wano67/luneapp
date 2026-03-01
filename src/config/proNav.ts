import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Folder,
  Boxes,
  Banknote,
  Settings2,
  Contact2,
  BookOpen,
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
          startsWithRegex(`/app/pro/${biz}`),
          startsWithRegex(`/app/pro/${biz}/dash`),
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
        label: 'Tâches',
        icon: ClipboardList,
        href: (biz) => `/app/pro/${biz}/tasks`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/tasks`)],
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM',
    items: [
      {
        id: 'clients',
        label: 'Clients',
        icon: Contact2,
        href: (biz) => `/app/pro/${biz}/clients`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/clients`)],
      },
      {
        id: 'prospects',
        label: 'Prospects',
        icon: BookOpen,
        href: (biz) => `/app/pro/${biz}/prospects`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/prospects`)],
      },
      {
        id: 'agenda',
        label: 'Agenda (Suivi)',
        icon: CalendarClock,
        href: (biz) => `/app/pro/${biz}/agenda`,
        activePatterns: (biz) => [startsWithRegex(`/app/pro/${biz}/agenda`)],
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
