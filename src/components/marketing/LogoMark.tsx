import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <PivotLogo size={32} color="var(--shell-accent)" />
      <PivotWordmark height={18} color="currentColor" />
    </div>
  );
}
