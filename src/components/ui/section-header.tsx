import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SectionHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** "app" (default) = Barlow uppercase 18px ; "marketing" = normal case, larger */
  variant?: 'app' | 'marketing';
  className?: string;
};

export function SectionHeader({ title, description, actions, variant = 'app', className }: SectionHeaderProps) {
  const isMarketing = variant === 'marketing';

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div>
        <h2
          style={
            isMarketing
              ? { color: 'var(--text)', fontSize: 24, fontWeight: 700 }
              : {
                  color: 'var(--text)',
                  fontSize: 18,
                  fontWeight: 600,
                  fontFamily: 'var(--font-barlow), sans-serif',
                  textTransform: 'uppercase' as const,
                }
          }
        >
          {title}
        </h2>
        {description ? (
          <p
            className={isMarketing ? 'mt-2 text-sm leading-relaxed' : 'mt-1 text-xs'}
            style={{ color: 'var(--text-faint)' }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
