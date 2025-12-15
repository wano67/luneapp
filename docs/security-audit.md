# Security Audit

## Auth
- JWT HS256 (`src/server/auth/jwt.ts`), claims: sub (userId string), email, role, isActive, exp default 7d; issuer/audience `luneapp`. Cookie HttpOnly `auth_token`, SameSite Lax, Secure en prod.  
- Logout supprime cookie (maxAge 0). `/api/auth/me` vérifie token + user actif, no-store.  
- Middleware (`src/middleware.ts`) protège `/app/**` et `/api/pro|personal|performance`, redirect login avec `from` query; logs error on verify failure.

## RBAC PRO
- Helper `requireBusinessRole` OWNER>ADMIN>MEMBER>VIEWER (`src/server/auth/businessRole.ts`).  
- Rôles min :  
  - Businesses list/create: GET member, POST ADMIN+.  
  - Business details: GET VIEWER+.  
  - Clients: GET VIEWER+, POST ADMIN+.  
  - Prospects: GET VIEWER+, POST/PATCH/DELETE ADMIN+.  
  - Projects: GET VIEWER+, POST ADMIN+.  
  - Invites: GET/POST/DELETE ADMIN+, Accept: authenticated user.  

## CSRF / Origin
- `assertSameOrigin` check sur toutes mutations (auth/pro/personal). Origins via APP_ORIGINS/APP_URL/NEXT_PUBLIC_APP_URL; en prod, absence d’origins => forbid; absence d’Origin header => forbid. Cache-control no-store appliqué aux endpoints sensibles via `jsonNoStore/withNoStore`.

## Exposition / fuites
- Invites : token non renvoyé (uniquement `inviteLink` facultatif côté POST).  
- Logs : quelques console.error dans API, aucun PII direct.  
- Rate-limit/bruteforce : inexistant sur login/register/invites (P0 recommandé).  
- Lint/test : `pnpm lint` échoue (nombreux `any`, purity), à traiter pour CI.  

## Recommendations (P0/P1)
- P0  
  - Configurer `APP_ORIGINS`/APP_URL en prod pour CSRF (fail-closed sinon).  
  - Ajouter rate limiting (auth, invites, personal/pro mutations) et verrou bruteforce login. DoD: middleware rate-limit avec quotas par IP + tests 429.  
  - Ajouter check `auth_token` secure flag en prod (déjà conditionnel) et rotation optional.  
- P1  
  - Rendre middleware moins bavard en console côté prod (log level).  
  - Ajouter audit logs pour actions PRO sensibles (invites, créations).  
  - Mettre en place tests e2e sur auth/CSRF et RBAC (VIEWER vs ADMIN).  

Definition of Done (P0)  
- CSRF origins configurés et testés (curl Origin mismatch → 403).  
- Rate limiting en place avec réponse 429 et métriques.  
- Lint bloquants corrigés ou rules ajustées, CI lint/typecheck/build verts.  
