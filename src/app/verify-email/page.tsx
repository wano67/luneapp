'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';
import { Mail, CheckCircle } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams?.get('verified') === 'true';
  const errorParam = searchParams?.get('error');

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(
    errorParam === 'expired'
      ? 'Ce lien a expiré. Demandez un nouvel email de vérification.'
      : errorParam === 'invalid'
        ? 'Ce lien est invalide ou a déjà été utilisé. Si vous avez déjà vérifié votre email, connectez-vous directement.'
        : null
  );

  if (verified) {
    setTimeout(() => router.push('/app'), 2000);
  }

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setResent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof (data as Record<string, unknown>).error === 'string'
            ? (data as { error: string }).error
            : 'Impossible de renvoyer l\'email.'
        );
      }
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <PivotLogo size={40} color="var(--shell-accent)" />
            <PivotWordmark height={20} color="var(--text)" />
          </Link>
        </div>

        <Card className="space-y-6 border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          {verified ? (
            <>
              <div className="flex justify-center">
                <CheckCircle size={48} style={{ color: 'var(--success)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Email vérifié !
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Votre adresse email a été confirmée. Redirection en cours...
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <Mail size={48} style={{ color: errorParam ? 'var(--danger)' : 'var(--accent-strong)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                {errorParam ? 'Vérification impossible' : 'Vérifiez votre email'}
              </h1>
              {!errorParam && (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Un email de vérification a été envoyé à votre adresse.
                  Cliquez sur le lien dans l&apos;email pour activer votre compte.
                </p>
              )}
            </>
          )}

          {error && <Alert variant="danger" title="Erreur" description={error} />}

          {resent && (
            <Alert
              variant="success"
              title="Email envoyé"
              description="Un nouvel email de vérification a été envoyé."
            />
          )}

          {!verified && (
            <div className="space-y-3">
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full"
              >
                {resending ? 'Envoi en cours...' : 'Renvoyer l\'email de vérification'}
              </Button>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                <Link href="/login" className="text-[var(--accent-strong)] hover:underline">
                  Se connecter avec un autre compte
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
