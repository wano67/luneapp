# Lune App

Next.js 16 (App Router) + TypeScript + Tailwind v4 + Prisma 7 (PostgreSQL via adapter-pg).  
Public front: `/`, `/login`, `/register`  
App interne (protégée) : `/app/**`.
Dev : `pnpm dev` (Turbopack) ou `pnpm dev:stable` (désactive Turbopack en cas de souci).

## Dépendances clés
- Prisma client généré dans `src/generated/prisma`
- Adapter PostgreSQL `@prisma/adapter-pg`
- Authentification : JWT (cookie HttpOnly `auth_token`) + bcryptjs

## Variables d’environnement
- `DATABASE_URL` : URL PostgreSQL (Railway)
- `AUTH_SECRET` : clé secrète utilisée pour signer les JWT

## Setup
```bash
npm install
# Générer le client Prisma (utilise prisma.config.ts)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB" npx prisma generate

# Lancer le projet
npm run dev
```

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
