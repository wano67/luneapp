import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn('flex flex-col animate-fade-in-up', className)}
      style={{ padding: '24px 28px', paddingBottom: 40 }}
    >
      {children}
    </div>
  );
}
