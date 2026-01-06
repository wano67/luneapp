# AUDIT — luneapp (Next.js App Router + Prisma)

## Architecture
- App Router : pages sous `src/app` (marketing, app/personal, app/pro). Layouts et UI premium (tokens CSS `--surface`, `--border`, etc.).
- API routes : `src/app/api/**` couvrent auth, personal finance, PRO (clients, prospects, projects, invoices, documents, interactions, settings...).
- Composants partagés : `src/components/pro` (LogoAvatar, KpiCirclesBlock, agenda ContactCard, etc.), UI de base sous `src/components/ui` (Card, Input, Modal...).
- Serveur : `src/server` (db/client Prisma, auth guards `requireAuthPro`, RBAC `requireBusinessRole`, sécurité CSRF/rateLimit). Prisma schema sous `prisma/schema.prisma` (Business, Client, Project, BusinessDocument, etc.).

## Pages (principales)
- Marketing : /(marketing)/about, /contact, /features, /pricing, /security, /legal/*, landing /(marketing)/page.tsx.
- Espace app : /app/page.tsx (hub), /app/docs, /app/focus, /app/performance/*, /app/personal/* (comptes/budgets/transactions).
- PRO (hub studio) : /app/pro/page.tsx et /app/pro/businesses (sélection), /app/pro/[businessId] (dashboard). Modules : agenda, projects, finances (treasury/vat/ledger/payments/etc.), services, process, marketing, references, settings (team/billing/integrations/taxes), tasks, stock.
- CRM : /app/pro/[businessId]/agenda, /clients, /prospects, détail client/prospect.
- Legacy/transition : pages `dash-*` sous pro, admin documents/deadlines.

## API routes (synthèse)
- Auth : /api/auth/login/logout/register/me ; account profile/preferences/password.
- Personal : /api/personal/accounts, categories, summary, transactions (CRUD, import, bulk delete).
- PRO core : /api/pro/businesses (CRUD, dashboard, overview), members, invites, settings, services, processes, products/stock, tasks, projects (CRUD + start/archive/unarchive, quotes, invoices, services), finances (treasury/vat/ledger/payments), accounting client summary.
- CRM : /api/pro/businesses/:bid/clients (list/CRUD), prospects (list/CRUD/convert), interactions (list/CRUD), documents (uploads, view/download), payments (paid invoices), references.
- Utilities : /api/logo, /api/favicon, /api/health, /api/dev/seed.

## Orphelins / faible usage (suspect)
- Pages `app/app/pro/[businessId]/dash-*` (dash-admin-process, dash-entreprise, dash-finances, dash-projets) : aucune nav principale actuelle → Orphelin probable.
- Pages performance (alignement/perso/pro) et personal/dash-* : legacy analytics, peu référencées dans nav → Probablement non utilisées.
- Admin pages `admin/deadlines`, `admin/documents` : pas vues en nav → à vérifier.
- API `personal/*`, `performance/*` : usage non visible dans PRO ; garder si mobile/personal active, sinon documenter.

## Sécurité (constats rapides)
- Auth/RBAC : la majorité des routes PRO utilisent `requireAuthPro` + `requireBusinessRole`. Ex : payments, documents, interactions. OK.
- CSRF : mutations PRO utilisent `assertSameOrigin` (ex: payments POST, documents upload). Vérifier uniformité sur tous POST/PATCH/DELETE legacy.
- Rate limiting : présent sur uploads documents (30/h), payments (120/h), invites ; absent sur certaines mutations legacy (à vérifier services/process).
- SSRF : /api/logo et /api/favicon intègrent garde protocol/host privé. Garder timeouts courts (déjà 2s et max 4 candidats dans /api/logo).
- Uploads : documents route limite 20MB + whitelist MIME. OK. Prévoir contrôle extension cohérent avec MIME.
- P0 actuel : migration Prisma BusinessDocument non appliquée → prisma.businessDocument undefined en prod/test. Corriger en appliquant migrations/prisma generate.

## Qualité / dette
- Duplication de formatteurs (date/currency) partiellement résolue via `formatCurrencyEUR`; centraliser statuses (`isActiveProjectStatus`) et date formatter.
- Headers/tabs/KPI répétées : besoin de primitives réutilisables (PageHeaderPro, TabsPills, CardShell).
- Fichiers volumineux mélangeant data+UI (ex: agenda/client detail) : extraire composants par tab.
- Tests manquants (smoke API/UI) pour CRM : documents upload/view, interactions, payments.

## Plan d’action
- P0 :
  - Appliquer migrations Prisma (BusinessDocument) + `pnpm prisma generate`; retirer garde temporaire une fois généré.
  - Vérifier CSRF/rateLimit sur mutations legacy (services/process/products) et corriger le cas échéant.
- P1 :
  - Créer primitives UI responsive (PageHeaderPro, TabsPills, CardShellStudio) et les appliquer à Agenda/Client/Prospect/Studio.
  - Normaliser formatters (currency/date/status) + helpers fetchers (clients/prospects/projects/interactions/documents).
  - Ajouter smokes pour /api/logo, documents upload/view/download, payments GET/POST.
- P2 :
  - Nettoyage routes/pages orphelines (dash-*, performance legacy) après validation produit.
  - Documentation responsive (RESPONSIVE_CONTRACT) + checklist CI (lint/typecheck/build + smokes).
