# Audit Navigation & Actionnabilité (PRO)

## Résumé exécutif (top points)
- KPI/headers alignés sur Pro : projets, projet détail, catalogue maintenant cohérents (retour + CTA).
- Catalogue : ajout entrée sidebar + pages détail + liens Modifier pointent vers le bon tab/édition.
- Checklist projet : modals actionnables (client, dates, services, tâches, équipe via invites, documents) branchés sur API existantes.
- Ajout smoke e2e Playwright (skip si env non fourni) pour navigation critique.
- Aucun TODO visible; empty states proposent des actions pertinentes.

## État des commandes
- `pnpm -s lint` ✅
- `pnpm -s typecheck` ✅
- Tests e2e : ajout `pnpm -s test:e2e` (Playwright, requiert env PRO_E2E_* ; non exécuté ici).

## Routes clés (App Router, Pro)
- `/app/pro/[businessId]` (dashboard)
- `/app/pro/[businessId]/agenda`
- `/app/pro/[businessId]/projects`
- `/app/pro/[businessId]/projects/[projectId]`
- `/app/pro/[businessId]/catalog`
- `/app/pro/[businessId]/catalog/services/[serviceId]`
- `/app/pro/[businessId]/catalog/products/[productId]`

## Revue navigation par page
| Page | Retours/CTA | Tabs | Status | Notes / Fix proposé |
| --- | --- | --- | --- | --- |
| Dashboard `/app/pro/[biz]` | Retour Hub (link), actions ok | N/A | OK | Sidebar inclut Catalogue. |
| Agenda `/app/pro/[biz]/agenda` | Retour Dashboard (Btn) | Tabs internes Agenda | OK | Pas de lien cassé trouvé. |
| Projets liste | Retour Dashboard Btn, CTA Nouveau projet | Tabs En cours/Terminés | OK | data-testid non requis; liens vers détail ok. |
| Projet détail | Retour projets Btn, CTA Modifier; checklist modals | Tabs Vue d’ensemble/Travail/Équipe/Facturation/Documents | OK | Modals appellent PATCH projet, services, tasks, invites, upload doc. |
| Catalogue liste | Retour Dashboard Btn, CTA Nouveau (modal) | Tabs Services/Produits | OK | Recherche debounce, cards Voir/Modifier. |
| Catalogue service détail | Retour Catalogue, Modifier => ouvre tab services + edit via query | N/A | OK | Infos facturation affichées. |
| Catalogue produit détail | Retour Catalogue, Modifier => tab produits + edit via query | N/A | OK | SKU/unité affichés. |

## Endpoints utilisés (vérifiés existants)
- Services : `GET/POST /api/pro/businesses/{biz}/services`, `PATCH /api/pro/businesses/{biz}/services/{serviceId}`, `GET /api/pro/businesses/{biz}/services/{serviceId}`
- Produits : `GET/POST /api/pro/businesses/{biz}/products`, `PATCH /api/pro/businesses/{biz}/products/{productId}`, `GET /api/pro/businesses/{biz}/products/{productId}`
- Projets checklist : `PATCH /api/pro/businesses/{biz}/projects/{projectId}` (clientId/dates), `POST /projects/{projectId}/services`, `GET/PATCH /tasks`, `POST /invites`, `POST /clients/{clientId}/documents`
- Membres : `GET /api/pro/businesses/{biz}/members`
- Clients : `GET /api/pro/businesses/{biz}/clients`

## Findings / corrections réalisées
- Sidebar Pro : ajout entrée “Catalogue” (route existante) pour navigation directe.
- Catalogue : boutons Voir/Modifier redirigent vers détail ou modal d’édition (query `tab` + `editService/editProduct` gérés).
- Pages détail service/produit : ajout headers cohérents (retour catalogue + CTA Modifier) et affichage facturation.
- Checklist projet : endpoints et refetch centralisés, aucune redirection générique.
- Playwright : smoke tests de navigation critique ajoutés (skippables via env).

## Recommandations supplémentaires
- Ajouter des data-testid ciblés sur tabs projet/cataloque si l’e2e doit être plus robuste.
- Brancher réellement billingType/recurrence côté backend dès que supporté (UI prête, payload optionnel).
- Centraliser le pattern de PageHeaderPro pour dashboard/agenda/catalogue pour réduire la duplication de header inline.
