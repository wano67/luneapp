# Dashboard PRO — Maquette (texte)

## Entête principal
- Titre : Tableau de bord
- Sous-titre : Vue synthétique de l’activité business et de la production
- Context: business name + rôle (badge ADMIN/VIEWER) + sélecteur de période (par défaut 30 jours glissants)
- CTA : Export CSV/PDF (lecture seule ok), Filtrer par période

## Section 1 — KPIs principaux (cartes)
- Revenus (période) — source: `GET /finances?aggregate=1&periodStart&periodEnd&type=INCOME` (ou dashboard mtdIncomeCents)
- Dépenses (période) — même endpoint type=EXPENSE
- Solde net (période) — dérivé (income-expense)
- Projets actifs — source: `/dashboard` (projectsActiveCount)
- Tâches ouvertes — source: `/dashboard` (openTasksCount)
- Prochains points (7j) — source: `/dashboard.nextActions.interactions.length`
Format: valeur, variation vs période précédente (calcul front si double requête), badge tendance.

## Section 2 — Graphiques tendance
- 📈 Cash Flow 12 mois (line, multi-axe)  
  - Data: `/dashboard.monthlySeries` (incomeCents, expenseCents) ou `/finances?periodStart&periodEnd` regroupé front.  
  - Axes: mois (x), montant € (y); séries “Revenus”, “Dépenses”, “Net (area)”.
- 📊 Tâches par statut (donut)  
  - Data: `/tasks?status=...` (agrégation front) ou `/dashboard.openTasksCount` + extra fetch tasks.  
  - Statuts: TODO, IN_PROGRESS, DONE.
- 📉 Tâches en retard (bar)  
  - Data: `/tasks?status!=DONE&dueDate<now` filtrage front.  
  - Barre unique avec count + lien “Voir toutes les tâches en retard”.
- 📈 Pipeline prospects (bar stack)  
  - Data: `/prospects` group by pipelineStatus.

## Section 3 — Tables prioritaires
- Projets actifs (table)  
  - Colonnes: Nom, Statut, Progression (tasksSummary if available), Dates (start/end), Montant (optionnel via finances/projectId), Actions: Voir projet.  
  - Source: `/projects?status=ACTIVE` (read-only pour viewer).
- Clients récents (table)  
  - Colonnes: Nom, Email, Date création.  
  - Source: `/clients` tri desc createdAt.
- Next Actions (interactions)  
  - Colonnes: Type, Date, Cible (client/projet), Lien vers fiche.  
  - Source: `/dashboard.nextActions.interactions`.
- Tâches à venir (7j)  
  - Colonnes: Titre, Projet, DueDate, Statut.  
  - Source: `/dashboard.latestTasks`.

## Section 4 — Alertes & Actions
- Alertes:  
  - Devis non signés (projects where quoteStatus != SIGNED/ACCEPTED)  
  - Acompte non payé (depositStatus != PAID/NOT_REQUIRED)  
  - Tâches en retard (count)  
  - Interactions à planifier (none in next 7j)  
  - Finances: revenus < dépenses sur la période sélectionnée
- CTA:  
  - “Voir le pipeline” → /prospects  
  - “Ouvrir services” → /services  
  - “Accéder aux tâches” → /tasks

## Data mapping (résumé)
- Revenus/Dépenses/Net: `GET /api/pro/businesses/:bid/finances?aggregate=1&periodStart=ISO&periodEnd=ISO` (fallback /dashboard monthFinance for MTD)
- Cash flow 12 mois: `/dashboard.monthlySeries`
- Projets actifs/complets: `/dashboard` (projectsActiveCount/projectsCompletedCount) ou `/projects?status=...`
- Tâches statut/retard: `/tasks` filtré
- Prospects pipeline: `/prospects`
- Clients récents: `/clients` tri createdAt
- Next actions: `/dashboard.nextActions.interactions` + `/dashboard.latestTasks`

## Visualisations proposées
- KPI cards avec sparkline (7j) si disponible (finances by day)
- Line chart (revenus vs dépenses, zone net)
- Donut chart (tasks par statut)
- Bar chart (prospects par pipeline)
- Mini list “Next actions” (interactions + tasks)

## RBAC UX
- Viewer/Member: lecture seule, CTA mutations désactivées, badge “Lecture seule”.
- Admin/Owner: CTA actifs (créer projet/service/interaction).
