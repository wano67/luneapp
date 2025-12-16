export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-semibold ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--accent-strong)] shadow-sm shadow-[var(--shadow-float)]/20">
        <span className="text-lg leading-none">L</span>
      </div>
      <span className="text-base tracking-tight text-[var(--text)]">Lune</span>
    </div>
  );
}
