# CRM NAV ORDER AUDIT (PRO)

## Route Map (CRM)
### Hub
- `/app/pro/[businessId]/agenda`
  - File: `src/app/app/pro/[businessId]/agenda/page.tsx`
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (hub mode)
  - Purpose: CRM hub (panel, quick actions)

### Lists (dedicated)
- `/app/pro/[businessId]/clients`
  - File: `src/app/app/pro/[businessId]/clients/page.tsx`
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (list mode)
- `/app/pro/[businessId]/prospects`
  - File: `src/app/app/pro/[businessId]/prospects/page.tsx`
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (list mode)

### Detail (dedicated)
- `/app/pro/[businessId]/clients/[clientId]`
  - File: `src/app/app/pro/[businessId]/clients/[clientId]/page.tsx`
  - Edit UI: `src/components/pro/clients/ClientInfoTab.tsx`
- `/app/pro/[businessId]/prospects/[prospectId]`
  - File: `src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx`
  - Edit UI: inline form in page component

### Duplicates (outside businessId)
- `/app/pro/clients`
  - File: `src/app/app/pro/clients/page.tsx` (client-side redirect)
- `/app/pro/prospects`
  - File: `src/app/app/pro/prospects/page.tsx` (client-side redirect)

## Components & Reuse
- `AgendaPage` is reused for:
  - Hub (agenda) + list pages (clients/prospects)
- `ContactCard` used across list views
- Client detail uses modular tabs (`ClientInfoTab`, `ClientDocumentsTab`, etc.)
- Prospect detail is single page with inline edit form (no dedicated component folder)
- Sidebar exposes a single CRM entry that points to the hub; list pages remain accessible via URLs and in-panel links.

## Endpoints Used (CRM)
### Agenda hub
- GET `/api/pro/businesses/{businessId}/clients`
- GET `/api/pro/businesses/{businessId}/prospects`
- GET `/api/pro/businesses/{businessId}/projects?archived=false`
- GET `/api/pro/businesses/{businessId}/clients/{clientId}` (panel)
- GET `/api/pro/businesses/{businessId}/prospects/{prospectId}` (panel)
- POST `/api/pro/businesses/{businessId}/projects` (create from client)
- POST `/api/pro/businesses/{businessId}/prospects/{prospectId}/convert` (convert prospect)

### Dedicated detail pages
- Clients:
  - GET `/api/pro/businesses/{businessId}/clients/{clientId}`
  - PATCH `/api/pro/businesses/{businessId}/clients/{clientId}`
  - GET `/api/pro/businesses/{businessId}/projects?clientId=...`
  - GET `/api/pro/businesses/{businessId}/references?type=CATEGORY`
  - GET `/api/pro/businesses/{businessId}/references?type=TAG`
- Prospects:
  - GET `/api/pro/businesses/{businessId}/prospects/{prospectId}`
  - PATCH `/api/pro/businesses/{businessId}/prospects/{prospectId}`
  - POST `/api/pro/businesses/{businessId}/prospects/{prospectId}/convert`
  - GET `/api/pro/businesses/{businessId}/interactions?prospectId=...`

## Canonicalization Rules (Source of Truth)
- Canonical CRM routes are under `/app/pro/[businessId]/...`
  - Hub: `/agenda`
  - Lists: `/clients`, `/prospects`
  - Detail: `/clients/[clientId]`, `/prospects/[prospectId]`
- `/app/pro/clients` and `/app/pro/prospects` redirect client-side to the last active business when available, otherwise to `/app/pro`.

## Route → Canonical → Action
| Route | Canonical | Action |
| --- | --- | --- |
| /app/pro/[businessId]/agenda | same | Keep (hub) |
| /app/pro/[businessId]/clients | same | Keep (list) |
| /app/pro/[businessId]/prospects | same | Keep (list) |
| /app/pro/[businessId]/clients/[clientId] | same | Keep (detail/edit) |
| /app/pro/[businessId]/prospects/[prospectId] | same | Keep (detail/edit) |
| /app/pro/clients | /app/pro/[businessId]/clients | Redirect (client-side) |
| /app/pro/prospects | /app/pro/[businessId]/prospects | Redirect (client-side) |

## Recommended User Journeys
1) Hub-first CRM
- Open `/agenda`
- Click contact → panel opens → quick action (create project / convert prospect)
- Use “Ouvrir la fiche” for full edit

2) Client management
- Open `/clients` list
- Open client detail `/clients/[id]`
- Edit in Infos tab (name, status, tags) → save
- Optional: “Ouvrir dans l’agenda” for panel view

3) Prospect follow-up
- Open `/prospects` list
- Open prospect detail `/prospects/[id]`
- Edit pipeline, next action, notes → save
- Convert to client + project → show CTAs

4) Deep-link support
- Open a direct detail URL → page is fully editable
- Optionally click “Ouvrir dans l’agenda” to return to hub view

## Required Code Changes (to align nav + canonical UX)
- Navigation
  - Keep a single CRM entry (hub) in the primary section
  - Remove Clients/Prospects from the sidebar to avoid duplication
- Hub panel
  - Add “Ouvrir la fiche” link in Agenda panel for client/prospect
- Redirects for non-canonical routes
  - `/app/pro/clients` and `/app/pro/prospects` redirect to canonical routes

## Tests & Validation
- `pnpm -s lint`
- `pnpm -s typecheck`
- `pnpm -s build`
- `SMOKE_BASE_URL=http://127.0.0.1:8080 pnpm -s smoke:nav-surface`
