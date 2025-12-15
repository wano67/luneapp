# DX / Qualité

## Scripts & outils
- `pnpm typecheck` ✔, `pnpm build` ✔.  
- `pnpm lint` → échoue (eslint .) : nombreuses erreurs `any`, unused vars, règles React purity (`AppShell`, `CsvImportModal`, `ThemeToggle`). Lint Next n’existe plus; script ajusté à `eslint .`.  
- Tests : aucun script `test`. CI non configurée.

## Conventions TS/ESLint
- TS strict true mais `allowJs`, `skipLibCheck`. Beaucoup de `any` dans API et pages client.  
- ESLint config Next core-web-vitals; erreur purity sur `performance.now` et setState in effects.  
- Généré : `src/generated/prisma` (ne pas éditer), `prisma.config.ts` pour datasource.

## Quick wins (P0)
- Corriger script lint (fait) et supprimer erreurs bloquantes : typer payloads (`any`), déplacer appels `performance.now`/setState hors render/effects ou désactiver règle ciblée. DoD: `pnpm lint` vert.  
- Ajouter script `test` minimal (ex: `vitest` ou `next test` experimental) ou documenter absence.  
- CI suggestion : pipeline `pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm build`.  
- Réduire duplication : créer types partagés pour API payloads (transactions/accounts/pro) et utiliser helpers de validation légers.  
- Documenter que Next 16 n’a plus `next lint`; utiliser `eslint .`.

## Plan de tests minimal
- Unit: helpers (`money`, CSV parser) + requireAuth/CSRF.  
- API e2e (supertest ou Playwright): auth login/register/logout, personal transactions CRUD/import, PRO RBAC (VIEWER vs ADMIN) et invites.  
- Accessibilité: axe/lighthouse sur `/`, `/login`, `/app/personal`, `/app/personal/transactions`.  
