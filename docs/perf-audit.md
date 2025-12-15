# Performance / Scalabilité

## Hotspots DB
- Pro lists (clients/prospects/projects) : `findMany` sans pagination ni limit (`src/app/api/pro/businesses/[businessId]/clients/route.ts:69-80`, `prospects/route.ts:114-121`, `projects/route.ts:68-77`) → risque OOM/latence.  
- Wallet summary/accounts : agrégations groupBy/aggregate sur tous comptes (`personal/accounts/route.ts`, `summary/route.ts`) mais bornés par user; multi-devises additionnées sans conversion (précision business, pas perf).  
- Transactions import : `createMany` par chunk 1000 (ok) ; comptes/transactions/summary effectuent requêtes séquentielles mais coût limité.  
- Index : transactions filtrées par date/account -> index composites recommandés `(userId,accountId,date)` ; prospects/clients search -> indexes `(businessId,name)` (clients exist) et `(businessId,pipelineStatus)` à ajouter.

## API / pagination
- Transactions GET : limit max 200 + cursor (date,id). OK.  
- Pro endpoints sans limit (P1) : ajouter `take/skip` + `cursor` pour clients/prospects/projects.  

## Frontend
- Pages data-driven sont client-side (ProHomeClient, wallet pages) → hydratation lourde mais acceptable; aucune SSR cachée.  
- AppShell riche en JS (gestures mobile) chargé partout; pas de code splitting spécifique.  
- Assets: pas d’optimisation spéciale (marketing simple).

## Recos
- Ajouter pagination/limit + index correspondants sur clients/prospects/projects (P1). DoD: responses paginées avec `nextCursor`, tests sur volumes.  
- Ajouter cache courte durée / etag sur `personal/accounts`/`summary` si pression, ou au moins éviter recalculs par user (P2).  
- Minimiser JS global : convertir pages statiques (pro/perf placeholders) en server components (déjà) et envisager lazy load AppShell gestures (P2).  
