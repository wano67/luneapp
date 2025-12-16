# Architecture (réalité du code)

## App Router / UI
- Entrée publique: `/`, `/login`, `/register`.
- Espace connecté: `/app/**` rendu par `src/app/app/layout.tsx` + `AppShell` (sidebar, mobile menu, scroll-lock).
- Espaces fonctionnels:
  - PRO: `src/app/app/pro/**` (hub `/app/pro`, cockpit `/app/pro/[businessId]`, modules clients/prospects/projects/tasks/services/process/finances/invites, settings, admin, references).
  - Personal (wallet): `src/app/app/personal/**` (comptes, transactions…).
  - Performance: `src/app/app/performance/**` (stubs).
- Legacy dashboards `/app/pro/[businessId]/dash-*` existent mais redirigent vers les routes canoniques.

### AppShell
- `src/app/app/AppShell.tsx`: dock + mobile pull-down; sidebar via `AppSidebar`.
- `AppSidebar`: sections globales/perso/pro/performance. En mode PRO: navigation canonique (pilotage, settings, finances, admin, references) + bouton “Changer d’entreprise”.

### PRO business layout
- `src/app/app/pro/[businessId]/layout.tsx` (client): fetch `/api/pro/businesses/[id]` pour le nom, wrap `ActiveBusinessProvider`, affiche `ActiveBusinessBanner` et monte `SwitchBusinessModal`. Pas de double fetch liste.

### Data fetching patterns
- Client-side fetch via `src/lib/apiClient.ts` (credentials include, safeJson, requestId extraction).
- AbortController utilisé dans la majorité des pages PRO.
- LocalStorage: `activeProBusinessId`/`lastProBusinessId` gérés par `ActiveBusinessProvider` et `ProHomeClient`.

## API layer
- App Router handlers dans `src/app/api/**`.
- Auth via middleware (`src/middleware.ts`) qui protège `/app/**` et `/api/(pro|personal|performance)/**` en vérifiant le cookie JWT.
- PRO helpers: `requireAuthPro`, `requireBusinessRole` (role-based), CSRF `assertSameOrigin` sur mutateurs, `rateLimit`, `jsonNoStore/withNoStore`, `withRequestId/getRequestId`.
- Personal APIs similaires avec requireAuth + CSRF + rateLimit.
- Prisma client: `src/server/db/client`, BigInt sérialisé en string dans toutes les routes pro/personal.

## Sécurité / flux
```
Client -> middleware (auth cookie) -> route handler
         -> CSRF (mutations) -> rateLimit -> Prisma -> JSON
         -> headers: x-request-id (erreurs), Cache-Control: no-store souvent
```
- 401 -> redirect login (pages) ou JSON 401 (API). `from` conservé.
- CSRF stricte en prod: nécessite APP_URL/NEXT_PUBLIC_APP_URL/APP_ORIGINS pour autoriser les origines mutantes.

## Design system
- Tokens CSS dans `src/app/globals.css`.
- UI atoms: `Card`, `Button` (asChild support), `Input`, `Badge`, `Modal` (focus/escape, scroll-lock), `AppShell` layout.

## Routes UI (principales)
- `/app/pro`: hub (ProHomeClient) liste/CTA create/join/switch; pas de provider global.
- `/app/pro/[businessId]`: cockpit, quick links; rôle optionnel.
- `/app/pro/[businessId]/clients`, `/prospects`, `/projects`, `/tasks`, `/services`, `/process`, `/finances`, `/invites`, `/settings/*`, `/finances/*`, `/admin/*`, `/references/*`: stubs ou pages réelles (clients/prospects/projects list/detail réels).
- `/app/pro/businesses`: alias hub; `/app/pro/businesses/[id]` -> redirect.
- Personal: `/app/personal` (summary), `/comptes`, `/transactions`, etc.

## Routes API (résumé)
- PRO:
  - `/api/pro/businesses` GET (membres) / POST (create business, CSRF+rateLimit).
  - `/api/pro/businesses/[id]` GET business detail (VIEWER+jsonNoStore).
  - Clients: GET/POST list, GET detail.
  - Projects: GET/POST list, GET detail.
  - Prospects: GET list, POST create, GET/PATCH/DELETE detail.
  - Invites: GET/POST list (admin, CSRF, rateLimit), DELETE invite, POST /invites/accept.
  - All guarded by `requireAuthPro` + `requireBusinessRole` + CSRF on mutators, with request-id on errors.
- Personal: accounts/transactions/summary/categories with CSRF+rateLimit, `requireAuth` equivalents.
- Auth: `/api/auth/login|register|logout|me`, CSRF on login/register, rate-limit on login/register.

## Slugs / conventions
- Canonical EN slugs: `projects`, `tasks`, `process`, `services`, `finances`, `settings`, `admin`, `references`.
- No FR slugs (`/projets`, `/taches`). Legacy `/dash-*` paths redirected.
