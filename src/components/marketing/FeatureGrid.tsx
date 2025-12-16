import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';

type Feature = {
  title: string;
  category: 'PRO' | 'PERSO' | 'SECURITE' | 'PERFORMANCE';
  description: string;
};

const categoryColor: Record<Feature['category'], 'pro' | 'personal' | 'neutral' | 'performance'> =
  {
    PRO: 'pro',
    PERSO: 'personal',
    SECURITE: 'neutral',
    PERFORMANCE: 'performance',
  };

export function FeatureGrid({ title, description, items }: { title: string; description: string; items: Feature[] }) {
  return (
    <section className="space-y-6">
      <SectionHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card
            key={item.title}
            className="flex h-full flex-col gap-3 border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <Badge variant={categoryColor[item.category]} className="w-fit">
              {item.category}
            </Badge>
            <div className="text-lg font-semibold text-[var(--text)]">{item.title}</div>
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
