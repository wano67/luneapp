# Code Quality Notes
- **Oversized, mixed concerns**: `src/app/app/pro/[businessId]/services/page.tsx` (~1477 LOC) mixes data mocks, UI, and client logic; `src/app/app/personal/transactions/page.tsx` (~1256 LOC) bundles filters, CSV import, and tables; `src/app/app/pro/ProHomeClient.tsx` (789 LOC) contains both mock data and layout. These should be split into data hooks + presentational components to reduce bundle size and ease testing.
- **Mock/legacy data leakage**: `src/app/app/pro/pro-data.ts` (664 LOC) exports mock finance/permission datasets and helper `formatCurrency` used by dashboards, inflating bundles and diverging from live APIs.
- **Duplicate helpers**: `src/lib/formatCurrency.ts` (formatCurrencyEUR) and `src/app/app/pro/pro-data.ts:97` (formatCurrency) implement overlapping currency formatting; centralize in `src/lib/formatCurrency.ts` and reuse.
- **Inconsistent UI/API contract**: Client info UI sends `sector` updates (`src/components/pro/clients/ClientInfoTab.tsx:44-95`), but the PATCH route ignores `sector` entirely (`src/app/api/pro/businesses/[businessId]/clients/[clientId]/route.ts:239-315`), leading to silent drops.
- **Complex UI shells**: `src/app/app/AppSidebar.tsx` (480 LOC) embeds navigation data + filtering logic; consider extracting config to data files to simplify updates and enable testing.
- **Static dashboards likely stale**: Pages under `/app/pro/[businessId]/dash-*`, `/app/performance/*`, and personal finance dashboards are zero-referenced (see AUDIT/ROUTES_PAGES.csv) yet still ship large UI/layout code, increasing build size with no user path.

# Performance / DB Hygiene
- Most Pro APIs enforce business-scoped queries (`where: { id, businessId }`); no obvious N+1 inside loops found.
- Several list endpoints fetch up to 50–200 records without pagination UI (e.g., `/api/pro/businesses/[businessId]/interactions` takes `limit` query but UI uses default 50; `/api/pro/businesses/[businessId]/payments` takes 50). Monitor for payload growth; consider cursor-based pagination.
- CSV import (`src/app/api/personal/transactions/import/route.ts`, 453 LOC) processes rows in memory; size limit enforced via `assertSameOrigin` + file parsing, but consider streaming for large files.
