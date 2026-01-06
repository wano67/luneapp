Pages likely unused
- `/app/performance/alignement`, `/app/performance/perso`, `/app/performance/pro` — referenced_by_count=0 in AUDIT/ROUTES_PAGES.csv, no Links/router.push usages found; likely legacy performance prototype. Confidence: high.
- `/app/personal/admin`, `/app/personal/dash-finances`, `/app/personal/dash-objectifs`, `/app/personal/revenus` — referenced_by_count=0 in AUDIT/ROUTES_PAGES.csv; no navigation strings in `src/components` or `src/app/app/AppSidebar.tsx`. Confidence: high.
- `/app/pro/[businessId]/dash-*` (entreprise/projets/finances/admin-process) and `/app/pro/[businessId]/admin/*` — all have referenced_by_count=0 in AUDIT/ROUTES_PAGES.csv; absent from sidebar sections in `src/app/app/AppSidebar.tsx`. Confidence: high.
- `/app/pro/[businessId]/references/*` (automations/categories/numbering/tags) — referenced_by_count=0; not linked from settings nav. Confidence: medium (could be deep-linked externally).

API routes likely unused
- `/api/dev/seed` — referenced_by_count=0 (AUDIT/ROUTES_PAGES.csv); only guarded by env flags, no in-repo callers. Confidence: high.
- `/api/health` — referenced_by_count=0; typically called by infra probes, no in-repo usage. Confidence: low (may be external).
- `/api/pro/businesses/[businessId]/clients/[clientId]/documents/upload`, `/api/pro/businesses/[businessId]/clients/bulk`, `/api/pro/businesses/[businessId]/projects/[projectId]/archive|unarchive` — referenced_by_count=0; no fetch calls in `src` (search via ROUTES_PAGES scan). Confidence: medium.

Legacy / placeholder candidates
- `src/app/app/pro/pro-data.ts` (664 lines) feeds mock finance/permissions data used by multiple dashboards; likely legacy demo data inflating bundles.
- `src/pages/__placeholder__.tsx` flagged by ts-prune as unused; seems leftover from pages-router era.
- Multiple dash/stock/marketing variants under `/app/pro/[businessId]` with zero references indicate legacy navigation; consider archiving behind feature flag or removing once confirmed.

Dependency/exports audit
- `pnpm dlx depcheck`: reports `@prisma/client` and tailwind packages as unused (likely false positives due to Prisma client generation). Review before removal.
- `pnpm dlx ts-prune -p tsconfig.json`: flags unused exports including `src/app/robots.ts`, `src/app/sitemap.ts`, UI helpers (`src/components/ui/modal.tsx:235 ModalFooterSticky`, `src/components/ui/empty-state.tsx`), and placeholder icons (`src/components/icons.tsx:208 IconSettings`). Many generated Prisma browser types also unused; safe to ignore or adjust ts-prune config.
