'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

type Props = {
  /** Larger variant for hero sections */
  variant?: 'default' | 'hero';
};

export function WaitlistForm({ variant = 'default' }: Props) {
  const searchParams = useSearchParams();
  const refCode = searchParams?.get('ref') || '';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, ...(refCode ? { referralCode: refCode } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Une erreur est survenue.');
      }
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          C&apos;est not&eacute; ! Vous recevrez un email d&egrave;s que votre acc&egrave;s sera pr&ecirc;t.
        </p>
      </div>
    );
  }

  const isHero = variant === 'hero';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex ${isHero ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'} gap-2`}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="votre@email.com"
          className={`flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all ${
            isHero ? 'px-5 py-3.5 text-base' : 'px-4 py-3 text-sm'
          }`}
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 ${
            isHero ? 'px-6 py-3.5 text-base' : 'px-5 py-3 text-sm'
          }`}
          style={{
            background: 'var(--accent)',
            fontFamily: 'var(--font-barlow), sans-serif',
          }}
        >
          {status === 'loading' ? (
            <Loader2 size={isHero ? 20 : 16} className="animate-spin" />
          ) : (
            <>
              Rejoindre la liste
              <ArrowRight size={isHero ? 18 : 16} />
            </>
          )}
        </button>
      </div>
      {status === 'error' && errorMsg ? (
        <p className="mt-2 text-sm text-[var(--danger)]">{errorMsg}</p>
      ) : null}
    </form>
  );
}
