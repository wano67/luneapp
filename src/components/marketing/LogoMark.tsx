export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-semibold text-[var(--text)] ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm shadow-[var(--shadow-float)]/20">
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          className="h-5 w-5"
          fill="currentColor"
        >
          <path d="M22.6 5.1c-1.3-.4-2.6-.6-3.9-.6-5.8 0-10.6 4.7-10.6 10.5 0 5.8 4.7 10.5 10.6 10.5 2.4 0 4.7-.8 6.5-2.3.6-.5.1-1.5-.6-1.4-3.9.7-7.6-2.4-7.6-6.4 0-2.8 1.8-5.3 4.4-6.2.7-.2.6-1.3-.1-1.4l-.1-.1z" />
        </svg>
      </div>
      <span className="text-base tracking-tight">Lune</span>
    </div>
  );
}
