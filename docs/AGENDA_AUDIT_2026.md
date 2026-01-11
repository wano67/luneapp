# AGENDA AUDIT 2026 (PRO)

## Scope and sources
- UI routes: `src/app/app/pro/[businessId]/agenda/**`, `src/app/app/pro/[businessId]/clients/**`, `src/app/app/pro/[businessId]/prospects/**`
- Related pages: `src/app/app/pro/[businessId]/projects/**`, `src/app/app/pro/[businessId]/tasks/**`
- Agenda UI components: `src/components/pro/agenda/AgendaPage.tsx`, `src/components/pro/crm/ContactCard.tsx`
- Client detail components: `src/components/pro/clients/*`
- Navigation: `src/config/proNav.ts`
- APIs: `src/app/api/pro/businesses/[businessId]/**` (clients, prospects, interactions, projects, tasks, references)

## Route map (agenda, clients, prospects, projects, interactions)
| Route | File / component | API calls | Query params | RBAC (via API) | Outgoing links / exits |
| --- | --- | --- | --- | --- | --- |
| /app/pro/[businessId]/agenda | `src/app/app/pro/[businessId]/agenda/page.tsx` -> `AgendaPage` | GET `/clients`, GET `/prospects`, GET `/projects?archived=false` | none | VIEWER read; POST creates require ADMIN | ContactCard -> `/clients/[clientId]` or `/prospects/[prospectId]`; empty state CTA -> `/clients` or `/prospects` |
| /app/pro/[businessId]/clients | `src/app/app/pro/[businessId]/clients/page.tsx` -> `AgendaPage` (view=clients) | same as agenda | none | same | same as agenda |
| /app/pro/[businessId]/prospects | `src/app/app/pro/[businessId]/prospects/page.tsx` -> `AgendaPage` (view=prospects) | same as agenda | none | same | same as agenda |
| /app/pro/[businessId]/clients/[clientId] | `ClientDetailPage` | GET `/clients/{clientId}`; GET `/projects?clientId=...&archived=false`; PATCH `/clients/{clientId}`; GET/POST `/interactions` (clientId); GET/POST `/clients/{clientId}/documents`; GET `/accounting/client/{clientId}/summary`; POST `/payments`; PATCH `/invoices/{invoiceId}` | (client detail uses hash tabs) | GET VIEWER, PATCH/POST ADMIN | Back to `/agenda`; CTA new project -> `/projects?clientId=...`; project link -> `/projects/[projectId]` |
| /app/pro/[businessId]/prospects/[prospectId] | `ProspectDetailPage` | GET `/prospects/{prospectId}`; GET `/interactions?prospectId=...` | none | GET VIEWER | Back to `/agenda`; convert -> `/clients?from=prospect&prospectId=...` |
| /app/pro/[businessId]/projects | `ProjectsPage` | GET `/projects` via `useProjects` | clientId, archived, q | VIEWER | Project card -> `/projects/[projectId]` |
| /app/pro/[businessId]/projects/[projectId] | `ProjectWorkspace` | GET `/projects/{projectId}`, GET `/projects/{projectId}/services`, GET `/tasks?projectId=...` | tab | VIEWER read, ADMIN write | Links to `/tasks?projectId=...` |
| /app/pro/[businessId]/projects/new | `NewProjectForm` | POST `/projects` | none | ADMIN | Redirect to `/projects/[projectId]` |
| /app/pro/[businessId]/tasks | `TasksPage` | GET `/tasks`; GET `/references?type=...` | status, projectId, phase, assignee=me, categoryReferenceId, tagReferenceId | VIEWER read, ADMIN write | from project -> `?projectId=` |
| /app/pro/[businessId]/interactions | not found | n/a | n/a | n/a | n/a |

## API inventory (agenda-centric)
### Clients
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/clients` | q/search, status, sector, origin, categoryReferenceId, tagReferenceId, archived, sortBy, sortDir | `{ items: [client] }` | VIEWER; 400 invalid ids; 404 business not found |
| POST | `/api/pro/businesses/{businessId}/clients` | name (req), email?, phone?, websiteUrl?, notes?, status?, leadSource?, categoryReferenceId?, tagReferenceIds? | `{ item }` | ADMIN; 400 validation; 403 forbidden |
| GET | `/api/pro/businesses/{businessId}/clients/{clientId}` | - | `{ item }` | VIEWER; 404 client |
| PATCH | `/api/pro/businesses/{businessId}/clients/{clientId}` | name?, email?, phone?, websiteUrl?, notes?, status?, leadSource?, categoryReferenceId?, tagReferenceIds? | `{ item }` | ADMIN; 400 validation; 404 client |
| GET | `/api/pro/businesses/{businessId}/clients/{clientId}/documents` | - | `{ uploads, invoices, quotes, warning? }` | VIEWER; 404 client |
| POST | `/api/pro/businesses/{businessId}/clients/{clientId}/documents` | form-data file + title? | `{ item }` | ADMIN; 400 validation; 404 client |

### Prospects
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/prospects` | q/search, pipelineStatus, status, probabilityMin, nextActionBefore | `{ items: [prospect] }` | VIEWER; 400 invalid filters |
| POST | `/api/pro/businesses/{businessId}/prospects` | name (req), contactName?, contactEmail?, contactPhone?, pipelineStatus?, status?, probability?, nextActionDate?, notes? | `{ item }` | ADMIN; 400 validation |
| GET | `/api/pro/businesses/{businessId}/prospects/{prospectId}` | - | `prospect` | VIEWER; 404 prospect |
| PATCH | `/api/pro/businesses/{businessId}/prospects/{prospectId}` | fields for name/contact/pipeline/status/nextActionDate/etc | `prospect` | ADMIN; 400 validation |
| POST | `/api/pro/businesses/{businessId}/prospects/{prospectId}/convert` | existingClientId? or projectName? | `{ clientId, projectId }` | ADMIN; 404 prospect |

### Interactions
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/interactions` | clientId?, projectId?, type?, from?, to?, limit? | `{ items: [interaction] }` | VIEWER; 400 invalid dates |
| POST | `/api/pro/businesses/{businessId}/interactions` | type, content, happenedAt?, nextActionDate?, clientId? or projectId? | `interaction` | ADMIN; 400 validation; 404 client/project |
| PATCH | `/api/pro/businesses/{businessId}/interactions/{interactionId}` | type?, content?, happenedAt?, nextActionDate? | `interaction` | ADMIN; 404 interaction |
| DELETE | `/api/pro/businesses/{businessId}/interactions/{interactionId}` | - | `{ ok: true }` | ADMIN; 404 interaction |

### Projects (used for agenda stats + create from agenda)
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/projects` | status?, archived?, clientId?, q?, categoryReferenceId?, tagReferenceId? | `{ items: [project] }` | VIEWER |
| POST | `/api/pro/businesses/{businessId}/projects` | name (req), clientId?, status?, quoteStatus?, depositStatus?, startDate?, endDate?, categoryReferenceId?, tagReferenceIds? | `{ item }` | ADMIN |
| GET | `/api/pro/businesses/{businessId}/projects/{projectId}` | - | `{ item }` | VIEWER |
| PATCH | `/api/pro/businesses/{businessId}/projects/{projectId}` | fields | `{ item }` | ADMIN |

### Tasks (follow-ups)
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/tasks` | status?, projectId?, phase?, assignee=me?, categoryReferenceId?, tagReferenceId? | `{ items: [task] }` | VIEWER |
| POST | `/api/pro/businesses/{businessId}/tasks` | title, status?, projectId?, assigneeUserId?, dueDate?, categoryReferenceId?, tagReferenceIds? | `{ item }` | ADMIN |

### References (filters)
| Method | Path | Payload / query | Response | RBAC / errors |
| --- | --- | --- | --- | --- |
| GET | `/api/pro/businesses/{businessId}/references` | type?, search?, includeArchived? | `{ items: [reference] }` | VIEWER |
| POST | `/api/pro/businesses/{businessId}/references` | type, name, value? | `{ item }` | ADMIN |

## Current UX and exits from agenda
- Agenda list cards link to `/app/pro/[businessId]/clients/[clientId]` or `/app/pro/[businessId]/prospects/[prospectId]` via `ContactCard`.
- Empty state CTA routes to `/app/pro/[businessId]/clients` or `/app/pro/[businessId]/prospects` (same component, different route).
- Client detail page pushes to `/app/pro/[businessId]/projects?clientId=...` for new project.
- Prospect detail page pushes to `/app/pro/[businessId]/clients?from=prospect&prospectId=...` (no UI handling of these params on the clients page).
- Client/prospect detail pages link to project detail pages and to hash tabs, pulling the user away from agenda.

## Target UX: Agenda-as-hub (proposal)
- Single hub route: `/app/pro/[businessId]/agenda` with a multi-panel layout (list + detail panel + action rail).
- Detail is a drawer or right panel (client/prospect), not a full page navigation.
- Unified search and filters (status, pipeline stage, next action, tags, owner, date range).
- Interactions and tasks shown inside the detail panel, with quick add actions.
- Provide CTA for create project directly from the detail panel or list card.
- Keep deep links to client/prospect detail routes for legacy, but remove from primary nav.

## User journeys (concrete)
### P1 - Prospect -> qualification -> conversion -> project
- Preconditions: prospect exists; ADMIN role.
- Steps: Agenda list (prospects tab) -> open prospect panel -> update pipeline/status -> add interaction -> Convert -> (optional) create project.
- API: PATCH `/prospects/{id}`; POST `/interactions`; POST `/prospects/{id}/convert` (creates client + project).
- Result: prospect status WON/CLOSED, client created, project created.
- Gaps: UI uses route to `/clients?from=prospect...` instead of convert endpoint; no panel UI for pipeline update.

### P2 - Client -> create project from agenda
- Preconditions: client exists; ADMIN role.
- Steps: Agenda list (clients tab) -> open client panel -> CTA "Create project".
- API: POST `/projects` with name + clientId.
- Result: project created; show success and link.
- Gaps: no in-agenda CTA; current flow leaves agenda to projects page.

### P3 - Commercial follow-up (task + note + pipeline update)
- Preconditions: prospect or client exists; ADMIN role for write.
- Steps: Agenda detail -> add interaction; add task due date; update pipeline status.
- API: POST `/interactions`; POST `/tasks`; PATCH `/prospects/{id}`.
- Gaps: no task creation inside agenda; no pipeline UI inside agenda.

### P4 - Today/week backlog view
- Preconditions: interactions or tasks exist.
- Steps: Agenda -> filter by next action date or task due date.
- API: GET `/interactions?from=...&to=...`; GET `/tasks?status=...&assignee=me`.
- Gaps: no global agenda timeline view or task list inside agenda.

### P5 - Assign owner / collaborator
- Preconditions: membership exists; ADMIN role.
- Steps: Agenda detail -> assign task or change owner field.
- API: GET `/members`; POST/PATCH `/tasks`.
- Gaps: no owner field on client/prospect; no member list in agenda.

## Gaps and risks (prioritized)
### P0 (blocking)
- Agenda cards link out to client/prospect pages; no in-agenda detail panel (hard requirement).
- Prospect conversion button uses `/clients?from=prospect` but no UI handles these params (conversion flow broken).
- Agenda uses project amountCents for client value, but `/projects` list does not include amountCents (value shown as 0).
- Agenda create contact modal is not role-gated; VIEWER will hit ADMIN-only endpoints and see errors.

### P1 (important)
- No in-agenda pipeline editing for prospects (PATCH `/prospects/{id}` exists but no UI).
- No in-agenda interactions/task creation for prospects or clients (only available in client detail).
- No in-agenda filters for pipeline status, next action, tags, owner, or date ranges.
- Missing interactions timeline view (GET `/interactions` supports date filters, unused in agenda).

### P2 (nice-to-have)
- Dedicated interaction types (CALL/MEETING/EMAIL) not surfaced in agenda.
- No pagination for agenda lists (clients/prospects); potential perf issues with many items.
- N+1 risk for stats if extended without batching (projects + interactions + tasks).

## Create project from Agenda (spec)
- CTA placement: in client detail panel header + on client card quick actions.
- Payload: POST `/api/pro/businesses/{bizId}/projects` with `{ name, clientId }`.
- Name suggestion: default `"Project - {clientName}"` or ask user.
- Post-action UX:
  - Option A: stay in agenda, show toast with link to project.
  - Option B: open project in new tab.
- RBAC: visible but disabled for VIEWER with text "Admins only".
- Error handling: show API error inline; handle 400/403/404.

## Plan P0 / P1 / P2
- P0: add agenda detail panel (clients + prospects), replace card link with panel open; fix prospect conversion to call `/prospects/{id}/convert`; add admin gating to create actions; remove clients/prospects from nav.
- P1: add interactions + tasks creation inside agenda; pipeline/status editing; add filters; add project create CTA.
- P2: timeline view, pagination, analytics KPIs, owner assignment, batch actions.

## Tests and validation commands
- pnpm -s lint
- pnpm -s typecheck
- pnpm -s build
- Public smoke:
  - NEXT_DIST_DIR=.next-build pnpm start --hostname 0.0.0.0 --port 8080 >/tmp/next.log 2>&1 &
  - SMOKE_BASE_URL=http://127.0.0.1:8080 pnpm -s smoke:nav-surface
