## P0 (bloquant)
- CSRF config non documentée en dev → 403 silencieux (APP_URL/NEXT_PUBLIC_APP_URL). Fichiers: src/server/security/csrf.ts, runbook. Action: doc + alerte UI dans hub/pro.
- Placeholders visibles (process, finances*, personal budgets/épargne/dash-*) créent navigation morte. Action: badger/masquer avec redirection utile. Files: corresponding page.tsx.
- Member peut cliquer CTA mutation avant 403; besoin désactivation claire. Files: services/prospects/projects/clients/tasks pages. Action: disable CTA + message.

## P1 (MVP cohérent)
- Découvrabilité faible depuis /app (pas de “next step”). Action: ajouter bloc “Commencer” reliant Perso/Pro actifs. File: src/app/app/page.tsx.
- Tâches globales sans filtre “me” ni tri clair. Action: preset filter + badge. File: /pro/[businessId]/tasks/page.tsx.
- Project detail: feedback start/archiver/CSRF manquant. Action: message d’erreur clair + bouton disabled avec raison. File: project detail page.
- Services templates: read-only UX, message dès ouverture; CTA disabled si viewer. File: services page.
- Prospects detail: CTA convertir disabled pour member + tooltip raison. File: prospects detail page.
- Clients detail: stubs financiers/projets -> remplacer par “Bientôt” + lien retour liste. File: clients detail.

## P2 (Qualité/scale)
- Pagination manquante sur listes (services/prospects/clients/tasks/interactions). Action: add limit/cursor support UI.
- Logging/observability: surfacer x-request-id dans toasts. Action: toast layer reuse fetchJson. Files: shared UI.
- Personal wallet: summary not auto-refreshed after tx (UX). Action: optimistic refresh hook.
- Performance dev: Turbopack ENOENT; default to dev:stable in docs. File: README/runbook.
- Exports/filters: add “type/date” filters in interactions UI.
