# Security Findings
- **P1 – Dev seed endpoint lacks auth/CSRF guard**  
  - Evidence: `src/app/api/dev/seed/route.ts:6-24` performs POST seeding based only on environment flags; no `requireAuth`/`assertSameOrigin`/rate limiting. If `ENABLE_DEV_SEED=1` is set in staging/prod, anyone can trigger DB mutations.  
  - Fix: Restrict to `NODE_ENV === 'development'`, require authenticated admin + CSRF, or remove from deployed builds.

- **P2 – Client sector edits dropped silently (data integrity)**  
  - Evidence: UI sends `sector` in PATCH body (`src/components/pro/clients/ClientInfoTab.tsx:44-95`), but server handler never reads/writes `sector` (`src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts:239-315`). Users think changes saved while data remains unchanged.  
  - Fix: Add validation + persistence for `sector` on PATCH or remove the field from the UI.

- **P2 – Placeholder page still exposed**  
  - Evidence: `src/pages/__placeholder__.tsx:1-3` renders an empty page; Next build surfaces `/__placeholder__` route. Dead pages expand attack surface and confuse crawlers.  
  - Fix: Remove the legacy pages-router file or gate it behind auth/redirect.
