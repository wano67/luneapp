## Audit navigation PRO

- Routes PRO détectées (`src/app/app/pro/**` principales) :  
  - Dashboard : `/app/pro/[businessId]` (+ pages dash-entreprise/dash-finances/dash-projets mais route canon reste le dashboard)  
  - Opérations : `/projects`, `/agenda`, `/tasks`, `/process`  
  - Catalogue & Stock : `/catalog`, `/stock`  
  - Finances : `/finances`  
  - CRM : `/prospects`, `/clients`  
  - Administration : `/organization`, `/settings`, `/references`, `/admin`  
  - Autres surfaces existantes : marketing, invites, accounting, services, etc. (non ajoutées en nav principale selon IA demandée)

- Sidebar actuelle (avant refactor) : menu défini dans `src/app/app/AppSidebar.tsx` (sections hardcodées). Navigation globale gérée par `AppShell`.

- Surfaces tabulaires déjà existantes : Finances (tabs internes), Settings (tabs internes), References (tabs internes), donc un seul item de sidebar suffit.

- Pas de route “Calendrier” distincte → utilisation de l’existante `/agenda`.

## Décisions IA appliquées
- Source de vérité de la nav PRO : `src/config/proNav.ts`.
- Groupes :
  - Pilotage : Dashboard  
  - Opérations : Projets, Agenda, Tâches, Process  
  - Catalogue & Stock : Catalogue, Stock  
  - Finances : Finances  
  - CRM (secondaire) : Prospects, Clients  
  - Administration (secondaire) : Organisation, Paramètres, Référentiels, Admin
- Active state : détection par regex `startsWith` sur les routes correspondantes (projets détail, dashboards dérivés, etc.).
- Quick actions (AppShell) corrigées : Projets/Finances + “Nouveau projet” pointent sur des routes existantes.
