import type { ReactNode } from 'react';
import {
  IconDashboard,
  IconOperation,
  IconCrm,
  IconCatalogue,
  IconStock,
  IconFinance,
  IconSettings,
} from '@/components/pivot-icons';

/** Maps proNav item IDs to Pivot icon render functions. */
export const pivotIconMap: Record<string, (color: string) => ReactNode> = {
  dashboard: (c) => <IconDashboard size={20} color={c} />,
  projects: (c) => <IconOperation size={20} color={c} />,
  tasks: (c) => <IconOperation size={20} color={c} />,
  calendar: (c) => <IconOperation size={20} color={c} />,
  clients: (c) => <IconCrm size={20} color={c} />,
  prospects: (c) => <IconCrm size={20} color={c} />,
  agenda: (c) => <IconCrm size={20} color={c} />,
  catalog: (c) => <IconCatalogue size={20} color={c} />,
  stock: (c) => <IconStock size={20} color={c} />,
  finances: (c) => <IconFinance size={20} color={c} />,
  team: (c) => <IconCrm size={20} color={c} />,
  settings: (c) => <IconSettings size={20} color={c} />,
};
