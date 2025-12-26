# Audit PRO — Pages & API

## Pages (App Router)
- /app/pro (Studio home) — src/app/app/pro/page.tsx (client: ProHomeClient)
- /app/pro?kind=service|product — filtered view on Studio home
- /app/pro/businesses — list of businesses
- /app/pro/businesses/[businessId] — business page (legacy path)
- /app/pro/[businessId] — business dashboard wrapper -> ProDashboard
- /app/pro/[businessId]/projects — list (placeholder skeleton)
- /app/pro/[businessId]/projects/[projectId] — project hub (tabs placeholder)
- /app/pro/[businessId]/agenda — combined clients/prospects (placeholder)
- /app/pro/[businessId]/accounting — invoices/quotes/payments (placeholder)
- /app/pro/[businessId]/marketing — emails/posts/templates (placeholder)
- /app/pro/[businessId]/clients — clients list
- /app/pro/[businessId]/clients/[clientId] — client detail
- /app/pro/[businessId]/prospects — prospects list
- /app/pro/[businessId]/projects (legacy dashboard tiles)
- /app/pro/[businessId]/finances (+ subpages treasury/forecasting/invoices/ledger/payments/vat)
- /app/pro/[businessId]/services (+ templates/import)
- /app/pro/[businessId]/settings (+ tabs: team, billing, integrations, permissions, taxes)
- /app/pro/[businessId]/tasks
- /app/pro/[businessId]/process (+ steps)
- /app/pro/[businessId]/references (+ categories/numbering/tags)
- /app/pro/[businessId]/stock, /process, etc. (see file tree)

## APIs /api/pro/** (route.ts)
- /api/pro/businesses (GET list, POST create)
- /api/pro/businesses/[businessId] (GET/PATCH/DELETE business)
- /api/pro/businesses/[businessId]/dashboard (GET KPIs, tasks, etc.)
- /api/pro/businesses/[businessId]/overview (not found)
- /api/pro/businesses/[businessId]/projects (GET list; POST create?) + subroutes for archive/start/unarchive/pricing/quotes/services/invoices
- /api/pro/businesses/[businessId]/tasks (GET list; PATCH task) + /[taskId]
- /api/pro/businesses/[businessId]/clients (GET/POST) + /bulk, /[clientId]
- /api/pro/businesses/[businessId]/prospects (GET/POST) + convert
- /api/pro/businesses/[businessId]/members (GET) + /[userId]
- /api/pro/businesses/[businessId]/interactions, inventory/summary
- /api/pro/businesses/[businessId]/finances (aggregate) + treasury/vat/forecasting/ledger/payments
- /api/pro/businesses/[businessId]/quotes + pdf/invoices
- /api/pro/businesses/[businessId]/services (+ templates/import)
- /api/pro/businesses/[businessId]/settings
- /api/pro/overview (GET global counts)
- /api/logo (logo-first) ; /api/favicon (fallback)
- Auth/dev/health/etc. (non-PRO)

## Mapping Page -> APIs
- /app/pro (ProHomeClient): /api/auth/me, /api/pro/businesses, /api/pro/overview; per-business stats via /projects, /members, /clients.
- /app/pro/[businessId] (ProDashboard): /api/pro/businesses/{id}/dashboard, /finances?aggregate=1, /tasks, /prospects, /clients (prospects/clients removed in refactor; now dashboard uses dashboard+finances+tasks).
- /app/pro/[businessId]/projects: none yet (placeholder) — missing list API usage.
- /app/pro/[businessId]/projects/[projectId]: none yet (placeholder).
- /app/pro/[businessId]/agenda: none yet (placeholder) — should reuse clients+prospects endpoints.
- /app/pro/[businessId]/accounting: none yet (placeholder) — should reuse invoices/quotes/payments/treasury.
- /app/pro/[businessId]/marketing: none yet (placeholder).
- /app/pro/[businessId]/clients/prospects: uses respective APIs.
- /app/pro/[businessId]/finances: uses finances endpoints; treasury/vat/forecasting subpages exist.
- /app/pro/[businessId]/settings: uses settings/members.
- /app/pro/[businessId]/services/references/process/tasks: use matching APIs.

## Doublons / Dettes
- Logo: /api/logo (new) vs /api/favicon (old). UI still mixes favicon/avatar helpers; should standardize on /api/logo.
- Business context duplicated: AppSidebar active block + pages sometimes re-render context; recent recents logic redundant when inside business.
- Placeholder pages (projects/agenda/accounting/marketing) lack data wiring.
- Prospects/clients endpoints both used; agenda could reuse instead of new endpoints.
- Multiple dashboard tiles/sections previously duplicated (statTiles removed). Ensure no double fetch of dashboard vs finances vs overview.
- Normalization URL: normalizeWebsiteUrl legacy vs new normalizeWebsiteUrl helper (async). Align on canonical helper.

## Recommandations V1 premium (minimal)
### Réutiliser / adapter
1) Unifier sidebar PRO avec fixed modules + single active business block; drop recents inside business.
2) Business dashboard: keep /dashboard + /finances + /tasks; remove extra fetches; keep 4 KPI block only.
3) Studio home: keep /overview + /businesses; use /api/logo everywhere.
4) Projects list: wire /api/pro/businesses/{id}/projects (with status filter) into projects page; tabs = query.
5) Project hub: reuse /projects/{projectId} endpoints (pricing/quotes/services/tasks) as tabs.
6) Agenda: reuse /clients + /prospects (filter by type) without new API.
7) Accounting: reuse invoices/quotes/payments/treasury endpoints; surface aggregate.
8) Marketing: placeholder only, no API change.
9) Settings/team: reuse existing members/settings endpoints.
10) Keep /api/favicon only as backward-compatible fallback; UI should call /api/logo.

### À créer (minimum)
- SWR/shared hook useActiveBusiness to fetch /api/pro/businesses once and provide active business meta to sidebar/header/pages.
- Wire tabs in new pages to existing APIs (no new endpoints): projects (status), agenda (type=client/prospect), accounting (invoices/quotes/payments aggregate), marketing (placeholder).
- Optional: lightweight caching for /api/pro/businesses list.

## Tables

### Pages
| Page | Objectif | APIs utilisées | APIs manquantes | Notes |
| --- | --- | --- | --- | --- |
| /app/pro | Hub global (entreprises, KPIs) | /api/auth/me, /api/pro/businesses, /api/pro/overview, per-business /projects /members /clients | Solde par business (non utilisé) | Doit unifier logo via /api/logo |
| /app/pro/[businessId] | Dashboard entreprise | /api/pro/businesses/{id}/dashboard, /finances?aggregate=1, /tasks | Prospects/Clients (retirés) | Simplifier sections; un seul header |
| /app/pro/[businessId]/projects | Liste projets (tabs) | (manquant) à brancher /projects?status | none | Client page placeholder |
| /app/pro/[businessId]/projects/[projectId] | Hub projet | (manquant) | tasks/quotes/pricing/services endpoints | Placeholder tabs |
| /app/pro/[businessId]/agenda | Agenda clients/prospects | (manquant) | reuse /clients /prospects | Placeholder |
| /app/pro/[businessId]/accounting | Comptabilité | (manquant) | invoices/quotes/payments/treasury | Placeholder |
| /app/pro/[businessId]/marketing | Marketing | (manquant) | none | Placeholder |
| /app/pro/[businessId]/clients | Clients | /api/pro/businesses/{id}/clients | none | OK |
| /app/pro/[businessId]/prospects | Prospects | /api/pro/businesses/{id}/prospects | none | OK |
| /app/pro/[businessId]/finances | Finances | /api/pro/businesses/{id}/finances & subroutes | none | OK |
| /app/pro/[businessId]/services | Catalogue/services | /api/pro/businesses/{id}/services (+templates/import) | none | OK |
| /app/pro/[businessId]/settings | Réglages | /api/pro/businesses/{id}/settings, /members | none | OK |

### API endpoints
| Endpoint | But | Utilisé par | Doublon de | Action |
| --- | --- | --- | --- | --- |
| /api/pro/businesses | Liste/création entreprises | Studio home | none | Garder |
| /api/pro/businesses/[id] | CRUD business | pages settings/dashboard | none | Garder |
| /api/pro/businesses/[id]/dashboard | KPIs entreprise | Business dashboard | none | Garder |
| /api/pro/businesses/[id]/projects | Liste projets | (à brancher projects page) | none | Garder |
| /api/pro/businesses/[id]/tasks | Liste tâches | Dashboard, tasks page | none | Garder |
| /api/pro/businesses/[id]/clients | Clients | clients page | none | Garder |
| /api/pro/businesses/[id]/prospects | Prospects | prospects page | none | Garder |
| /api/pro/businesses/[id]/finances (+sub) | Finances | dashboard/finances | none | Garder |
| /api/pro/businesses/[id]/members | Membres | settings/team | none | Garder |
| /api/logo | Logo-first | avatars/cards | overlaps /api/favicon | Standardiser sur /api/logo |
| /api/favicon | Favicon fallback | legacy avatars | /api/logo | Garder en fallback |

## Short-list prioritaire (10)
1) Unifier sidebar PRO fixe (Navigation modules) + supprimer recents en contexte business.
2) Introduire hook useActiveBusiness (cache /api/pro/businesses) pour sidebar/header.
3) Standardiser les logos UI sur /api/logo (remplacer getFaviconUrl usages).
4) Business dashboard: conserver header unique, KPI block unique, retirer sections superflues.
5) Brancher /app/pro/[businessId]/projects sur /api/pro/businesses/{id}/projects avec tabs status.
6) Project hub: brancher tâches/quotes/pricing/services endpoints dans les tabs.
7) Agenda: utiliser /clients + /prospects, tabs pour filtrer.
8) Accounting: réutiliser invoices/quotes/payments/treasury (no new APIs).
9) Marketing: laisser placeholder mais cohérent UI.
10) Nettoyer normalizeWebsiteUrl usages (aligner sur helper async if needed) et supprimer doublons favicon/logo helpers.
