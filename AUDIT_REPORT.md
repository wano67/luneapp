## Résumé exécutif (≤10 lignes)
- L’app permet un flux pro complet côté admin (prospect→convert→projet→services→start→tâches) et un wallet perso basique (comptes, transactions, summary) avec traçabilité request-id.
- Dev seed fournit un admin/owner et business démo; Turbopack en dev est instable, préférer build/start ou dev:stable avec APP_URL configuré.
- Multi-tenant et RBAC respectés en API; member reçoit 403 sur mutations, UI affiche désormais bandeau lecture seule mais plusieurs CTA restent visibles/activables.
- Nombreuses pages placeholders (process, finances*, budgets/épargne perso) créent navigation morte; nécessitent badge/redirect.
- CSRF dépend d’Origin/APP_URL: sans config, mutations renvoient 403 silencieux.
- Templates de tâches seed + start projet génèrent bien les tâches (>0) si services vendus ont des templates.
- Interactions client/projet fonctionnelles en API, UI partielle mais exploitable (lecture/ajout admin).
- Observabilité: no-store + x-request-id présents sur pro + perso critiques.
- Priorité: clarifier lecture seule, masquer placeholders, guider l’onboarding (hub + prochaines étapes projet) et documenter runbook CSRF/dev.

### MàJ 2024-12-19 (stabilité build + invitations)
- Build webpack ok en Node 20 via distDir `.next-build` (scripts `build/start`), dev isolé en `.next-dev` ; plus d’ENOENT `pages-manifest` même si un `next dev` tourne en parallèle.
- Tests exécutés : `pnpm lint`, `pnpm typecheck`, `pnpm build` (Node 20 via `npx node@20`, env `DATABASE_URL` mock, `AUTH_SECRET` défini).
- Invitations : token signé avec randomBytes + hash; baseUrl reconstruit via x-forwarded-proto/host ou APP_ORIGINS; GET renvoie désormais `inviteLink` + `tokenPreview` pour les PENDING + expiration auto. UI ajoute boutons “Copier”.
- Smoke scripts : `scripts/smoke-dev-routes.ts` (routes publiques/protégées + API dashboard/clients/invites) et `scripts/smoke-invites.ts` (création + accept + membership + second accept attendu en échec).
- Documentation : README/AUDIT_SMOKE mis à jour (Node 20, distDir séparés, commandes build/start).

### Wiring map (UI ↔ API ↔ Prisma)
| Route UI | Data source | API/SSR | Prisma models | Cache mode |
|---|---|---|---|---|
| /app/pro/[bid]/dashboard | Fetch `/api/pro/businesses/[bid]/dashboard` | route | Client, Project, Task, Interaction, Finance | no-store |
| /app/pro/[bid]/finances/payments | Fetch `/api/pro/businesses/[bid]/finances?type=INCOME&category=PAYMENT`, POST same | route | Finance | no-store |
| /app/pro/[bid]/finances | placeholder redirect | — | — | — |
| /app/pro/[bid]/finances/expenses, /vat, /treasury, /forecasting | stub/mock | — | — | — |
| /app/pro/[bid]/clients, /clients/[cid] | Fetch `/api/pro/businesses/[bid]/clients[/cid]` | route | Client, Interaction | no-store |
| /app/pro/[bid]/projects, /tasks, /prospects, /services | Fetch respective `/api/pro/businesses/...` | routes | Project, Task, Prospect, Service | no-store |
| /app/pro/[bid]/invites | Fetch `/api/pro/businesses/[bid]/invites` | route | BusinessInvite | no-store |

Orphans/stubs: finance subpages (expenses/treasury/vat/forecasting) are placeholders; invoices not wired. Payments previously mock; now uses Finance API.

### Risques principaux
- Finance: incohérence possible si d’autres pages lisent des mocks (expenses/vat). Pas de pagination/filtre serveur.
- Invites: dépend des env APP_URL/ORIGINS pour CSRF; sans config prod, mutations bloquées.
- No tests e2e automatisés hors smokes; DB-required scripts nécessitent creds/seed.

### Plan P0/P1/P2 (courant)
- P0: Payments → Finance Prisma (done). Dashboard reflète les paiements via même source. Smoke finance ajouté.
- P1: Mutualiser une fonction d’agrégation finance (income/expense/net + séries) partagée entre dashboard et finance API; ajouter pagination/filtrage par catégorie/projet.
- P2: Brancher les autres sous-pages finance (expenses/treasury/vat/forecasting) ou afficher clairement “à venir”; ajouter tags/revalidate si cache taguée un jour.

## Billing & Finance wiring (2025-01)
- Pricing actuel: ProjectService (quantity, priceCents override) + Service.defaultPriceCents; pas d’endpoint de pricing ni de total/acompte exposé. quoteStatus/depositStatus sont des champs Project mais purement manuels.
- Finance table (INCOME/EXPENSE, amountCents BigInt, category, date, projectId?, note JSON) alimente dashboard (MTD/series) et `/app/pro/[bid]/finances` + `/finances/payments` (filtre type=INCOME&category=PAYMENT). Payments UI crée des Finance avec metadata JSON (invoiceId/method/status…). Aucun lien devis/facture.
- Facturation absente: pas de modèles Quote/Invoice/Payment, pas d’API ni PDF; pages invoices/expenses stubs; treasury/vat/forecasting utilisent des mocks localStorage.
- Sécurité/conventions: requireAuthPro + requireBusinessRole (VIEWER read, ADMIN mutations), assertSameOrigin sur POST/PATCH/DELETE, jsonNoStore/withNoStore + x-request-id, BigInt sérialisés en string, rateLimit helper dispo.
- P0 attendu: pricing projet expose total/acompte/solde (30%), création devis (snapshot services) + PDF, statut SIGNED débloque facture, facture PDF, marquer facture PAID crée Finance INCOME category PAYMENT liée au projet/quote/invoice → dashboard MTD income augmente; smoke billing passe.

## Ce qui marche (perso + pro)
- Pro (admin): catalogue services + templates (CRUD/seed), pipeline prospects (création), conversion en client/projet, ajout services vendus, mise à jour devis/acompte, start projet (tâches générées), interactions client/projet, archive/unarchive, tasks globales (lecture).
- Perso: comptes/transactions/summary avec headers no-store + request-id; création compte test OK.
- Dev seed admin/owner + business/service/template/prospect de démo.

## Cassé / manquant / placeholder
- Pages placeholders: /app/personal/budgets, /epargne, /dash-finances, /dash-objectifs; pro: /process, /references/*, /finances/*, /dash-*.
- Dev serveur Turbopack génère ENOENT; nécessite build/start ou dev:stable.
- Member UX: CTA mutations encore cliquables (services/prospects/projects/clients/tasks) → 403.
- Hub /app peu guidant; aucune “next action” claire.
- Clients detail: blocs finances/projets en stub (badgés “À venir” sans action).

## Tables UI + API
Voir AUDIT_MAP.md (UI routes, API endpoints, gardes, headers, DB touchées).

## Parcours utilisateurs (observé)
- Admin: prospect → convert → projet → ajoute service → signe/paie → start → tâches (7 créées) → interactions → archive/unarchive (tous 200/201, no-store, request-id).
- Member: lecture OK, mutations renvoient 403 (ex: create service). UI montre bandeau mais CTA encore activables par endroits.
- Perso: création compte OK, headers présents; transactions non re-testées en mutation mais code conforme.

## Frictions UX (10) & Quick wins (10)
Voir AUDIT_UX.md (Jakob/Hick/Fitts/Error prevention/progressive disclosure).

## Backlog priorisé
- P0: documenter CSRF/APP_URL, badger/redirect placeholders, désactiver CTA pour member avant 403.
- P1: onboarding “next step” sur /app, feedback start/archiver/CSRF, read-only UX sur services/prospects/projects/clients/tasks, badges stub clients detail.
- P2: pagination listes, toasts request-id, perf dev doc, interactions filtres/date/type, wallet refresh UX.

## Runbook (repro)
```
lsof -ti tcp:3000 | xargs -r kill -9
rm -rf .next
pnpm install
pnpm prisma generate
ENABLE_DEV_SEED=1 pnpm seed:dev
APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 pnpm start --port 3000
```
- Login admin (cookies /tmp/cookies.txt) puis exécuter les cURL de AUDIT_SMOKE.md pour valider flux pro + perso + 403 member.
