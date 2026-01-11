# PRODUCT SPEC - Lune TPE OS

## Vision
Build a single, reliable workspace for TPE owners to manage CRM, projects, quotes/invoices, and simplified accounting without jumping between tools. The product must make it obvious where to read vs where to act, and avoid duplicate sources of truth.

## Principles
- One source of truth per object (no duplicate edit surfaces).
- Clear navigation: lists for overview, detail pages for edits.
- Pricing chain is deterministic (catalog -> project service -> quote -> invoice).
- RBAC strict: VIEWER read-only, ADMIN write.

## Personas and jobs
- Persona A: TPE owner (ADMIN)
  - Job: know who owes what, when to follow up, and what will be collected.
- Persona B: collaborator (VIEWER/ADMIN)
  - Job: execute tasks, update client/prospect status, keep project info current.

## Modules and canonical routes
### CRM
- Canonical pages:
  - /app/pro/[businessId]/clients (list + filters)
  - /app/pro/[businessId]/clients/[clientId] (full edit)
  - /app/pro/[businessId]/prospects (list + filters)
  - /app/pro/[businessId]/prospects/[prospectId] (full edit + conversion)
  - /app/pro/[businessId]/agenda (follow-up list, no full edit)
- Rule: editing is only on dedicated detail pages.

### Catalog
- Services with defaultPriceCents/tjmCents used for pricing.
- Routes:
  - /app/pro/[businessId]/catalog
  - /app/pro/[businessId]/catalog/services/[serviceId]

### Projects and tasks
- Project owns services (ProjectService) and tasks.
- Routes:
  - /app/pro/[businessId]/projects
  - /app/pro/[businessId]/projects/new
  - /app/pro/[businessId]/projects/[projectId]
  - /app/pro/[businessId]/tasks

### Billing (quotes/invoices)
- Quote is derived from project pricing and frozen.
- Invoice is derived from quote items.
- Client page shows Facturation summary (read-only P0).

### Accounting (simplified)
- Journal driven by invoices and payments.
- Focus on: issued, paid, outstanding, due dates.

### Messaging (internal)
- Desired: project/client threads with attachments.
- Current: not implemented.

### Calendar
- Desired: unified calendar for tasks, interactions, invoice due dates.
- Current: agenda is a follow-up list, no calendar UI.

## Critical P0 flows
1) Quote from project
- Service has price in catalog.
- Add service to project -> ProjectService.priceCents defaults to catalog.
- Pricing computes items and totals.
- Quote creation uses pricing; block if missing price.
- Quote PDF available.

2) Invoice from quote
- Invoice copies quote items and totals.
- No recompute from project/services.
- Invoice PDF available.

3) Client Facturation
- Client page shows summary + quotes + invoices.
- Totals match invoice/quote data.

4) CRM follow-up
- Prospect pipeline + next action.
- Conversion to client + project.
- Agenda shows follow-up list (no edit).

## Non-functional requirements
- Prices are cents integers everywhere.
- No silent default to 0 for quotes/invoices.
- Clear error messages for missing price.
- Read-only surfaces never trigger writes.
- Pagination/limits on lists to avoid heavy pages.

## Out of scope for P0
- VAT enhancements, exports, reconciliation.
- Messaging threads and notifications.
- Full calendar UI.
