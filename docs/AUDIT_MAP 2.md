## UI Routes

| Route | Espace | Rôle requis | Statut | CTA principal | Dépendances API |
|---|---|---|---|---|---|
| / | Public | Aucun | OK | Découvrir | — |
| /login | Public/Auth | Aucun | OK | Login | /api/auth/login |
| /register | Public/Auth | Aucun | Partiel (simple form) | Créer compte | /api/auth/register |
| /app | App hub | Auth | Partiel (orientation) | Aller Perso/Pro | /api/auth/me |
| /app/pro | Pro hub | Auth | OK (dev bloc) | Créer/joindre entreprise | /api/pro/businesses |
| /app/pro/businesses | Pro | Auth | OK | Ouvrir entreprise | /api/pro/businesses |
| /app/pro/[businessId] | Pro | Auth | Partiel (banner) | Aller dashboards | /api/pro/businesses/[id] |
| /app/pro/[businessId]/services | Pro | VIEWER+ | OK (templates UI) | Créer service (admin) | /api/pro/businesses/[id]/services, /templates |
| /app/pro/[businessId]/prospects | Pro | VIEWER+ | OK | Ajouter prospect (admin) | /api/pro/businesses/[id]/prospects |
| /app/pro/[businessId]/prospects/[prospectId] | Pro | VIEWER+ | Partiel (convert gated) | Convertir (admin) | /api/pro/businesses/[id]/prospects/[pid], /convert |
| /app/pro/[businessId]/projects | Pro | VIEWER+ | Partiel (create gated) | Nouveau projet (admin) | /api/pro/businesses/[id]/projects |
| /app/pro/[businessId]/projects/[projectId] | Pro | VIEWER+ | OK (archive/start UI) | Démarrer projet (admin) | /api/pro/businesses/[id]/projects/[pid], /start, /services, /tasks, /interactions |
| /app/pro/[businessId]/tasks | Pro | VIEWER+ | Partiel (CRUD gated) | Nouvelle tâche (admin) | /api/pro/businesses/[id]/tasks |
| /app/pro/[businessId]/clients | Pro | VIEWER+ | Partiel (create gated) | Ajouter client (admin) | /api/pro/businesses/[id]/clients |
| /app/pro/[businessId]/clients/[clientId] | Pro | VIEWER+ | Partiel (stubs) | Ajouter interaction (admin) | /api/pro/businesses/[id]/clients/[cid], /interactions |
| /app/personal/comptes | Perso | Auth | OK | Ajouter compte | /api/personal/accounts |
| /app/personal/transactions | Perso | Auth | OK | Ajouter transaction | /api/personal/transactions |
| /app/personal/summary | Perso | Auth | OK (via dash) | — | /api/personal/summary |
| /app/personal/budgets, /epargne, /dash-finances, /dash-objectifs | Perso | Auth | Placeholder | CTA redir vers comptes/transactions | — |
| /app/pro/*/process, references, finances/*, dash-* | Pro | Auth | Placeholder | Liens “à venir” | — |

## API Routes (principales)

| Endpoint | Méthodes | Auth/RBAC | CSRF | No-store + x-request-id | Rate limit | Tables Prisma | Notes |
|---|---|---|---|---|---|---|---|
| /api/auth/login | POST | public | AssertSameOrigin | oui | oui | User | ok |
| /api/auth/me | GET | requireAuthAsync | n/a | oui | non | User | ok |
| /api/dev/seed | POST | env guard | n/a | oui | non | User/Business/Service/Prospect | Dev-only |
| /api/pro/businesses | GET/POST | requireAuthPro, POST=ADMIN | POST CSRF | oui | yes (POST) | Business/BusinessMembership | ok |
| /api/pro/businesses/[bid]/services | GET (VIEWER) POST (ADMIN) | CSRF mutations | oui | yes | Service/ServiceTaskTemplate | ok |
| /api/pro/businesses/[bid]/services/[sid]/templates | GET (VIEWER) POST/PATCH/DELETE (ADMIN) | CSRF mutations | oui | yes | ServiceTaskTemplate | ok |
| /api/pro/businesses/[bid]/services/[sid]/templates/seed | POST (ADMIN) | CSRF | oui | yes | ServiceTaskTemplate | idempotent |
| /api/pro/businesses/[bid]/prospects | GET (VIEWER) POST (ADMIN) | CSRF mutations | oui | yes | Prospect | ok |
| /api/pro/businesses/[bid]/prospects/[pid] | GET (VIEWER) PATCH (ADMIN) | CSRF mutations | oui | yes | Prospect | ok |
| /api/pro/businesses/[bid]/prospects/[pid]/convert | POST (ADMIN) | CSRF | oui | yes | Client/Project/Prospect | ok |
| /api/pro/businesses/[bid]/projects | GET (VIEWER) POST (ADMIN) | CSRF mutations | oui | yes | Project | ok |
| /api/pro/businesses/[bid]/projects/[pid] | GET (VIEWER) PATCH (ADMIN) DELETE (ADMIN) | CSRF mutations | oui | yes | Project | ok |
| /api/pro/businesses/[bid]/projects/[pid]/services | POST/PATCH/DELETE (ADMIN) | CSRF | oui | yes | ProjectService | ok |
| /api/pro/businesses/[bid]/projects/[pid]/start | POST (ADMIN) | CSRF | oui | yes | Project/Task | Idempotent-ish (skips existing tasks) |
| /api/pro/businesses/[bid]/projects/[pid]/archive, /unarchive | POST (ADMIN) | CSRF | oui | yes | Project | ok |
| /api/pro/businesses/[bid]/interactions | GET (VIEWER) POST (ADMIN) | CSRF mutations | oui | yes | Interaction | Filters clientId/projectId/type/from/to/limit |
| /api/pro/businesses/[bid]/interactions/[iid] | PATCH/DELETE (ADMIN) | CSRF | oui | yes | Interaction | ok |
| /api/pro/businesses/[bid]/tasks | GET (VIEWER) POST (ADMIN) | CSRF mutations | oui | yes | Task | ok |
| /api/pro/businesses/[bid]/tasks/[tid] | GET (VIEWER) PATCH/DELETE (ADMIN) | CSRF | oui | yes | Task | ok |
| /api/pro/businesses/invites/accept | POST | public | CSRF | oui | yes | BusinessInvite/Membership | ok |
| /api/personal/accounts | GET/POST | requireAuthAsync | CSRF POST | oui | yes | PersonalAccount/PersonalTransaction | ok |
| /api/personal/transactions | GET/POST | requireAuthAsync | CSRF POST | oui | yes | PersonalTransaction | ok |
| /api/personal/summary | GET | requireAuthAsync | n/a | oui | no | PersonalAccount/PersonalTransaction | ok |

