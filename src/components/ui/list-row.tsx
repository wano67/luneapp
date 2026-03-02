import type { ReactNode } from 'react';
import Link from 'next/link';

type ListRowProps = {
  left: ReactNode;
  right?: ReactNode;
  sub?: ReactNode;
  href?: string;
};

export function ListRow({ left, right, sub, href }: ListRowProps) {
  const inner = (
    <div className="flex items-center justify-between py-3 px-1 gap-4">
      <div className="flex-1 min-w-0">
        <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>{left}</div>
        {sub ? <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 2 }}>{sub}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)]">
        {inner}
      </Link>
    );
  }

  return <div className="border-b border-[var(--border)]">{inner}</div>;
}
