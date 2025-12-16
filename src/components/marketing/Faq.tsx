import { SectionHeader } from '@/components/ui/section-header';
import { Card } from '@/components/ui/card';

type FaqItem = {
  question: string;
  answer: string;
};

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section className="space-y-6">
      <SectionHeader
        title="Questions fréquentes"
        description="Ce que nos utilisateurs demandent le plus souvent."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <Card key={item.question} className="border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="text-base font-semibold text-[var(--text)]">{item.question}</div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.answer}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
