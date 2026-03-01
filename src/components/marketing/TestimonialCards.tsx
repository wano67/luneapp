import { Card } from '@/components/ui/card';

const testimonials = [
  {
    quote:
      "Lune m'a permis de voir enfin où va mon argent entre mes missions et mes charges perso. Tout est au même endroit.",
    name: 'S. Martin',
    role: 'Développeur freelance',
    initials: 'SM',
  },
  {
    quote:
      "On a démarré à 3 dans l'agence, et le cockpit pro nous a évité les tableurs qu'on n'avait jamais le temps de tenir.",
    name: 'L. Petit',
    role: "Gérant d'agence web",
    initials: 'LP',
  },
  {
    quote:
      "La séparation entre l'espace pro et perso m'a aidée à retrouver une vraie clarté sur mes finances. Simple et sans bruit.",
    name: 'A. Dubois',
    role: 'Designer UX indépendante',
    initials: 'AD',
  },
];

export function TestimonialCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {testimonials.map((t) => (
        <Card
          key={t.name}
          className="flex flex-col gap-4 border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            &ldquo;{t.quote}&rdquo;
          </p>
          <div className="mt-auto flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)]">
              {t.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">{t.name}</p>
              <p className="text-xs text-[var(--text-faint)]">{t.role}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
