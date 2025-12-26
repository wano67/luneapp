# TODO_REFACTOR (priorisé)

## P0
1. Harmoniser le composant KPI (extract `KpiCirclesBlock`) et l’utiliser sur Studio, Agenda, Business dashboard pour supprimer divergence.
2. Sécuriser `/api/logo` (timeouts, UA, og/manifest parsing, bannière guard) + smoke tests logos (stripe, notion, studiofief).
3. Client/Prospect detail: assurer fetch + not-found propre + PATCH OK; garder back-to-agenda; aligner styles (no blue).
4. Vérifier et fixer status border Agenda (emerald/rose) + supprimer toute border par défaut qui écrase la couleur.
5. Sidebar: confirmer activePatterns couvrent tous sous-chemins CRM; supprimer tout restant “Clients/Prospects” item legacy.

## P1
1. Extraire `ContactCard` partagé (Agenda/Clients/Prospects) + `StatusBorder` util.
2. Normaliser enums status (project/prospect) côté front (const) pour éviter oublis.
3. LogoAvatar improvements: detect banners via ratio, fallback initials; memoize /api/logo requests.
4. Add Playwright e2e smoke (Agenda render, single arrow, border color) + visual snapshot KPI.
5. Ajouter formatters partagés (currency/date) + small helpers for totals.

## P2
1. Refondre Business dashboard (3–4 KPIs, tabs, one chart) aligné Studio.
2. Marketing/Accounting pages placeholders premium avec tabs et KPIs cohérents.
3. Document centre unifié (list + search placeholder).
4. Cache layer fetchJson (SWR/tanstack) pour listes fréquentes (clients/prospects/projects).
