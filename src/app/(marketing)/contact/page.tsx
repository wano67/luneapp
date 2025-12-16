import type { Metadata } from 'next';
import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Contact • Lune',
  description: 'Parlez-nous de vos besoins : pro, perso, équipe.',
};

export default function ContactPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Contact"
        description="Un besoin spécifique, une question sur la sécurité ou les tarifs ?"
      />

      <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
        <form className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Nom" placeholder="Votre nom" required />
            <Input label="Email" type="email" placeholder="vous@exemple.com" required />
          </div>
          <Input label="Sujet" placeholder="Ex: Intégrer mon CRM, sécurité, tarif..." required />
          <label className="flex w-full flex-col gap-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Message</span>
            <textarea
              rows={5}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              placeholder="Décrivez votre besoin. Aucun envoi n'est déclenché côté serveur dans cette page publique."
            />
          </label>
          <div className="flex justify-end">
            <Button type="button">Envoyer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
