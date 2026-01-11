# BUSINESS HUB AUDIT (Client Billing)

## A. Existing client financial data (current code)
- Quotes and invoices: `GET /api/pro/businesses/{businessId}/clients/{clientId}/documents`
  - Returns last 10 quotes + last 10 invoices with `number`, `status`, `totalCents`, `issuedAt`, `currency`, `pdfUrl`.
- Client accounting summary: `GET /api/pro/businesses/{businessId}/accounting/client/{clientId}/summary`
  - Returns totals `{ invoicedCents, paidCents, outstandingCents }` (last 12 months, non-cancelled invoices).
  - Includes last 10 invoices and a derived `payments` list (paid invoices only).
- Payments (derived from paid invoices): `GET /api/pro/businesses/{businessId}/payments?clientId=...`
  - Returns paid invoices as payment items (no separate payment model).
- Projects context: `GET /api/pro/businesses/{businessId}/projects?clientId=...`
  - Useful for context; amounts are not always present in list payloads.

## B. Available endpoints from client context
| Endpoint | Method | Role | Status |
| --- | --- | --- | --- |
| `/api/pro/businesses/{businessId}/clients/{clientId}` | GET | VIEWER | usable |
| `/api/pro/businesses/{businessId}/clients/{clientId}/documents` | GET | VIEWER | usable |
| `/api/pro/businesses/{businessId}/accounting/client/{clientId}/summary` | GET | VIEWER | usable |
| `/api/pro/businesses/{businessId}/payments?clientId=...` | GET | VIEWER | usable (derived) |
| `/api/pro/businesses/{businessId}/quotes/{quoteId}/pdf` | GET | VIEWER | usable |
| `/api/pro/businesses/{businessId}/invoices/{invoiceId}/pdf` | GET | VIEWER | usable |
| `/api/pro/businesses/{businessId}/projects?clientId=...` | GET | VIEWER | usable (context only) |

## C. Minimum viable financial picture (P0)
- Total quoted: sum of `quotes[].totalCents` from `clients/{clientId}/documents` (latest 10 quotes).
- Total invoiced: `summary.totals.invoicedCents` (last 12 months, non-cancelled).
- Total paid: `summary.totals.paidCents` (paid invoices only).
- Outstanding: `summary.totals.outstandingCents` (computed from invoiced - paid).

Limitations to surface:
- Quotes list is limited to 10 items.
- Invoiced/paid totals are limited to 12 months.
- No multi-currency conversion in UI (displayed as raw EUR cents in current app).

## D. Non-goals for this phase
- No accounting exports (CSV, FEC, etc.).
- No VAT/tax logic or reconciliation.
- No invoice/quote edits or status changes.
- No payment capture or partial payment flows.
- No cross-client aggregation.
