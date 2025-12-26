# Audit PRO — Architecture, UX, Bugs, Plan (luneapp)

## 1) Cartographie projet (architecture)
- **Stack**: Next.js App Router (app/), TypeScript, Tailwind + CSS vars (`--surface`, `--border`, `--text-*`), lucide-react icons.
- **Racine pages**: `src/app/app/…` (app shell authenticated), `src/app/api/**` (routes API), `src/components/**` (UI).
- **PRO pages principales**:
  - Studio hub: `src/app/app/pro/page.tsx` (+ `ProHomeClient` components).
  - Business dashboard: `src/app/app/pro/[businessId]/page.tsx`.
  - Agenda: `src/app/app/pro/[businessId]/agenda/page.tsx` (uses `AgendaPage`).
  - Clients list wrapper: `src/app/app/pro/[businessId]/clients/page.tsx` → `AgendaPage view="clients"`.
  - Prospects list wrapper: `src/app/app/pro/[businessId]/prospects/page.tsx` → `AgendaPage view="prospects"`.
  - Client detail: `src/app/app/pro/[businessId]/clients/[clientId]/page.tsx`.
  - Prospect detail: `src/app/app/pro/[businessId]/prospects/[prospectId]/page.tsx`.
  - Sidebar: `src/app/app/AppSidebar.tsx` (fixed nav).
- **UI partagée**: `Card`, `Input`, `Modal`, `LogoAvatar`, `cn`, `fetchJson`, `normalizeWebsiteUrl`.
- **Flux données Agenda/CRM**:
  - `AgendaPage`: fetches `/api/pro/businesses/{id}/clients`, `/prospects`, `/projects?archived=false`; agrège par `clientId` pour projets actifs/valeur.
  - Status actif = projets actifs > 0 ; border couleur sur card.
  - Logo via `LogoAvatar` → `/api/logo?url=...` + `normalizeWebsiteUrl`.

## 2) Audit APIs & sécurité (côté PRO utilisés ici)
- `/api/pro/businesses` (GET list) – auth required via app shell, business selection.
- `/api/pro/businesses/{id}` (GET dashboard).
- `/api/pro/businesses/{id}/clients` (GET/POST), `/clients/{clientId}` (GET/PATCH).
- `/api/pro/businesses/{id}/prospects` (GET/POST), `/prospects/{prospectId}` (GET/PATCH/convert).
- `/api/pro/businesses/{id}/projects?archived=false` (GET, supports `clientId`).
- `/api/pro/businesses/{id}/interactions` (GET with clientId/prospectId).
- `/api/logo?url=...` (GET image; SSRF guard exists in previous work).
- Auth/permissions: enforced via app shell middleware (not detailed here) and requireAuth/requireBusinessRole in API handlers (review recommended for IDOR). Risk: detail pages rely on clientId/prospectId from params; ensure API guards business ownership.
- SSRF: logo endpoint should validate http/https + block private/localhost; verify implementation in `/api/logo/route.ts`.

## 3) Audit DB/ORM
- ORM: Prisma (schema not re-opened here). Models used: Business, Client, Prospect, Project, Interaction (observed via API shapes). Project status enums include `IN_PROGRESS|ACTIVE|ONGOING` (front checks multiple). Prospect status `WON/LOST` used for conversion.
- Potential mismatch: status strings hardcoded in front; align with Prisma enums to avoid missed actives.

## 4) Audit UX/UI (premium unifié)
- Source of truth design: Studio KPIs (3 circles in soft container), surfaces via vars, radius 2xl, hover subtle.
- Incohérences repérées:
  - Agenda KPI block previously had border/spacing off; fixed to soft container but verify parity with Studio (same padding/spacing).
  - Cards: risk of border color hidden by default `border` class overriding; ensure status class last and no secondary border class after it.
  - Double ArrowRight previously; now only one bottom-right.
  - Sidebar active state fixed via `activePatterns` for agenda/clients/prospects; “Clients” item removed.
  - LogoAvatar uses `/api/logo` with object-contain/padding; banner guard important to avoid cropped wide images.

## 5) Bugs critiques (symptôme → cause probable → fix)
1. **Bordure état Agenda peu visible** → `border` class later overriding color or too light; ensure status class is last and color strong enough (emerald-300/60 / rose-300/60).
2. **Deux flèches sur card** → duplicate ArrowRight; keep only bottom-right CTA, remove any others in subcomponents (done).
3. **Prospect “introuvable”** → detail page fetched `/prospects/{id}` but old UI; ensure API exists and params correct, add graceful empty state.
4. **/api/logo parfois 204 / bannières** → favicon fallbacks or missing user-agent; use unified LogoAvatar with padding & object-contain; strengthen logo fetcher (future PR).
5. **Sidebar non active sur clients/prospects** → needed `activePatterns` for agenda; fixed.

## 6) Plan PR “safe” (découpage)
- PR1: Design primitives — extract `KpiCirclesBlock`, `ContactCard` shared; ensure status border utility; align LogoAvatar banner guard; update Storybook/MD if exists.
- PR2: Agenda final — ensure KPI matches Studio, status borders visible, single arrow, skeleton/empty premium; regression test.
- PR3: Client detail — premium layout, tabs, editable Info (PATCH), metrics from projects/interactions; back-to-agenda link.
- PR4: Prospect detail — fetch prospect, metrics placeholders, convert CTA neutral, back link; handle not-found state.
- PR5: Logo pipeline robustness — harden `/api/logo` (timeouts, UA, HTML parsing, og/manifest), add smoke tests for known domains.

## 7) Outils / Tests / Qualité
- CI checklist: `pnpm lint`, `pnpm typecheck`, `NEXT_DISABLE_TURBOPACK=1 npx next build --webpack`.
- Add targeted tests:
  - Unit: status border helper, normalizeWebsiteUrl, logo fetch validator (mock).
  - E2E (Playwright): Agenda page renders KPIs, cards have single arrow, border color changes with mocked data; client detail loads & saves form.
  - Visual regression: snapshots of Studio KPI block vs Agenda KPI block.
- Conventions: status enums centralized, helpers `formatCurrency/formatDate`, use `LogoAvatar` everywhere, `activePatterns` for nav, no inline blue hovers.
