import type { HTMLAttributes, ReactNode, TableHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  wrapperClassName?: string;
};

export function Table({ children, className, wrapperClassName, ...props }: TableProps) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm',
        wrapperClassName
      )}
    >
      <div className="w-full overflow-x-auto">
        <table
          className={cn('w-full min-w-max border-collapse text-sm text-[var(--text)]', className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function TableHeader({ children, className }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-[var(--surface-2)] text-[var(--text)]', className)}>{children}</thead>
  );
}

export function TableHead({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] break-words',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-[var(--border)]', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('hover:bg-[var(--surface-hover)] transition-colors', className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-3 align-middle text-sm text-[var(--text)] break-words', className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function TableEmpty({ children }: { children: ReactNode }) {
  return (
    <tr>
      <td className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]" colSpan={100}>
        {children}
      </td>
    </tr>
  );
}
