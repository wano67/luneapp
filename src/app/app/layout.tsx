// src/app/app/layout.tsx
import type { ReactNode } from 'react';
import PivotShell from './PivotShell';
import { ToastProvider } from '@/components/ui/toast';
import { UserPreferencesProvider } from '@/lib/hooks/useUserPreferences';

export default function InternalAppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <UserPreferencesProvider>
        <PivotShell>{children}</PivotShell>
      </UserPreferencesProvider>
    </ToastProvider>
  );
}
