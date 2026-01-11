# AGENDA ENDPOINTS CHECKLIST

| Feature | Endpoint(s) | UI component(s) | Status | Effort |
| --- | --- | --- | --- | --- |
| List clients (agenda) | GET `/clients` | `AgendaPage` | OK | S |
| List prospects (agenda) | GET `/prospects` | `AgendaPage` | OK | S |
| Create client/prospect | POST `/clients`, POST `/prospects` | `AgendaPage` modal | Partial (no role gating) | S |
| View client detail | GET `/clients/{id}` | `ClientDetailPage` | OK (outside agenda) | M (move into panel) |
| Update client | PATCH `/clients/{id}` | `ClientDetailPage` / `ClientInfoTab` | OK (outside agenda) | M |
| View prospect detail | GET `/prospects/{id}` | `ProspectDetailPage` | OK (outside agenda) | M (move into panel) |
| Update prospect pipeline/status | PATCH `/prospects/{id}` | none in agenda | Missing | M |
| Convert prospect to client+project | POST `/prospects/{id}/convert` | none (button routes elsewhere) | Missing | S |
| Create project from client | POST `/projects` | none in agenda | Missing | S |
| List projects for client | GET `/projects?clientId=...` | `ClientDetailPage` | OK (outside agenda) | M |
| View interactions for client | GET `/interactions?clientId=...` | `ClientInteractionsTab` | OK (outside agenda) | M |
| Create interaction | POST `/interactions` | `ClientInteractionsTab` | OK (outside agenda) | M |
| View interactions for prospect | GET `/interactions?prospectId=...` | `ProspectDetailPage` | OK (read-only) | M |
| Tasks follow-up list | GET `/tasks` | `TasksPage` | OK (separate page) | M (embed in agenda) |
| Create task follow-up | POST `/tasks` | `TasksPage` | OK (separate page) | M (embed in agenda) |
| Filters by tags/categories | GET `/references?type=...` + filters on list endpoints | `TasksPage`, (none in agenda) | Missing in agenda | M |
| Assign owner / member | GET `/members` + PATCH `/tasks` | none in agenda | Missing | M |
| Client documents list | GET `/clients/{id}/documents` | `ClientDocumentsTab` | OK (outside agenda) | L (if moved) |
