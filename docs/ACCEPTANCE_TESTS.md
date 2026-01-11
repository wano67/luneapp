# ACCEPTANCE TESTS (P0)

## Automated checks
- pnpm -s lint
- pnpm -s typecheck
- pnpm -s build

## Smoke scripts (if creds available)
- pnpm -s smoke:billing
- pnpm -s accounting:smoke

## Manual QA checklist
1) Catalog service has defaultPriceCents or tjmCents.
2) Add service to project without priceCents -> ProjectService price defaults to catalog.
3) Project pricing total equals quantity * unit price.
4) Create quote -> items match pricing and totals match.
5) Create invoice from quote -> items match quote and totals match.
6) Client Facturation shows quotes/invoices and totals are consistent with invoices.
7) Prospect conversion creates client + project (if endpoint configured).
8) Agenda list remains read-only (no full edit surface).
