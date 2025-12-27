# Audit Summary
- Builds/tests: `pnpm -s lint`, `pnpm -s typecheck`, `NEXT_DISABLE_TURBOPACK=1 pnpm -s build` all ✅ (see `AUDIT/BUILD_STATUS.md` and `AUDIT/COMMAND_LOG.txt`).
- Architecture: App Router with `(marketing)` public group and authenticated `/app` shell. Pro workspace under `/app/pro/[businessId]/**` (sidebar/layout in `src/app/app/pro/[businessId]/layout.tsx`), Personal finance under `/app/personal/**`. APIs live in `src/app/api/**` with helpers for request-id/no-store.
- User journeys: Marketing landing → register/login; App shell to account/profile/security; business picker then Pro dashboards (clients, finances, projects, tasks, settings). Personal wallet flows (accounts/transactions/import) use `/api/personal/*`.
- Security posture: Strong baseline (requireAuthPro + requireBusinessRole + CSRF + rate limits) on most Pro/Personal mutations; SSRF protections on logo/favicon; uploads scoped by businessId + MIME/size. Gaps: dev seed endpoint unauthenticated/CSRF-less, auth/me/health/rate-limit gaps.
- Data integrity gap: Client “Secteur” editable in UI but ignored by API PATCH, leading to silent data loss (`ClientInfoTab.tsx:44-95` vs `clients/[clientId]/route.ts:239-315`).
- Dead/legacy surface: 27 zero-reference pages (dash-*, performance, personal variants) and 6 zero-reference APIs (dev seed, bulk/archives, health). Mock data file `src/app/app/pro/pro-data.ts` (664 LOC) still bundled into dashboards.

# Architecture Overview
- Layouts: `src/app/layout.tsx` (root), `(marketing)/layout.tsx` (public), `src/app/app/layout.tsx` (authenticated), `src/app/app/pro/[businessId]/layout.tsx` (business context + sidebar).
- Routing map: see `AUDIT/ROUTES_PAGES.csv` and human summary in `AUDIT/APP_MAP.md`.
- UI system: CSS variables in `src/app/globals.css`; primitives in `src/components/ui/*` (button, card, input, select, modal, table, kpi-card, section-header); App shell/navigation in `src/app/app/AppShell.tsx` + `AppSidebar.tsx`.
- Data: Prisma models in `prisma/schema.prisma`; ownership enforced via businessId scoping across Pro APIs; file storage in `src/server/storage/local.ts`.

# Top Security Risks (evidence)
1. Dev seed endpoint unauthenticated/CSRF-less (P1) — `src/app/api/dev/seed/route.ts:6-24`; anyone can trigger seeding when `ENABLE_DEV_SEED=1`.
2. auth/me lacks rate limiting (P2) — `src/app/api/auth/me/route.ts:1-70`; repeated probing possible.
3. Health check unauthenticated (P2) — `src/app/api/health/route.ts:1-14`; may expose DB availability externally.
4. Placeholder route exposed (P2 UX/security surface) — `src/pages/__placeholder__.tsx:1-3`; blank page accessible.
5. Client sector edits dropped (integrity) — UI sends field `ClientInfoTab.tsx:44-95`, API ignores `clients/[clientId]/route.ts:239-315`.
6. Missing rate limit on dev seed (same as #1) — no `rateLimit` call in `dev/seed`.
7. Some GETs without input validation (minor) — e.g., `/api/auth/me` accepts any cookie; mitigated by JWT verify.
8. auth/me CSRF not required (GET) but no no-store headers — minor cache risk.
9. Health endpoint lacks no-store (uses withNoStore OK) but could leak latency; low severity.
10. Legacy dashboards still routable if linked (surface expansion) — multiple zero-reference pages in `AUDIT/ORPHANS.md`.

# Top Technical Debt
1. Oversized pages/components: `src/app/app/pro/[businessId]/services/page.tsx` (1477 LOC), `src/app/app/personal/transactions/page.tsx` (1256 LOC), `src/app/app/pro/ProHomeClient.tsx` (789 LOC), `src/app/api/pro/businesses/[businessId]/tasks/[taskId]/route.ts` (514 LOC).
2. Mock data leakage: `src/app/app/pro/pro-data.ts` (664 LOC) shipped to dashboards.
3. Duplicate helpers: currency formatting split (`src/lib/formatCurrency.ts:1-10` vs `src/app/app/pro/pro-data.ts:639-644`), API helpers reimplemented in personal transactions page (`src/app/app/personal/transactions/page.tsx:14-63`).
4. Legacy zero-reference pages bloat bundles (list in `AUDIT/ORPHANS.md` and `AUDIT/ORPHANS_PAGES.json`).
5. Client sector field mismatch between UI/API (data loss risk).
6. Sidebar/nav config hard-coded in `src/app/app/AppSidebar.tsx` (480 LOC), hindering reuse/tests.
7. Personal pages use custom fetch/error handling instead of `lib/apiClient` (inconsistent UX).
8. Missing design system primitives (PageShell/PageHeader) causing layout drift between Personal/Pro.
9. Large API handlers mixing validation/business logic (e.g., finances/tasks) hard to unit test.
10. ts-prune/depcheck flagged unused exports/deps; cleanup pending (`AUDIT/ORPHANS.md`).

# Orphans (summary)
- Pages with zero references (27): `/app/performance/*`, `/app/personal/admin|dash-*|revenus`, `/app/pro/[businessId]/dash-*`, `/app/pro/[businessId]/references/*`, `/app/pro/[businessId]/settings/billing`, etc. Full list: `AUDIT/ORPHANS_PAGES.json`.
- APIs with zero references (6): `/api/dev/seed`, `/api/health`, `/api/pro/businesses/[businessId]/clients/[clientId]/documents/upload`, `/api/pro/businesses/[businessId]/clients/bulk`, `/api/pro/businesses/[businessId]/projects/[projectId]/archive|unarchive`. See `AUDIT/ORPHANS_API.json`.

# Action Plan
- **P0**: None blocking found.
- **P1**
  - Lock down `/api/dev/seed`: require auth+CSRF and restrict to `NODE_ENV === 'development'` (`src/app/api/dev/seed/route.ts`).
  - Persist `sector` field in client PATCH (`src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts`) to match UI.
  - Decide fate of zero-reference pages/APIs; remove or feature-flag to reduce surface (see orphans files).
- **P2**
  - Refactor oversized pages/APIs into composables/hooks; split data fetching from UI (services page, personal transactions, tasks API).
  - Consolidate currency/API helpers into shared libs; drop mock data (`src/app/app/pro/pro-data.ts`).
  - Introduce shared PageShell/PageHeader and reuse UI primitives across Personal + Pro (see `AUDIT/DESIGN_SYSTEM_PLAN.md`).
  - Clean unused exports/deps from ts-prune/depcheck and remove `/src/pages/__placeholder__.tsx`.
