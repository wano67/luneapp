# Front – Architecture (Next.js App Router)

## Tableau des routes

| Route | Layout | Composants clés | Data (chargement) | Client/Server |
| --- | --- | --- | --- | --- |
| `/` | `src/app/layout.tsx` | `PublicLandingPage` (`src/app/page.tsx`), `Button`, `Card` | Aucune donnée distante | Server Component |
| `/login` | `src/app/layout.tsx` | `LoginForm` (`use client`), `Input`, `Button` | `fetch POST /api/auth/login` depuis le client | Client Component |
| `/register` | `src/app/layout.tsx` | Formulaire inline (`use client`), `Input`, `Button` | `fetch POST /api/auth/register` depuis le client | Client Component |
| `/app` | `src/app/layout.tsx` → `src/app/app/layout.tsx` → `AppShell` | AppShell + AppSidebar (dock, nav, ThemeToggle) | Pas de data | Server page, Shell client |
| `/app/docs` | Root layout + AppShell | `ApiDocsPage`, `buildEndpointGroups` (lit `public/openapi.yaml`) | Lecture FS OpenAPI côté serveur | Server Component (runtime node) |
| `/app/account` | Root layout + AppShell | Page statique | Aucune | Client page (`use client`) |
| `/app/performance` | Root layout + AppShell | Texte statique | Aucune | Server |
| `/app/performance/pro` `/app/performance/perso` `/app/performance/alignement` | idem | Pages statiques placeholder | Aucune | Server |
| `/app/personal` | Root layout + AppShell | `WalletHomePage` (`use client`), `Card`, liens | `fetch GET /api/personal/summary` (redirect 401 vers /login) | Client |
| `/app/personal/transactions` | Root layout + AppShell | Page `use client` longue : filtres, liste, modales (Modal, Input, Button, Card) | `fetch /api/personal/accounts`, `fetch /api/personal/transactions`, POST/PATCH/DELETE sur `/api/personal/transactions` et `/bulk-delete`; modale add/edit en client | Client |
| `/app/personal/comptes` | Root layout + AppShell | `use client`, liste comptes, modales (Modal, CsvImportModal) | `fetch /api/personal/accounts`, POST /api/personal/accounts, POST /api/personal/transactions/import | Client |
| `/app/personal/comptes/[accountId]` | Root layout + AppShell | `use client`, détail compte + dernières transactions | `fetch /api/personal/accounts/{id}` et `/api/personal/transactions?accountId=...` | Client |
| `/app/personal/budgets` `/app/personal/revenus` `/app/personal/epargne` `/app/personal/dash-finances` `/app/personal/dash-objectifs` `/app/personal/admin` | Root layout + AppShell | Pages statiques placeholder | Aucune | Server |
| `/app/pro` | Root layout + AppShell | `ProPage` (server) + `ProHomeClient` (`use client`) | `fetch /api/auth/me`, `fetch /api/pro/businesses`, POST create, POST invite accept | Client |
| `/app/pro/[businessId]` | Root layout + AppShell | Page server statique (dashboard placeholder) | Aucune | Server (params async) |
| `/app/pro/[businessId]/clients` `/prospects` `/projets` `/services` `/taches` `/finances` `/process` `/dash-*` | Root layout + AppShell | Pages server statiques placeholder (titres/texte) | Aucune | Server |
| `/app/icon.svg` | asset | — | — | — |

## Arbre de layout / shell
- `src/app/layout.tsx` (RootLayout) : charge fonts Inter/JetBrains Mono, applique `globals.css`, `html lang="fr"` et `suppressHydrationWarning`.  
- `src/app/app/layout.tsx` : wrap des pages internes avec `AppShell`.  
- `AppShell` (`use client`) : header fixe, dock latéral, mobile pull-down menu, calcule espace actif (`usePathname`), gère animations (hover dock, pointer events mobile), inclut `AppSidebar`, `ThemeToggle`, navigation principale.  
- `AppSidebar` (`use client`) : construit sections selon l’espace (pro/perso/performance/global), applique classes actives, collapsed state pour dock/mobile.  
- Thème : variables CSS dans `globals.css` appliquées via `data-theme` sur `html`; `ThemeToggle` lit/sauvegarde `localStorage`, applique `data-theme` (light/dark).  
- Navigation clavier : Header/dock utilisent principalement click/pointer; pas de focus management spécifique (liens natifs ok, menus custom sans pièges clavier).  
- Animations/gestures : AppShell mobile menu utilise pointer events (drag/pull-down), dock hover delay; transitions CSS (scale/opacity) limitées.  

Data loading patterns  
- Pages publiques : formulaires client `fetch` vers API auth.  
- Pages internes data-driven : PERSO (wallet summary, transactions, comptes) et PRO (ProHomeClient) chargent via `fetch` côté client les routes `/api/**` (no server actions/SSR).  
- Pages placeholder PRO/PERFORMANCE/BUDGETS etc. : statiques, pas de data.  
- API docs : lit `public/openapi.yaml` côté serveur (fs) au render.  

États UI  
- Transactions/comptes : états loading/error/empty explicites, pagination par curseur, toasts via messages inline, confirmations via `window.confirm`.  
- ProHomeClient : loading/error/empty (pas de suspense côté data après montage).  
- Autres pages : pas d’états secondaires (contenu statique).  
