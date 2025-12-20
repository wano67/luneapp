## Pré-requis
- ENV: `APP_URL=http://localhost:3000` et `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Base de données prête (prisma generate ok)
- Seed dev (admin@local.test) si besoin: `ENABLE_DEV_SEED=1 pnpm seed:dev`

## Lancement
```
lsof -ti tcp:3000 | xargs -r kill -9
rm -rf .next
pnpm install
pnpm prisma generate
APP_URL=http://localhost:3000 NEXT_PUBLIC_APP_URL=http://localhost:3000 pnpm dev --port 3000
```

## Sessions de test
```
# Admin
curl -i -c /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"admin@local.test","password":"admintest"}'

# Member
curl -i -c /tmp/cookies-member.txt -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -X POST http://localhost:3000/api/auth/login \
  -d '{"email":"test@test.fr","password":"testtest"}'
```

## Endpoints dashboard utiles (cURL)
- Dashboard synthèse:
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  http://localhost:3000/api/pro/businesses/8/dashboard
```
- Finances agrégées (période custom):
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/pro/businesses/8/finances?aggregate=1&periodStart=2025-01-01&periodEnd=2025-12-31"
```
- Finances séries:
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/pro/businesses/8/finances?periodStart=2025-01-01&periodEnd=2025-12-31"
```
- Tâches (pour stats/retards):
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/pro/businesses/8/tasks"
```
- Prospects (pipeline):
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/pro/businesses/8/prospects"
```
- Interactions (next actions):
```
curl -sS -b /tmp/cookies-admin.txt -H "Origin: http://localhost:3000" \
  "http://localhost:3000/api/pro/businesses/8/interactions?from=2025-01-01&to=2025-12-31&limit=20"
```

## Exemple de mapping front
- KPIs: `/dashboard.kpis` (projectsActiveCount, openTasksCount, mtdIncome/Expense/Net)
- Cash flow: `/dashboard.monthlySeries` (12 mois)
- Pipeline: `/prospects` group by pipelineStatus
- Tasks by status / late: `/tasks` filtrage local (status != DONE & dueDate < now)
- Clients récents: `/clients` tri createdAt
- Next actions: `/dashboard.nextActions.interactions` + `/dashboard.latestTasks`

## Charts (lib suggérée)
- Recharts (LineChart/BarChart/PieChart) import dynamique `next/dynamic` pour client-only.

## Validation
```
pnpm lint
pnpm typecheck
pnpm build
```
Si Turbopack pose problème en dev, utiliser `pnpm dev:stable`.
