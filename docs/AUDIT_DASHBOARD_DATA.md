## Endpoints utiles (Pro)

- `/api/pro/businesses/:businessId/dashboard` (GET)  
  - RBAC: requireAuthPro + requireBusinessRole VIEWER  
  - Headers: no-store + x-request-id  
  - Données : kpis (projectsActiveCount, projectsCompletedCount, openTasksCount, mtdIncome/Expense/Net), monthFinance (amount/period), latestTasks (id, title, status, dueDate, project), nextActions.interactions (type, nextActionDate, clientId, projectId), monthlySeries (month, incomeCents, expenseCents). Périodes: MTD + 12 mois glissants, horizon 7 jours pour tâches/interactions.

- `/api/pro/businesses/:businessId/finances` (GET, POST)  
  - RBAC: VIEWER read, ADMIN write; CSRF mutations; no-store + x-request-id  
  - Params: type=INCOME|EXPENSE, projectId, periodStart/periodEnd (ISO), aggregate=1 for totals.  
  - Données : items {id, type, amountCents, category, date, projectName, createdAt}; aggregate renvoie incomeCents/expenseCents/netCents. Temporal: date (any), createdAt.

- `/api/pro/businesses/:businessId/projects` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Données : status, quoteStatus, depositStatus, startedAt, archivedAt, counts/tasksSummary possible. Temporal: createdAt, start/end dates.

- `/api/pro/businesses/:businessId/tasks` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Filters: status, projectId, assigneeUserId; Temporal: dueDate, createdAt, completedAt. Useful pour “tâches en retard”, répartition par statut.

- `/api/pro/businesses/:businessId/prospects` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Données : pipelineStatus, status, probability, nextActionDate, createdAt.

- `/api/pro/businesses/:businessId/clients` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Données : createdAt pour clients récents.

- `/api/pro/businesses/:businessId/interactions` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Filters: clientId, projectId, type, from, to, limit; Temporal: happenedAt, nextActionDate, createdAt. Useful pour “next actions”.

- `/api/pro/businesses/:businessId/services` (GET)  
  - RBAC: VIEWER read; no-store + x-request-id  
  - Données : templateCount, createdAt. (moins critique pour dashboard)

## Schéma Prisma pertinent (résumé)
- Finance: {businessId, projectId?, type INCOME/EXPENSE, amountCents: BigInt, category: String, date: DateTime, note, createdAt, updatedAt}
- Project: {businessId, status, quoteStatus, depositStatus, startedAt, archivedAt, startDate, endDate, createdAt, updatedAt}
- Task: {businessId, projectId?, status, phase, progress, dueDate?, completedAt?, createdAt, updatedAt}
- Prospect: {businessId, pipelineStatus, status, probability, nextActionDate?, createdAt, updatedAt}
- Client: {businessId, createdAt, updatedAt}
- Interaction: {businessId, clientId?, projectId?, type, happenedAt, nextActionDate?, createdAt}

## Données temporelles disponibles
- Finances.date (agrégations par jour/semaine/mois), createdAt
- Tasks.dueDate, createdAt, completedAt (retard = dueDate < now & status != DONE)
- Projects.startedAt, archivedAt, startDate/endDate (actifs/completés)
- Prospects.nextActionDate, createdAt
- Interactions.nextActionDate, happenedAt, createdAt
- Clients.createdAt (récents)

## Métriques exploitables immédiatement
- Revenus / Dépenses / Net: `/finances?aggregate=1&periodStart=X&periodEnd=Y`
- Cash flow trend: `/finances?periodStart=X&periodEnd=Y` (séries par date)
- Projets actifs/complets: `/dashboard` (projectsActiveCount, projectsCompletedCount) ou `/projects?status=ACTIVE/COMPLETED`
- Tâches par statut: `/tasks?status=...` ou filtrage client-side; “retard” via dueDate < now.
- Prospects par pipeline: `/prospects` regroupement client-side.
- Clients récents: `/clients?` tri desc createdAt.
- Next actions: `/dashboard` horizon 7j interactions + `/tasks` horizon 7j dueDate.

## Gaps / Limitations
- Pas d’endpoint agrégé pour tâches par statut ni retard: devra être agrégé côté frontend (filtrage) ou créer `/tasks/stats`.
- Prospects/clients endpoints sans pagination ni champs comptés → agrégation front.
- Finances: pas de breakdown par catégorie direct; possible via groupBy côté backend si besoin d’un endpoint `/finances/summary?group=category`.
- Dashboard endpoint couvre 12 mois glissants mais uniquement MTD pour finances; pour custom ranges, utiliser `/finances`.

## RBAC
- VIEWER: lecture sur tous les endpoints listés (dashboard/finances GET/etc.).
- ADMIN/OWNER: mutations (POST finances, POST projects/services/prospects…). Dashboard lecture seule donc compatible member/viewer.
