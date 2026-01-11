# ACCOUNTING CHAIN AUDIT (P0)

## A) Data model mapping (files)
- Service (catalog): `prisma/schema.prisma` model `Service`
  - `defaultPriceCents`, `tjmCents`, `vatRate`, `type`, `name`, `code`.
- ProjectService: `prisma/schema.prisma` model `ProjectService`
  - `priceCents`, `quantity`, `notes`, links to `Service` and `Project`.
- Quote / QuoteItem: `prisma/schema.prisma` models `Quote`, `QuoteItem`
  - `Quote.totalCents`, `depositCents`, `balanceCents` and `QuoteItem.unitPriceCents`, `quantity`, `totalCents`.
- Invoice / InvoiceItem: `prisma/schema.prisma` models `Invoice`, `InvoiceItem`
  - mirrors quote item pricing fields.
- Pricing computation: `src/server/services/pricing.ts` (`computeProjectPricing`).

## B) Source-of-truth decisions (explicit)
- Catalog (Service): default price originates from `Service.defaultPriceCents`, fallback to `Service.tjmCents`.
- ProjectService: if `priceCents` is set, it is the authoritative unit price for pricing.
- Pricing (project): uses ProjectService `priceCents` when present, else catalog fallback.
- Quote creation: must use pricing output (items + totals) as the source of truth.
- Invoice creation: must copy quote items and totals, no recompute from project/services.
- Missing price policy: if no ProjectService price and no catalog default/tjm, pricing defaults to 0 and quote creation is blocked with a clear error.

## C) API path map (client -> project -> quote -> invoice)
- POST `/api/pro/businesses/{businessId}/projects/{projectId}/services`
  - creates ProjectService, defaults unit price from catalog when missing.
- GET `/api/pro/businesses/{businessId}/projects/{projectId}/pricing`
  - uses `computeProjectPricing` (ProjectService quantity * unit price).
- POST `/api/pro/businesses/{businessId}/projects/{projectId}/quotes`
  - builds Quote + QuoteItems from pricing; rejects empty or missing-price items.
- POST `/api/pro/businesses/{businessId}/quotes/{quoteId}/invoices`
  - copies QuoteItems to InvoiceItems; totals preserved.
- Client docs & summary:
  - GET `/api/pro/businesses/{businessId}/clients/{clientId}/documents`
  - GET `/api/pro/businesses/{businessId}/accounting/client/{clientId}/summary`

## D) Current drift risks (observed)
- ProjectService creation previously allowed null price with no catalog fallback, leading to 0 totals in pricing and quotes.
- Pricing used `defaultPriceCents` only (no `tjmCents`) and did not track missing prices.
- Quote creation did not block empty pricing or missing prices, which could produce 0-total quotes.
- Client summary totals are limited to last 12 months by design; quotes list limited to 10 items.

Source files:
- `src/app/api/pro/businesses/[businessId]/projects/[projectId]/services/route.ts`
- `src/server/services/pricing.ts`
- `src/app/api/pro/businesses/[businessId]/projects/[projectId]/pricing/route.ts`
- `src/app/api/pro/businesses/[businessId]/projects/[projectId]/quotes/route.ts`
- `src/app/api/pro/businesses/[businessId]/quotes/[quoteId]/invoices/route.ts`
- `src/app/api/pro/businesses/[businessId]/clients/[clientId]/documents/route.ts`
- `src/app/api/pro/businesses/[businessId]/accounting/client/[clientId]/summary/route.ts`
