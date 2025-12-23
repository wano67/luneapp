// src/app/app/components/PageHeader.tsx
'use client';

import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

type ButtonVariant = ComponentProps<typeof Button>['variant'];

type Action =
  | {
      label: string;
      href: string;
      icon?: ReactNode;
      variant?: ButtonVariant;
    }
  | {
      label: string;
      onClick: () => void;
      icon?: ReactNode;
      variant?: ButtonVariant;
    };

type PageHeaderProps = {
  backHref?: string;
  backLabel?: string;
  title: string;
  subtitle?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  context?: ReactNode;
};

export function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  context,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      {backHref && backLabel ? (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-[var(--text-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <ArrowLeft size={16} aria-hidden />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="truncate text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {subtitle ? <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          {context ? <div className="w-full min-w-0 md:w-auto">{context}</div> : null}
          <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
            {secondaryAction ? (
              'href' in secondaryAction ? (
                <Button asChild variant={secondaryAction.variant ?? 'outline'} size="sm">
                  <Link href={secondaryAction.href} className="flex items-center gap-2">
                    {secondaryAction.icon}
                    <span>{secondaryAction.label}</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  variant={secondaryAction.variant ?? 'outline'}
                  size="sm"
                  onClick={secondaryAction.onClick}
                  className="flex items-center gap-2"
                >
                  {secondaryAction.icon}
                  <span>{secondaryAction.label}</span>
                </Button>
              )
            ) : null}
            {primaryAction ? (
              'href' in primaryAction ? (
                <Button asChild size="sm" className={cls('flex items-center gap-2')}>
                  <Link href={primaryAction.href}>
                    {primaryAction.icon}
                    <span>{primaryAction.label}</span>
                  </Link>
                </Button>
              ) : (
                <Button size="sm" className="flex items-center gap-2" onClick={primaryAction.onClick}>
                  {primaryAction.icon}
                  <span>{primaryAction.label}</span>
                </Button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
