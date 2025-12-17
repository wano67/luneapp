export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-semibold text-[var(--text)] ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm shadow-[var(--shadow-float)]/20">
        <span
          aria-hidden="true"
          className="block h-5 w-5"
          style={{
            maskImage: 'url(/icon.svg)',
            WebkitMaskImage: 'url(/icon.svg)',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            backgroundColor: 'currentColor',
          }}
        />
      </div>
      <span className="text-base tracking-tight">Lune</span>
    </div>
  );
}
