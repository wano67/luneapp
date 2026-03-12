import type { ReactNode } from 'react';
import {
  IconHome,
  IconBankAccount,
  IconTransaction,
  IconBudget,
  IconSavings,
} from '@/components/pivot-icons';
import { CalendarDays, TrendingUp } from 'lucide-react';

export type PersonalNavItem = {
  id: string;
  label: string;
  href: string;
  icon: (color: string) => ReactNode;
  /** Use exact match instead of prefix match */
  exact?: boolean;
};

export type PersonalNavSection = {
  id: string;
  title: string;
  items: PersonalNavItem[];
};

export const personalNavSections: PersonalNavSection[] = [
  {
    id: 'finances',
    title: 'Finances',
    items: [
      {
        id: 'home',
        label: 'Vue d\'accueil',
        href: '/app/personal',
        icon: (c) => <IconHome size={20} color={c} />,
        exact: true,
      },
      {
        id: 'comptes',
        label: 'Comptes',
        href: '/app/personal/comptes',
        icon: (c) => <IconBankAccount size={20} color={c} />,
      },
      {
        id: 'transactions',
        label: 'Transactions',
        href: '/app/personal/transactions',
        icon: (c) => <IconTransaction size={20} color={c} />,
      },
    ],
  },
  {
    id: 'gestion',
    title: 'Gestion',
    items: [
      {
        id: 'budgets',
        label: 'Budgets',
        href: '/app/personal/budgets',
        icon: (c) => <IconBudget size={20} color={c} />,
      },
      {
        id: 'epargne',
        label: 'Épargne',
        href: '/app/personal/epargne',
        icon: (c) => <IconSavings size={20} color={c} />,
      },
      {
        id: 'patrimoine',
        label: 'Patrimoine',
        href: '/app/personal/patrimoine',
        icon: (c) => <TrendingUp size={20} color={c} />,
      },
      {
        id: 'calendar',
        label: 'Calendrier',
        href: '/app/personal/calendar',
        icon: (c) => <CalendarDays size={20} color={c} />,
      },
    ],
  },
];
