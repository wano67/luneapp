# CRM PAGES EDITING AUDIT (PRO)

## Routes & UI
- /app/pro/[businessId]/clients
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (list mode)
  - Behavior: list view with link to detail + "Ouvrir dans l’agenda" per item
- /app/pro/[businessId]/clients/[clientId]
  - Component: `src/app/app/pro/[businessId]/clients/[clientId]/page.tsx`
  - Tabs: projects/accounting/interactions/documents/infos
  - Edit surface: Infos tab (`src/components/pro/clients/ClientInfoTab.tsx`)
- /app/pro/[businessId]/prospects
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (list mode)
  - Behavior: list view with link to detail + "Ouvrir dans l’agenda" per item
- /app/pro/[businessId]/prospects/[prospectId]
  - Component: `src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx`
  - Tabs: infos/interactions/offres
  - Edit surface: Infos tab (inline form)
- /app/pro/[businessId]/agenda
  - Component: `src/components/pro/agenda/AgendaPage.tsx` (hub mode with right panel)

## Editable fields
### Client detail (Infos tab)
- Identity: name, status, sector
- Contact: email, phone, leadSource
- Web: websiteUrl
- Notes: notes
- Category & tags: categoryReferenceId (single), tagReferenceIds (multi)

### Prospect detail (Infos tab)
- Contact: name, contactName, contactEmail, contactPhone
- Pipeline: pipelineStatus, status, probability, nextActionDate
- Notes: interestNote
- Conversion: POST convert (creates client + project)

## RBAC UI
- Admin/Owner only:
  - Client edit actions (Modifier/Enregistrer)
  - Prospect edit actions (Modifier/Enregistrer)
  - Prospect conversion (Convertir en client + projet)
- Viewer/Member:
  - Read-only UI; actions disabled with "Réservé aux admins/owners." hint

## Endpoints used
### Clients
- GET /api/pro/businesses/{businessId}/clients
- GET /api/pro/businesses/{businessId}/clients/{clientId}
- PATCH /api/pro/businesses/{businessId}/clients/{clientId}
- GET /api/pro/businesses/{businessId}/references?type=CATEGORY
- GET /api/pro/businesses/{businessId}/references?type=TAG

### Prospects
- GET /api/pro/businesses/{businessId}/prospects
- GET /api/pro/businesses/{businessId}/prospects/{prospectId}
- PATCH /api/pro/businesses/{businessId}/prospects/{prospectId}
- POST /api/pro/businesses/{businessId}/prospects/{prospectId}/convert

### Related (read-only)
- GET /api/pro/businesses/{businessId}/interactions?prospectId=...
- GET /api/pro/businesses/{businessId}/projects?clientId=...&archived=false

## Limitations / gaps
- Clients/Prospects list pages reuse AgendaPage list mode (no dedicated search UI yet).
- Prospect conversion always creates a project (API does not support "client only").
- Prospect detail does not expose fields like projectIdea/qualificationLevel/origin (available in API but not surfaced).
- Client detail still contains legacy header save button (disabled by default) and company field is not used by API.

## Validation commands
- pnpm -s lint
- pnpm -s typecheck
- pnpm -s build
- Public smoke:
  - NEXT_DIST_DIR=.next-build pnpm start --hostname 0.0.0.0 --port 8080 >/tmp/next.log 2>&1 &
  - SMOKE_BASE_URL=http://127.0.0.1:8080 pnpm -s smoke:nav-surface
