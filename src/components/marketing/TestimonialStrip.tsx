import { Card } from '@/components/ui/card';

const logos = ['Nova Studio', 'Atelier 7', 'Horizon', 'North&Co', 'Studio Alto', 'Vertex'];

export function TestimonialStrip() {
  return (
    <Card className="border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[var(--text-secondary)]">
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-[0.25em]">
        {logos.map((logo) => (
          <span key={logo} className="text-[var(--text-faint)]">
            {logo}
          </span>
        ))}
      </div>
    </Card>
  );
}
