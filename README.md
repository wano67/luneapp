# Lune App

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Prisma 7 (PostgreSQL via adapter-pg).  
Public front: `/`, `/login`, `/register`  
App interne (protégée) : `/app/**`.
Dev : `pnpm dev` (webpack, Turbopack désactivé par défaut pour la stabilité).

## Railway deploy checklist
- Gestionnaire : pnpm (lock `pnpm-lock.yaml`, `packageManager` déclaré, `.npmrc` désactive `package-lock`). Utiliser `pnpm install --frozen-lockfile`.
- Env prod obligatoires : `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `APP_ORIGINS` (origins supplémentaires, séparées par des virgules).
- Build : `pnpm install --frozen-lockfile && pnpm build` (postinstall `prisma generate` ne requiert pas la DB).
- Start : `pnpm start`.
- Sécurité : si `APP_URL`/`NEXT_PUBLIC_APP_URL`/`APP_ORIGINS` manquent en prod, toutes les mutations seront refusées (CSRF fail-closed).

### Node version requise
- Utiliser Node 20.x (ex. `20.11.1`). Un `.nvmrc` est fourni.  
- Commandes nvm : `nvm use` ou `nvm install 20.11.1`  
- engines (package.json) : `>=20 <23` (Node 24 provoquait des ENOENT manifests avec Next 16).

### Dossiers `.next` dédiés (stabilité dev/build)
- Les scripts `dev/dev:stable` écrivent dans `.next-dev` (env `NEXT_DIST_DIR`), `build/start` dans `.next-build`.  
- `pnpm clean` respecte `NEXT_DIST_DIR` (par défaut `.next`). Pour un build prod : `NEXT_DIST_DIR=.next-build pnpm clean && NEXT_DIST_DIR=.next-build pnpm build`.  
- Évite les courses entre un serveur dev actif et un build en cours (plus de `pages-manifest` manquant). Ne supprime pas `.next-dev` pendant que `pnpm dev` tourne.

### Railway – Variables d’environnement requises
- `APP_URL` : origin primaire côté serveur (https, sans slash final), ex. `https://luneapp.up.railway.app` ou domaine custom `https://app.mondomaine.com`.
- `NEXT_PUBLIC_APP_URL` : origin attendue côté client (généralement identique à `APP_URL`), même format.
- `APP_ORIGINS` : liste optionnelle d’origins supplémentaires, séparées par des virgules, pour supporter un domaine custom + le sous-domaine Railway, ex. `https://app.mondomaine.com,https://luneapp.up.railway.app`.
- Comportement : en production, si aucune origin n’est fournie, la protection CSRF bloque toutes les mutations. En dev, l’absence d’origins n’est pas bloquante.
- Ne pas inclure de slash final ni de chemins ; uniquement les origins (`scheme://host[:port]`).

### Vérifs middleware (dev)
- Sans cookie : GET `/app` → redirige vers `/login?from=/app`
- Sans cookie : GET `/api/pro/businesses` → 401 JSON + `Cache-Control: no-store`
- Avec cookie valide : les routes protégées passent

### Vérifs auth (manuel)
- Token avec `isActive=false` → GET `/api/auth/me` doit 401 JSON + `x-request-id` + `Cache-Control: no-store`
- Token dont `sub` pointe vers un user supprimé → GET `/api/auth/me` doit 401 JSON + `x-request-id` + `Cache-Control: no-store`

## Dépendances clés
- Prisma client généré dans `src/generated/prisma`
- Adapter PostgreSQL `@prisma/adapter-pg`
- Authentification : JWT (cookie HttpOnly `auth_token`) + bcryptjs

## Variables d’environnement
- `DATABASE_URL` : URL PostgreSQL (Railway)
- `AUTH_SECRET` : clé secrète utilisée pour signer les JWT

## Setup
```bash
pnpm install
# Générer le client Prisma (utilise prisma.config.ts)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB" pnpm prisma generate

# Lancer le projet (dev webpack, distDir .next-dev)
pnpm dev
# Build prod isolé (distDir .next-build)
NEXT_DIST_DIR=.next-build pnpm build
```

### Smokes rapides
- `pnpm smoke:dev-routes` (BASE_URL, TEST_EMAIL/PASSWORD facultatifs) pour vérifier les pages principales.
- `pnpm smoke:wiring` (TEST_EMAIL/PASSWORD requis) pour l’API de base.
- `pnpm smoke:invites` (ADMIN_EMAIL/PASSWORD + INVITEE_EMAIL/PASSWORD) pour tester le flux d’invitation.

## Prisma & migrations
- Schéma : `prisma/schema.prisma` (datasource alimentée par `prisma.config.ts`)
- Migrations : `prisma/migrations`
- Exemple de commande (create-only si la DB n’est pas accessible) :
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB" npx prisma migrate dev --name add_auth_fields --create-only
```

## Endpoints principaux
- `GET /api/health` : ping DB
- `POST /api/auth/register` : crée un utilisateur, émet le cookie `auth_token`
- `POST /api/auth/login` : authentifie et émet le cookie
- `POST /api/auth/logout` : supprime le cookie

Spéc OpenAPI : `openapi.yaml` (bases health + auth).

## Front
- `/` : landing publique (CTA vers login/register/app)
- `/login`, `/register` : formulaires publics
- `/app/**` : app interne (PRO / PERSO / PERFORMANCE) protégée par middleware JWT.
