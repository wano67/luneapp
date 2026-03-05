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
      className={cn('flex flex-col animate-fade-in-up px-4 py-5 sm:px-7 sm:py-6 pb-10', className)}
    >
      {children}
    </div>
  );
}
