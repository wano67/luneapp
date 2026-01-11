# FEATURE MATRIX

| Module | Feature | Pages | Endpoints | Status |
| --- | --- | --- | --- | --- |
| CRM | Clients list | /app/pro/[businessId]/clients | GET /api/pro/businesses/{businessId}/clients | existing |
| CRM | Client detail edit | /app/pro/[businessId]/clients/[clientId] | GET/PATCH /api/pro/businesses/{businessId}/clients/{clientId} | existing |
| CRM | Prospects list | /app/pro/[businessId]/prospects | GET /api/pro/businesses/{businessId}/prospects | existing |
| CRM | Prospect detail edit | /app/pro/[businessId]/prospects/[prospectId] | GET/PATCH /api/pro/businesses/{businessId}/prospects/{prospectId} | existing |
| CRM | Prospect convert | /app/pro/[businessId]/prospects/[prospectId] | POST /api/pro/businesses/{businessId}/prospects/{prospectId}/convert | existing |
| CRM | Agenda follow-up list | /app/pro/[businessId]/agenda | GET /api/pro/businesses/{businessId}/projects?archived=false, GET /api/pro/businesses/{businessId}/interactions | partial (light surface) |
| Catalog | Services list | /app/pro/[businessId]/catalog | GET /api/pro/businesses/{businessId}/services | existing |
| Catalog | Service detail | /app/pro/[businessId]/catalog/services/[serviceId] | GET/PATCH /api/pro/businesses/{businessId}/services/{serviceId} | existing |
| Projects | Projects list | /app/pro/[businessId]/projects | GET /api/pro/businesses/{businessId}/projects | existing |
| Projects | Project detail | /app/pro/[businessId]/projects/[projectId] | GET /api/pro/businesses/{businessId}/projects/{projectId} | existing |
| Projects | Add service to project | /app/pro/[businessId]/projects/[projectId] | POST /api/pro/businesses/{businessId}/projects/{projectId}/services | existing |
| Projects | Pricing | /app/pro/[businessId]/projects/[projectId] | GET /api/pro/businesses/{businessId}/projects/{projectId}/pricing | existing |
| Billing | Quote create | /app/pro/[businessId]/projects/[projectId] | POST /api/pro/businesses/{businessId}/projects/{projectId}/quotes | existing |
| Billing | Quote PDF | /app/pro/[businessId]/projects/[projectId] | GET /api/pro/businesses/{businessId}/quotes/{quoteId}/pdf | existing |
| Billing | Invoice create | /app/pro/[businessId]/projects/[projectId] | POST /api/pro/businesses/{businessId}/quotes/{quoteId}/invoices | existing |
| Billing | Invoice PDF | /app/pro/[businessId]/projects/[projectId] | GET /api/pro/businesses/{businessId}/invoices/{invoiceId}/pdf | existing |
| Client billing | Facturation hub | /app/pro/[businessId]/clients/[clientId] | GET /api/pro/businesses/{businessId}/clients/{clientId}/documents, GET /api/pro/businesses/{businessId}/accounting/client/{clientId}/summary | existing |
| Accounting | Ledger | /app/pro/[businessId]/finances/ledger | GET /api/pro/businesses/{businessId}/ledger | partial |
| Accounting | Payments list | /app/pro/[businessId]/finances/payments | GET /api/pro/businesses/{businessId}/payments | existing |
| Accounting | Treasury forecast | /app/pro/[businessId]/finances/treasury | GET /api/pro/businesses/{businessId}/finances/treasury | partial |
| Accounting | VAT | /app/pro/[businessId]/finances/vat | GET /api/pro/businesses/{businessId}/finances/vat | partial |
| Messaging | Project/client threads | none | none | missing |
| Calendar | Unified calendar UI | none | none | missing |
