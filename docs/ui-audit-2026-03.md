# UI Audit — 2026-03 (Phase 0)

Date: 2026-03-01  
Scope: Front `app/pro` + composants UI partagés (responsive, cohérence design, dashboard)

## 1) État des lieux (arborescence UI)

### 1.1 Design system / tokens / thème
- Tokens globaux définis dans [`src/app/globals.css`](../src/app/globals.css): `--bg`, `--surface`, `--border`, `--text*`, `--accent`, `--success`, `--danger`, `--warning`, variantes `--*-bg` et `--*-border`.
- Dark mode basé sur `[data-theme="dark"]` + `.dark` dans [`src/app/globals.css`](../src/app/globals.css) et piloté par [`src/components/ThemeProvider.tsx`](../src/components/ThemeProvider.tsx), [`src/lib/theme.ts`](../src/lib/theme.ts).
- Primitives UI centralisées dans `src/components/ui` (`button`, `badge`, `alert`, `modal`, `table`, etc.).

Constats:
- Le token utilitaire Tailwind `text-muted-foreground` n’existe pas dans le codebase (0 occurrence).
- Certaines couleurs sont encore hardcodées via utilitaires Tailwind (`bg-neutral-900`, `text-white`, `text-blue-*`) au lieu des variables design.
- Plusieurs composants utilisent `var(--primary)` alors que ce token n’est pas défini dans `globals.css`.

### 1.2 Shells / headers / navigation
- Shell principal app: [`src/app/app/AppShell.tsx`](../src/app/app/AppShell.tsx) (header mobile, sidebar, nav).
- Shell pro: [`src/components/pro/ProPageShell.tsx`](../src/components/pro/ProPageShell.tsx).
- Headers actuellement en parallèle:
  - [`src/components/pro/PageHeaderPro.tsx`](../src/components/pro/PageHeaderPro.tsx)
  - [`src/app/app/components/PageHeader.tsx`](../src/app/app/components/PageHeader.tsx)
  - [`src/components/ui/page-header-pro.tsx`](../src/components/ui/page-header-pro.tsx) (doublon de naming/concept).

Constats:
- 3 patterns de header/back button coexistent (structure, typo, emplacement et style différents).
- `AppShell` a encore un focus ring hardcodé bleu (`focus-visible:outline-blue-400/60`) à [`src/app/app/AppShell.tsx:107`](../src/app/app/AppShell.tsx:107).

### 1.3 Modales / tables / charts
- Modales pro nombreuses, ex: `src/components/pro/projects/modals`, `src/components/pro/finances/modals`.
- Charts principaux:
  - [`src/components/pro/charts/CashflowChart.tsx`](../src/components/pro/charts/CashflowChart.tsx)
  - [`src/components/pro/charts/TasksDonut.tsx`](../src/components/pro/charts/TasksDonut.tsx)
- Table shared:
  - [`src/components/ui/table.tsx`](../src/components/ui/table.tsx)

Constats:
- Le wrapper `Table` est en `overflow-hidden` sans fallback `overflow-x-auto` (mobile).
- Les charts sont responsive en container mais pas adaptatifs en densité mobile (ticks/labels/legend).

## 2) Fichiers lourds / dette technique

Top fichiers front (lignes):
- `1563` [`src/components/pro/projects/ProjectWorkspace.tsx`](../src/components/pro/projects/ProjectWorkspace.tsx)
- `1239` [`src/app/app/personal/transactions/page.tsx`](../src/app/app/personal/transactions/page.tsx)
- `1007` [`src/components/pro/projects/hooks/useBillingHandlers.ts`](../src/components/pro/projects/hooks/useBillingHandlers.ts)
- `946` [`src/components/pro/projects/tabs/BillingTab.tsx`](../src/components/pro/projects/tabs/BillingTab.tsx)
- `890` [`src/components/pro/projects/modals/SetupModals.tsx`](../src/components/pro/projects/modals/SetupModals.tsx)
- `750` [`src/app/app/pro/ProHomeClient.tsx`](../src/app/app/pro/ProHomeClient.tsx)
- `733` [`src/components/pro/agenda/AgendaPage.tsx`](../src/components/pro/agenda/AgendaPage.tsx)
- `709` [`src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx`](../src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx)
- `668` [`src/app/app/pro/[businessId]/tasks/page.tsx`](../src/app/app/pro/[businessId]/tasks/page.tsx)
- `540` [`src/components/pro/finances/FinanceEntriesPanel.tsx`](../src/components/pro/finances/FinanceEntriesPanel.tsx)
- `513` [`src/components/pro/ProDashboard.tsx`](../src/components/pro/ProDashboard.tsx)

Dette principale constatée:
- Faible mutualisation des patterns de page (headers, back links, containers).
- Tables multi-colonnes sans stratégie mobile uniforme.
- KPI circulaires encore utilisés sur des vues clés (Dashboard/Projects list).

## 3) Audit responsive (pages qui cassent / causes)

## 3.1 Dashboard (priorité absolue)
Fichiers:
- [`src/components/pro/ProDashboard.tsx`](../src/components/pro/ProDashboard.tsx)
- [`src/components/pro/charts/CashflowChart.tsx`](../src/components/pro/charts/CashflowChart.tsx)
- [`src/components/pro/charts/TasksDonut.tsx`](../src/components/pro/charts/TasksDonut.tsx)

Problèmes:
- KPI circulaires fixes (`h-[120px] w-[120px]`) à [`ProDashboard.tsx:398`](../src/components/pro/ProDashboard.tsx:398) -> faible lisibilité sur petits écrans, grands nombres contraints par la forme ronde.
- CTA primaires hardcodées (`bg-neutral-900 text-white`) à [`ProDashboard.tsx:277`](../src/components/pro/ProDashboard.tsx:277), [`ProDashboard.tsx:380`](../src/components/pro/ProDashboard.tsx:380) -> cohérence/dark mode incomplète.
- Affichage de `Ref {requestId}` en UI standard à [`ProDashboard.tsx:245`](../src/components/pro/ProDashboard.tsx:245).
- Cashflow chart:
  - hauteur fixe `h-72` et `Legend` permanent à [`CashflowChart.tsx:43`](../src/components/pro/charts/CashflowChart.tsx:43), [`CashflowChart.tsx:50`](../src/components/pro/charts/CashflowChart.tsx:50)
  - couleurs hardcodées hex à [`CashflowChart.tsx:51`](../src/components/pro/charts/CashflowChart.tsx:51)
- Donut tâches:
  - labels internes + legend systématique à [`TasksDonut.tsx:17`](../src/components/pro/charts/TasksDonut.tsx:17), [`TasksDonut.tsx:23`](../src/components/pro/charts/TasksDonut.tsx:23)
  - couleurs hardcodées hex à [`TasksDonut.tsx:5`](../src/components/pro/charts/TasksDonut.tsx:5)

Cause racine:
- Le dashboard n’exploite pas les composants KPI card déjà existants (`src/components/ui/kpi-card.tsx`) et n’a pas de variante mobile-first pour les charts.

## 3.2 Tables (Finances / Services / autres)
Fichier shared:
- [`src/components/ui/table.tsx`](../src/components/ui/table.tsx)

Problème:
- Wrapper `Table` en `overflow-hidden` sans scroll horizontal à [`table.tsx:12`](../src/components/ui/table.tsx:12) -> colonnes tronquées/écrasées sur mobile.

Exemples impact:
- Finance entries 7 colonnes + actions multiples: [`FinanceEntriesPanel.tsx:331`](../src/components/pro/finances/FinanceEntriesPanel.tsx:331)
- Services table dense (colonnes cachées partiellement mais pas switch card-list): [`ServicesTable.tsx:59`](../src/components/pro/services/ServicesTable.tsx:59)
- Tabs accounting avec plusieurs panels table-based (`TreasuryPanel`, `VatPanel`, `ForecastingPanel`) sans variante mobile.

## 3.3 Tabs / navigation secondaire
Fichier:
- [`src/components/pro/TabsPills.tsx`](../src/components/pro/TabsPills.tsx)

Problème:
- Le commentaire promet “horizontal scroll on mobile”, mais implémentation en `flex-wrap` à [`TabsPills.tsx:26`](../src/components/pro/TabsPills.tsx:26).
- Sur pages à 6-7 tabs (comptabilité), wrapping non contrôlé et hauteur variable.

## 3.4 Projects list / Project workspace header / Services
Projects list:
- KPI en cercles via [`KpiCirclesBlock`](../src/components/pro/KpiCirclesBlock.tsx) utilisé à [`ProjectsPage.tsx:58`](../src/components/pro/projects/ProjectsPage.tsx:58)
- Back button custom local à [`ProjectsPage.tsx:41`](../src/components/pro/projects/ProjectsPage.tsx:41)
- CTA hardcodée neutral à [`ProjectsPage.tsx:100`](../src/components/pro/projects/ProjectsPage.tsx:100)

Project workspace header:
- Header local riche mais pattern back/actions différent des autres pages:
  - [`ProjectHeaderSection.tsx:65`](../src/components/pro/projects/ProjectHeaderSection.tsx:65)
  - `[StickyHeaderActions]` + CTA contextuelles (bon potentiel de standardisation)

Services:
- Bonne base via `ProPageShell`, mais tableau desktop-first:
  - [`services/page.tsx:74`](../src/app/app/pro/[businessId]/services/page.tsx:74)
  - [`ServicesTable.tsx:59`](../src/components/pro/services/ServicesTable.tsx:59)

## 3.5 Messaging (project team)
Fichier:
- [`src/components/pro/projects/tabs/TeamTab.tsx`](../src/components/pro/projects/tabs/TeamTab.tsx)

Problèmes:
- Hauteur fixe `600px` à [`TeamTab.tsx:189`](../src/components/pro/projects/tabs/TeamTab.tsx:189) -> rigidité sur petits écrans.
- Largeur fixe desktop list `w-[280px]` à [`TeamTab.tsx:192`](../src/components/pro/projects/tabs/TeamTab.tsx:192).
- Utilisation de `var(--primary)` non défini à [`TeamTab.tsx:218`](../src/components/pro/projects/tabs/TeamTab.tsx:218).

## 4) Incohérences UI globales

- Back button non uniforme (texte seul, bouton outline, lien inline, flèche unicode).
- Header de page non uniforme (3 composants différents + props différentes).
- Gestion erreurs/succès non uniforme:
  - parfois `Alert` partagé
  - souvent `<p className="text-[var(--danger)]">...` ad hoc
- Affichage “Ref/Req/Request ID” en production UI un peu partout (pas de mode debug visuel).
- Couleurs hardcodées encore présentes (`bg-neutral-900`, `text-blue-600`, `bg-white/40`, `hover:bg-black/5`).

## 5) Plan d’action priorisé

## P0 (immédiat) — Dashboard + fondations patterns (2-3 jours)
- Remplacer KPI cercles dashboard par `KpiStatCard` responsive (1/2 colonnes mobile, 4 desktop).
- Refondre `CashflowChart` mobile:
  - ticks réduits
  - legend compacte / masquée mobile
  - switch 12m / 3m
- Remplacer `TasksDonut` mobile par bloc “Terminé / En cours / À faire” (barres ou cards) quand largeur faible.
- Uniformiser back/header du dashboard avec le pattern shell standard.
- Masquer `Ref/Req` de l’UI standard (debug-only).

## P1 — Harmonisation globale (3-5 jours)
- Introduire composants partagés:
  - `BackButton`
  - `PageHeader` unifié (fusion `PageHeaderPro` + `PageHeader`)
  - `PageContainer`/`ProPageContainer` unique
- Corriger `TabsPills` pour vrai scroll horizontal mobile.
- Passer toutes les CTA hardcodées vers variants `Button`.
- Ajouter alias token `text-muted-foreground`.

## P2 — Mobile hardening pages cibles (4-6 jours)
- Projects list: remplacer KPI circles, stabiliser header/actions mobile.
- Project workspace header: aligner pattern header/back/actions avec design global.
- Accounting tabs (entries/payments/treasury/vat/forecasting/ledger):
  - responsive tables (`overflow-x-auto` + card-list fallback sur mobile si nécessaire)
- Services:
  - table -> mode cards sur mobile
  - cohérence feedback/erreurs.

Estimation globale mission (P0+P1+P2): 9 à 14 jours ouvrés selon niveau de refacto acceptable et budget de tests manuels.

## 6) Fichiers exacts à modifier (phase de refonte)

Fondations:
- `src/components/pro/ProPageShell.tsx`
- `src/components/pro/PageHeaderPro.tsx`
- `src/app/app/components/PageHeader.tsx`
- `src/components/ui/page-header-pro.tsx` (déprécation/suppression)
- `src/components/pro/TabsPills.tsx`
- `src/components/ui/table.tsx`
- `src/app/globals.css`

Dashboard:
- `src/components/pro/ProDashboard.tsx`
- `src/components/pro/charts/CashflowChart.tsx`
- `src/components/pro/charts/TasksDonut.tsx`
- Nouveau composant proposé: `src/components/pro/dashboard/KpiStatCard.tsx`
- Nouveau composant proposé: `src/components/pro/dashboard/DashboardSection.tsx`

Pages cibles phase 3:
- `src/components/pro/projects/ProjectsPage.tsx`
- `src/components/pro/projects/ProjectHeaderSection.tsx`
- `src/components/pro/finances/FinanceEntriesPanel.tsx`
- `src/components/pro/finances/PaymentsPanel.tsx`
- `src/components/pro/finances/TreasuryPanel.tsx`
- `src/components/pro/finances/VatPanel.tsx`
- `src/components/pro/finances/ForecastingPanel.tsx`
- `src/components/pro/finances/LedgerPanel.tsx`
- `src/app/app/pro/[businessId]/services/page.tsx`
- `src/components/pro/services/ServicesTable.tsx`

Extraction ciblée:
- `BackButton` shared.
- `DataTableResponsive` (table + mobile list fallback).
- `StatusNotice` (erreur/info/success unifié via `Alert`).
- `DebugRequestId` (visible uniquement en dev/debug toggle).

## 7) Checklist d’acceptation responsive

- Aucun overflow horizontal sur:
  - Dashboard
  - Projects list
  - Project detail (header + tabs principaux)
  - Accounting tabs
  - Services
- Dashboard mobile:
  - KPI lisibles sans cercle contraignant
  - charts lisibles sans collision labels/legend
  - CTA visibles sous le header
- Back button:
  - emplacement identique sur toutes les pages pro
  - même composant, même spacing
- Headers:
  - un pattern unique (titre, sous-titre, actions)
- Tables:
  - scroll horizontal maîtrisé ou fallback cards mobile
- Tokens:
  - pas de `bg-neutral-*`, `text-blue-*`, `text-red-*`, `bg-white/40` hors exceptions justifiées
  - `text-muted-foreground` disponible et mappé aux vars
- Request IDs:
  - invisibles en UI standard, accessibles en mode debug
- Dark mode:
  - contraste OK sur CTAs, badges, alerts, cards, charts

## 8) Go / No-go pour Phase 1

Go recommandé avec cet ordre:
1. Fondations design (`BackButton`, `PageHeader` unifié, `PageContainer`, tokens utilitaires).
2. Refonte Dashboard responsive-first.
3. Rollout sur pages cibles (Projects, Accounting, Services, Project header).

## 9) Exécution (2026-03-01)

Implémenté dans ce lot:
- Tokens design ajoutés dans `globals.css`: `--info`, `--info-bg`, `--info-border`, `--chart-accent`, `--chart-in-progress`, `--chart-done`.
- Utilitaire `text-muted-foreground` ajouté.
- `Alert` migre vers tokens CSS (plus de `rgba(...)` hardcodé).
- Charts harmonisés:
  - `PipelineBar` utilise `var(--chart-accent)`.
  - `GanttChart` utilise `var(--chart-in-progress)` et `var(--chart-done)`.
- `AppShell` focus ring migre vers `var(--focus-ring)`.
- Standardisation des largeurs:
  - `clients/[clientId]` -> `max-w-6xl`
  - `prospects/[prospectId]` -> `max-w-6xl`
  - `projects/[projectId]/edit` -> `max-w-6xl`
- Harmonisation des shells:
  - `ProjectsPage` migre vers `ProPageShell` + KPIs en cards.
  - `AgendaPage` migre vers `ProPageShell` + KPIs en cards.
- `KpiCirclesBlock` rendu refondu en layout cards responsive (API conservée).
- `TabsPills`: scroll horizontal mobile par défaut (`wrap=false`).
- `Table` shared: `overflow-x-auto` ajouté pour mobile.
- Références techniques UI (request IDs):
  - Nouveau composant `DebugRequestId` (visible uniquement hors production).
  - Adoption initiale sur panels Finance/Services.

Validations:
- `npx tsc --noEmit`: OK
- `npx eslint .`: OK
- `npm run build`: OK
