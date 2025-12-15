# Repo Map

## Arborescence commentée
- `src/app/` : App Router (public + interne), pages API (`src/app/api/**`), styles globaux.  
  - `layout.tsx` (Root) ; `app/layout.tsx` (AppShell wrapper).  
  - Public : `/page.tsx`, `/login`, `/register`.  
  - Interne : `/app/**` (AppShell, AppSidebar, ThemeToggle), sous-espaces `personal`, `pro`, `performance`, `account`, `docs`.  
  - API : auth, pro (business/clients/prospects/projects/invites), personal (accounts/transactions/summary/import/bulk), health.  
- `src/components/` : UI primitives (Button/Input/Card/Badge/Modal), ThemeToggle, CsvImportModal, icons.  
- `src/lib/` : utilitaires `cn`, `money`, OpenAPI parser.  
- `src/server/` : auth (JWT, requireAuth, businessRole), db client (Prisma + pg adapter).  
- `src/generated/` : Prisma client généré.  
- `prisma/` : `schema.prisma`, migrations.  
- `public/` : assets + `openapi.yaml` (doc API).  
- Config : `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `prisma.config.ts`.

## Flux “frontend → api → services → db”
- Front (App Router) : pages client fetchent `/api/**` (no server actions). AppShell protège via middleware JWT (redirige `/login`).  
- Middleware (`src/middleware.ts`) vérifie cookie JWT → sinon 401/redirect.  
- API routes (`src/app/api/**`) : contrôle CSRF origin pour méthodes mutantes, requireAuth/verifyAuthToken, puis Prisma.  
- Services : auth service (hash bcrypt, sign/verify JWT), businessRole helper pour RBAC PRO.  
- DB : `src/server/db/client.ts` (init paresseuse PrismaPg) → Postgres (schema.prisma).

## Conventions
- Client vs Server : `use client` sur pages/comp complex (ProHomeClient, wallet pages, modals). Pages statiques sans `use client` sont server components.  
- Prisma : généré dans `src/generated/prisma` via `prisma.config.ts` (datasource DATABASE_URL), client lazy pour éviter crash build si env manquant.  
- Auth : JWT HS256, cookie HttpOnly `auth_token`, middleware protège `/app/**` et `/api/pro|personal|performance`.  
- CSRF : `assertSameOrigin` (origins via APP_ORIGINS/APP_URL/NEXT_PUBLIC_APP_URL, fail-closed prod).  
- OpenAPI : `public/openapi.yaml` alimente `/app/docs` et mappe les endpoints (incluant `/api/pro/businesses/{businessId}` maintenant présent).
