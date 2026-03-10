import type { ReactNode } from 'react';

export default function ShareLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }}>
        Powered by <span className="font-semibold">Lune</span>
      </footer>
    </div>
  );
}
