// src/app/app/layout.tsx
import type { ReactNode } from 'react';
import PivotShell from './PivotShell';
import { ToastProvider } from '@/components/ui/toast';

export default function InternalAppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PivotShell>{children}</PivotShell>
    </ToastProvider>
  );
}
