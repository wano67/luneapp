# Déploiement / CI (Railway)

- Toujours appliquer les migrations avant de démarrer l'app : `pnpm db:migrate` (alias de `prisma migrate deploy`).
- En CI/preview (Railway), utiliser une release command ou prestart : `pnpm db:migrate`.
- Ne jamais truncater/drop `_prisma_migrations` ou le schéma sur une base peuplée. Préférer `prisma migrate resolve` pour marquer une migration failed/applied.
- Le lockfile doit rester synchronisé (`pnpm install --frozen-lockfile` doit passer). Regénérer le lock en local avec `pnpm install --no-frozen-lockfile` puis re-valider avec `pnpm install --frozen-lockfile` si des dépendances changent.
- Nouvelle migration onboarding : `prisma/migrations/20251226000000_business_onboarding` (champs légaux + devise). Sur base vide : `pnpm db:migrate` suffit; sur base existante, applique cette migration avant déploiement.

## Procédure DB
- DB neuve : `pnpm db:migrate`.
- DB existante déjà provisionnée (tables User/Business présentes mais _prisma_migrations vide) :
  - Baseline init : `pnpm prisma migrate resolve --applied 20251210184638_init_schema`
  - Puis `pnpm db:migrate`.
- Migration en échec (failed) : `pnpm prisma migrate resolve --rolled-back <migration_failed>` puis éventuellement `--applied <migration_init>` et `pnpm db:migrate`.
- Inspection : `pnpm db:inspect` (affiche _prisma_migrations et tables clés). Si la DB Railway utilise un certificat self-signed, ajouter `DB_INSPECT_INSECURE_TLS=1` pour ces scripts uniquement.
- Smoke : `pnpm db:smoke` vérifie la présence de `Business.legalName`.
