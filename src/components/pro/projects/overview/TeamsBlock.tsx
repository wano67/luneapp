import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

export function TeamsBlock({ businessId }: { businessId: string }) {
  return (
    <GuidedCtaCard
      title="Aucune équipe assignée."
      description="Assigner les équipes permet de déléguer et suivre l’avancement."
      primary={{ label: 'Assigner des équipes', href: `/app/pro/${businessId}/settings/team` }}
      secondary={{ label: 'Gérer les membres', href: `/app/pro/${businessId}/settings/team` }}
    />
  );
}
