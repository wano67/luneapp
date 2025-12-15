# API Audit

## Inventaire /api/**
- Auth:  
  - `POST /api/auth/register|login|logout` (CSRF Origin check, cookies HttpOnly, JSON body).  
  - `GET /api/auth/me` (no-store, cookie JWT).  
- Health: `GET /api/health` (ping DB).  
- Personal (wallet):  
  - `GET/POST /api/personal/accounts` (auth, CSRF POST, no-store GET).  
  - `GET /api/personal/accounts/[accountId]` (auth, no-store).  
  - `GET/POST /api/personal/transactions` (auth, CSRF POST, cursor pagination, filters account/type/from/to/q, limit capped 200).  
  - `PATCH/DELETE /api/personal/transactions/[transactionId]` (auth, CSRF).  
  - `POST /api/personal/transactions/bulk-delete` (auth, CSRF).  
  - `POST /api/personal/transactions/import` (auth, CSRF, multipart, limit 2MB, max 5000 lignes, preview dryRun, crée catégories manquantes).  
  - `GET /api/personal/summary` (auth, no-store).  
- Pro:  
  - `GET/POST /api/pro/businesses` (auth, CSRF POST, list memberships).  
  - `GET /api/pro/businesses/[businessId]` (auth, role VIEWER, no-store).  
  - Clients: `GET` (VIEWER), `POST` (ADMIN) `/api/pro/businesses/[businessId]/clients`.  
  - Prospects: `GET` (VIEWER, search/status), `POST` (ADMIN) `/api/pro/businesses/[businessId]/prospects`; `GET` (VIEWER), `PATCH/DELETE` (ADMIN) `/prospects/[prospectId]`.  
  - Projects: `GET` (VIEWER, status filter), `POST` (ADMIN) `/projects`.  
  - Invites: `GET` (ADMIN) `/invites`, `POST` (ADMIN) `/invites` (return inviteLink optional, no token leak), `DELETE` (ADMIN) `/invites/[inviteId]`, `POST /invites/accept` (auth, CSRF).  

## Auth / CSRF / Cache
- Auth via cookie `auth_token` (JWT). Middleware protège `/api/pro|personal|performance`.  
- CSRF Origin: appliqué à toutes mutations (POST/PATCH/DELETE) via `assertSameOrigin`; origins configurables par `APP_ORIGINS` (CSV) ou APP_URL/NEXT_PUBLIC_APP_URL; fail-closed en prod si non configuré, refuse mutations sans Origin/Referer.  
- Cache: no-store via `withNoStore/jsonNoStore` sur endpoints sensibles (me, lists, summary, business, invites). Health/landing non.  

## Pagination / limites
- Personal transactions: limit max 200, cursor (date,id). Summary/Accounts non paginés mais bornés par comptes.  
- Pro lists (clients/prospects/projects) : **pas de pagination** (risque P1).  

## Validation / statuts
- Payloads renvoient `{error}` 4xx/5xx, 401 Unauthorized, 403 Forbidden, 404 Not found.  
- Transactions import: errors array (<=25), preview (<=10).  
- Auth register: P2002 -> 409. Login invalid -> 401.  

## Écarts / manques
- Lint Next supprimé => script basculé sur eslint (lint échoue pour nombreux `any` et règles purity).  
- Pro lists sans limit ni tri complexe; pas de rate-limit global.  
- OpenAPI : spec couvre endpoints présents; veille à mettre à jour si ajout pagination PRO.  

## Checklist corrections
- Ajouter pagination/limit sur clients/prospects/projects (P1).  
- Harmoniser payloads d’erreur avec codes constants; ajouter `Cache-Control: no-store` partout données sensibles (déjà fait principales).  
- Introduire rate limiting sur auth/invites/pro/personal (P0 sécurité).  
- Corriger lint (remplacer `any`, purity issues) ou ajuster règles/overrides ciblés.  
