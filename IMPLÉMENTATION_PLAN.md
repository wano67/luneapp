## Objectif
Refondre `/app/app/pro/[businessId]/page.tsx` en “ProDashboard” riche et interactif, consommant les endpoints existants sans casser RBAC.

## Fichiers à créer/éditer
- `src/app/app/pro/[businessId]/page.tsx` : remplacer le contenu par le composant `ProDashboard` (client component).
- `src/components/pro/ProDashboard.tsx` (nouveau) : logique de données, charts, état (date range, filters).
- `src/components/pro/KpiCard.tsx`, `src/components/pro/ChartCard.tsx` (optionnel pour factorisation).
- `src/lib/charts/*` (optionnel) : wrappers Recharts/ApexCharts/Chart.js.
- `src/lib/api/dashboard.ts` (optionnel) : helpers fetchJson pour dashboard/finances/tasks/prospects.
- Tests: si jest/playwright absents, ajouter tests de parsing (unit) pour agrégations (ex: tasksByStatus).

## Données & appels
- `/api/pro/businesses/:bid/dashboard` : base pour KPIs, latestTasks, interactions, monthlySeries.
- `/api/pro/businesses/:bid/finances?aggregate=1&periodStart&periodEnd` : revenus/dépenses/net sur plage sélectionnée.
- `/api/pro/businesses/:bid/finances?periodStart&periodEnd` : série cash-flow (agrégation front par jour/semaine).
- `/api/pro/businesses/:bid/tasks` : regroupement par statut + détection retard.
- `/api/pro/businesses/:bid/prospects` : groupage pipeline.
- `/api/pro/businesses/:bid/clients` : tri createdAt pour “clients récents”.

## UI / UX
- Sélecteur de période (7/30/90 jours, custom).
- KPI cards: revenus, dépenses, net, projets actifs, tâches ouvertes, next actions 7j.
- Charts: line (revenus vs dépenses, zone net), donut (tâches statut), bar (pipeline prospects).
- Tables: projets actifs (nom/statut/progress), tâches à venir, interactions à venir, clients récents.
- Alertes: devis non signés, acompte non payé, tâches en retard, cashflow négatif.
- CTA (admin only): “Créer projet”, “Ajouter service”, “Ajouter interaction”; désactivés + tooltip pour viewer.
- Loader/spinner pendant fetch; erreurs surfacent message + request-id (fetchJson.error + requestId).

## RBAC
- Détecter rôle via ActiveBusinessProvider (role).  
- Mode viewer: toutes mutations/CTA désactivés; banner lecture seule (RoleBanner).

## Tech
- Charts: privilégier Recharts (simple, SSR-friendly) ou Chart.js dynamic import (client only).  
- State: React hooks, fetchJson avec abort controller; memoized aggregations (tasksByStatus, pipeline counts).  
- Pas de navigation globale additionnelle.

## Backend éventuel (si nécessaire)
- Optionnel: endpoint `/api/pro/businesses/:bid/tasks/stats` pour counts/late; `/finances/summary?group=category` pour breakdown catégoriel. (Voir RUNBOOK pour cURL exemples)

## Tests / CI
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- (Pas de tests existants; optionnel ajouter tests unitaires de formatage/agrégation si infra dispo.)
