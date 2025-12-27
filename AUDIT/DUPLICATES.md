# Duplicate / Divergent Utilities
- **Currency formatting split**  
  - `src/lib/formatCurrency.ts:1-10` exports `formatCurrencyEUR` (EUR-only, cents).  
  - `src/app/app/pro/pro-data.ts:639-644` exports a separate `formatCurrency` (generic currency, uses Intl).  
  - Impact: duplicated logic inflates bundles and risks inconsistent formatting between Pro and shared components.  
  - Fix: centralize in `src/lib/formatCurrency.ts` with currency parameter; import everywhere (dashboards, finance panels).

- **API client helpers reimplemented locally**  
  - Shared helpers exist in `src/lib/apiClient.ts:1-92` (`safeJson`, `isApiErrorShape`, `getErrorMessage`, `fetchJson`).  
  - Personal transactions page duplicates similar helpers inline (`src/app/app/personal/transactions/page.tsx:14-63`).  
  - Impact: diverging error handling/redirect logic, larger bundles.  
  - Fix: refactor personal pages to reuse `fetchJson`/helpers from `src/lib/apiClient.ts`.
