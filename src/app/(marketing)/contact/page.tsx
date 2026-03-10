'use client';

import { useState } from 'react';
import { ScrollReveal } from '@/components/marketing/ScrollReveal';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);

    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      name: (data.get('name') as string)?.trim(),
      email: (data.get('email') as string)?.trim(),
      subject: (data.get('subject') as string)?.trim(),
      message: (data.get('message') as string)?.trim(),
    };

    if (!body.name || !body.email || !body.subject || !body.message) {
      setError('Veuillez remplir tous les champs.');
      setSending(false);
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError((json as Record<string, string> | null)?.error ?? 'Une erreur est survenue.');
      } else {
        setSent(true);
        form.reset();
      }
    } catch {
      setError('Impossible d\'envoyer le message. Reessayez plus tard.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <SectionHeader variant="marketing"
          title="Contact"
          description="Un besoin specifique, une question sur la securite ou les tarifs ?"
        />
      </ScrollReveal>

      <ScrollReveal delay={100}>
        <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-lg font-semibold text-[var(--text)]">Message envoye</p>
              <p className="text-sm text-[var(--text-faint)]">
                Nous reviendrons vers vous dans les plus brefs delais.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setSent(false)}>
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="name" label="Nom" placeholder="Votre nom" required />
                <Input name="email" label="Email" type="email" placeholder="vous@exemple.com" required />
              </div>
              <Input name="subject" label="Sujet" placeholder="Ex: Integrer mon CRM, securite, tarif..." required />
              <label className="flex w-full flex-col gap-1">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Message</span>
                <textarea
                  name="message"
                  rows={5}
                  required
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  placeholder="Decrivez votre besoin..."
                />
              </label>
              {error && (
                <p className="text-sm text-[var(--danger)]">{error}</p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={sending}>
                  {sending ? 'Envoi en cours\u2026' : 'Envoyer'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      </ScrollReveal>
    </div>
  );
}
