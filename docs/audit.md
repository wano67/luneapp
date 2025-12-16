# Audit applicatif (Next.js App Router + Prisma)

## Résumé exécutif
- P0 identifiée (corrigée dans code actuel) : boucle de fetch sur `/api/pro/businesses` et `/api/pro/businesses/:id` due aux dépendances instables (`useActiveBusiness` contexte dans deps, double fetch liste + détail). Correction appliquée (dépendances stabilisées, fetch liste retiré dans la page entreprise).
- Autres risques principaux : dépendance à `localStorage` pour le contexte actif, CSRF bloquant en prod si APP_URL/APP_ORIGINS manquants, legacy routes `/dash-*` encore exposées (redirigées mais présentes), bannière active limitée au layout business (pas globale).
- Qualité build : `pnpm lint`, `pnpm typecheck`, `pnpm build` OK (avertissement Next middleware déprécié).

## Architecture réelle (synthèse)
- App Router, espace connecté `/app/**` via `AppShell` (dock + sidebar + mobile menu).
- PRO : hub `/app/pro` (ProHomeClient), cockpit `/app/pro/[businessId]`, modules clients/prospects/projects (APIs réelles), autres modules stubs (tasks/services/process/finances/settings/admin/references).
- Active business : `ActiveBusinessProvider` monté dans `/[businessId]/layout` (client), stocke `activeProBusinessId` + `lastProBusinessId`, bandeau `ActiveBusinessBanner`, modal `SwitchBusinessModal`.
- API : middleware auth cookie JWT, `requireAuthPro` + `requireBusinessRole`, CSRF sur mutateurs, `rateLimit`, `withRequestId/getRequestId`, BigInt -> string.

## Zones fragiles / Patterns à surveiller
- Contexte actif : value reconstruite à chaque render (fonctions inline dans value) → peut déclencher re-render global si consommé partout; mitigation actuelle via dépendances stables dans `useEffect`.
- `localStorage` comme unique source de vérité activeBusiness (pas revalidé au montage du hub, auto-open désactivé) → possible décalage entre contexte et permissions réelles.
- `AppShell` mobile menu + modals : stacking complexe (z-index multiples), risque de focus/scroll-lock collisions si modals multiples s’ouvrent.
- CSRF `getAllowedOrigins` : en prod, si aucune env définie, toutes mutations sont bloquées (403). Vérifier configuration déploiement.
- Legacy routes `/app/pro/[businessId]/dash-*` toujours présentes (redirigent) : bruit dans build, potentiels bookmarks anciens.

## Recommandations prioritaires
1) Stabiliser définitivement le contexte actif : value mémorisée (useMemo) et fonctions useCallback; optionnel auto-open avec validation unique (dépendance sur activeId + 1 ref).
2) Centraliser la bannière active (ex: dans `AppShell`) si souhaité globalement, pour éviter dupliquer dans layout et hub.
3) Durcir le hub : utiliser un guard unique pour auto-open (revalidation du activeId) et éviter tout fetch si déjà en contexte business.
4) Sécurité déploiement : s’assurer que APP_URL/NEXT_PUBLIC_APP_URL/APP_ORIGINS sont renseignées en prod pour CSRF.
5) Nettoyage legacy : envisager redirections 308 côté Next config pour `/dash-*` afin d’éviter l’indexation.

## Points d’attention par fichier récent
- `ActiveBusinessProvider.tsx` : gère active/last IDs; plus de fetch auto; initialBusiness comparé champ à champ. Value se recrée à chaque render (open/close handlers inline) → acceptable mais peut forcer rerender des consommateurs; à surveiller.
- `ProHomeClient.tsx` : hub; fetch /me + /businesses via apiClient; query parsing stabilisée via `searchParams.toString()`. Auto-open désactivé. Persistance active/last.
- `/[businessId]/layout.tsx` : fetch unique `/businesses/:id`, setActiveBusiness avec rôle issu du contexte; bandeau placé avant children.
- `/[businessId]/page.tsx` : ne fetch plus la liste; dépendance setActiveBusiness stable; rôle optionnel (peut être null).
- `AppSidebar.tsx` : liens canoniques EN, bouton “Changer d’entreprise” appelle modal.

## Routes (aperçu)
- UI PRO principales : `/app/pro`, `/app/pro/[businessId]`, `/clients`, `/prospects`, `/projects`, `/tasks`, `/services`, `/process`, `/finances/*`, `/settings/*`, `/admin/*`, `/references/*`, `/invites`, `/businesses`.
- API PRO principales : `/api/pro/businesses` (GET/POST), `/businesses/[id]` (GET), clients/projects/prospects list + detail, invites GET/POST/DELETE, invites accept POST. Auth + role + CSRF sur mutateurs + rateLimit.

## Bugs / risques (voir docs/bugs.md pour détails)
- P0 boucle fetch (corrigé) : due aux deps instables sur contexte et double fetch liste+détail.
- P1 contexte actif potentiellement désynchronisé (localStorage non revalidé).
- P2 stacking modals/menus (z-index/scroll-lock), P2 CSRF env manquante.
