import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type PageContainerProps = {
  children: ReactNode;
  /** Override max-width. Default: max-w-6xl */
  maxWidth?: 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl' | 'max-w-7xl';
  className?: string;
};

export function PageContainer({
  children,
  maxWidth = 'max-w-6xl',
  className,
}: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full px-4 pb-10 pt-4 sm:px-6', maxWidth, className)}>
      {children}
    </div>
  );
}
