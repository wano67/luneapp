## Commandes exécutées (port 3000)

```
lsof -ti tcp:3000 | xargs -r kill -9
rm -rf .next-dev .next-build
pnpm install
pnpm prisma generate
ENABLE_DEV_SEED=1 pnpm seed:dev
APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 NEXT_DIST_DIR=.next-build pnpm build
APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 NEXT_DIST_DIR=.next-build pnpm start --port 3000
```

## Sessions
- Admin: `admin@local.test / admintest` -> cookies `/tmp/cookies.txt`
- Member: `test@test.fr / testtest` -> cookies `/tmp/cookies-member.txt`

## Pro — Workflow complet (admin)
1) Login: POST /api/auth/login → 200, no-store, x-request-id `da1d7bd3-faae-4d9e-94a4-5fe5af4f0fbb`
2) Service create: POST /api/pro/businesses/8/services → 201, `c1253325-bb1b-4d9a-bd5b-9ad6481ea21d`
3) Seed templates: POST /api/pro/businesses/8/services/5/templates/seed → 200, `8df27928-d285-42d5-8823-f34ac9a29c90`
4) Prospect create: POST /api/pro/businesses/8/prospects → 201, `a9481794-0422-4be4-9c0d-3e17a12f75e2`
5) Convert: POST /api/pro/businesses/8/prospects/5/convert → 200, `50d61a4c-fc56-4c37-9174-8e682d8fab71` (clientId=5, projectId=4)
6) Add service to project: POST /api/pro/businesses/8/projects/4/services → 201, `58792124-af1e-4086-89c4-79ea543b2a44`
7) Quote/deposit PATCH: 200, `7bd4ba1b-a030-443a-81f0-b1388b3aee42`
8) Start project: POST /start → 200, `abec3645-c67a-43e2-984f-b04627e8653b`, `tasksCreated=7`
9) GET tasks?projectId=4 → 200, 7 tasks listed

Headers: toutes les réponses ci-dessus comportent `cache-control: no-store` et `x-request-id`.

## Interactions (admin)
- POST client interaction → 201 `823cf139-292d-4a6c-9f09-81b0aa97e423`
- POST project interaction → 201 `05d8ba6d-7fbf-4da8-a08d-3bf3ff6b0c16`
- GET project interactions → 200 (1 item)

## Archive
- POST /projects/4/archive → 200 `c8447dfc-d932-474d-a58d-fcc30f8f62ca`
- POST /projects/4/unarchive → 200 `1e513ecc-bb4d-4b1d-9fd5-2266228c83b1`

## Perso (admin)
- POST /api/personal/accounts → 201 `59782db0-9754-4f03-aeca-dae68ed996d5`
- Transactions/summary non testés en mutation (API ok en lecture).

## RBAC Member
- Login member: POST /api/auth/login → 200 `76c69543-53ed-4071-8364-91cbc64c30a7`
- POST /api/pro/businesses/8/services → 403 `565e6586-7bcb-416b-9fef-3573e73bb969` (no-store + request-id). UI comporte bandeau + CTA désactivés.

## Observations
- Start projet idempotent côté tâches (skip doublons).
- Toutes mutations testées respectent CSRF (Origin fourni) et no-store + request-id.
- Dev server doit être lancé avec APP_URL/NEXT_PUBLIC_APP_URL pour éviter 403 CSRF. Turbopack en dev posait des ENOENT; lancer en `pnpm start` (build) ou dev stable résout.

## Smokes disponibles
- `pnpm smoke:dev-routes`
- `pnpm smoke:wiring`
- `pnpm smoke:invites`
- `pnpm smoke:finance` (BASE_URL + TEST_EMAIL/TEST_PASSWORD) : crée un paiement (Finance INCOME catégorie PAYMENT) et vérifie que le dashboard MTD income augmente.
- `pnpm smoke:billing` (BASE_URL + TEST_EMAIL/TEST_PASSWORD) : pricing projet > devis (PDF) > facture (PDF) > paiement → MTD income dashboard doit augmenter.
