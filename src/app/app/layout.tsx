// src/app/app/layout.tsx
import type { ReactNode } from 'react';
import AppShell from './AppShell';
import { ToastProvider } from '@/components/ui/toast';

export default function InternalAppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
