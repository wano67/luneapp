# AGENDA REDUCTION PLAN (PRO)

## Goal
Make `/app/pro/[businessId]/agenda` the primary hub for clients and prospects, and reduce the number of dedicated CRM pages shown in navigation.

## Pages to reduce or demote
- Demote from nav (keep route for deep links):
  - `/app/pro/[businessId]/clients`
  - `/app/pro/[businessId]/prospects`
  - `/app/pro/[businessId]/clients/[clientId]`
  - `/app/pro/[businessId]/prospects/[prospectId]`
- Keep as core routes:
  - `/app/pro/[businessId]/agenda`
  - `/app/pro/[businessId]/projects` (support for project details, but not required for CRM tasks)
  - `/app/pro/[businessId]/tasks` (optional support for follow-ups)

## Agenda-as-hub layout proposal
- Left panel: list with tabs Clients / Prospects.
- Center or right panel: detail drawer for selected contact.
- Actions rail: create project, convert prospect, add interaction, add task.
- Filters: status, pipeline stage, next action date, tags, owner, search.

## Deep-link strategy
- Keep existing client/prospect detail routes for external links and bookmarks.
- When opened, show a banner "This view moved to Agenda" with a button to open the agenda + auto select the contact.
- Optional: add query param support to agenda, e.g. `/agenda?clientId=...` or `/agenda?prospectId=...`.

## Migration plan (progressive)
### Phase 1 (P0)
- Move primary nav entry to Agenda only; remove Clients/Prospects from nav.
- Replace ContactCard link with "open panel" behavior in Agenda.
- Fix prospect conversion to call `/prospects/{id}/convert` directly from Agenda panel.
- Add CTA "Create project" from Agenda client panel.

### Phase 2 (P1)
- Add interactions list + create from Agenda panel.
- Add tasks list + create from Agenda panel (use `/tasks`).
- Add pipeline editing + next action date from Agenda (use `/prospects/{id}` PATCH).

### Phase 3 (P2)
- Add timeline view (interactions + tasks unified).
- Add batch actions and pagination.
- Add owner assignment if data model supports it.

## Notes
- No breaking change to API; only UI navigation and wiring.
- Keep public smoke unaffected (Agenda is client-side fetch).
