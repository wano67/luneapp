import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type BackButtonProps = {
  href: string;
  label?: string;
};

export function BackButton({ href, label = 'Retour' }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--text-faint)] transition-colors hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      <ArrowLeft size={16} aria-hidden />
      {label}
    </Link>
  );
}
