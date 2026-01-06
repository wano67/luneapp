# Audit Logo Fetch — luneapp

## 1. Routes API trouvées
- `/api/favicon` — src/app/api/favicon/route.ts
  - Inputs: query `url` (http/https).
  - Output: 200 image/* (buffer proxifié) ou 204 si introuvable; headers: `Cache-Control: public, max-age=3600, stale-while-revalidate=604800`, `x-request-id`.
  - Fallbacks: candidates via HTML parse (rel icon/apple-touch/og:image/manifest + chemins communs), puis Google S2 (sz=256), Clearbit.
  - Sécurité: refuse protocol != http/https, ports non 80/443, host privés (localhost, 127.0.0.1, 10/192.168/172.16-31, ::1, fc/fd/fe80).
  - Runtime: server (no edge).

## 2. Helpers liés aux logos/favicons
- src/lib/website.ts
  - normalizeWebsiteUrl (prepend https).
  - getFaviconUrl -> `/api/favicon?url=...`.
- src/lib/logo/getLogoCandidates.ts
  - Fetch HTML (timeout 4s), UA desktop; extrait link rel icon/apple-touch/mask, og:image, manifest icons; gère base href; ajoute chemins communs (/assets/logo.svg, /logo.svg, /favicon.svg, /favicon.ico).
- src/lib/logo/validateLogoUrl.ts
  - HEAD/GET avec timeout 4s, UA desktop; accepte image/* ou svg; limite 2MB; retourne buffer + content-type.
- Ancien helper plus complet (non utilisé par favicon actuel): src/lib/logo-from-url.ts (extractions + Google S2/Clearbit/favico).

## 3. Consommateurs UI
- Composants:
  - src/app/app/components/FaviconAvatar.tsx (utilise getFaviconUrl(normalizeWebsiteUrl()) -> /api/favicon; fallback initiales onError).
  - src/app/app/components/Favicon.tsx (idem).
  - BusinessContextChip.tsx, ActiveBusinessTopBar.tsx, ActiveBusinessBanner.tsx, SwitchBusinessModal.tsx, ProHomeClient.tsx, pages clients/projets affichent FaviconAvatar.
- Datas:
  - Business et Client exposent `websiteUrl` via API business/clients/overview.
  - Aucune utilisation d’un autre endpoint logo.

## 4. Cartographie endpoint -> usages
Endpoint | Fichier | Input | Output | Cache | Fallbacks | Sécurité | Call-sites | Notes
---|---|---|---|---|---|---|---|---
/api/favicon | src/app/api/favicon/route.ts | `url` (http/https) | 200 image/* (buffer) ou 204 | public max-age=3600, S-W-R=7d | HTML parse (icons/og/manifest + chemins communs) -> Google S2 -> Clearbit | bloque protocol != http/https, ports ≠80/443, hosts privés | FaviconAvatar / Favicon (via getFaviconUrl) | Pas de cache mémoire; pas de businessId/logoUrl DB; reste générique

## 5. Doublons / dettes
- Deux implémentations différentes existent: /api/favicon (nouvelle) et helper non utilisé `logo-from-url.ts` (overlap de logique, sources/timeout).
- UI passe toujours par getFaviconUrl -> /api/favicon; aucun autre endpoint.
- Pas de cache mémoire; requête répétée possible sur la même URL.
- Pas de prise en compte éventuelle de logoUrl stocké (non implémenté).

## 6. Recommandation d’unification (proposée)
- Garder un seul endpoint: `/api/logo` (ou conserver `/api/favicon` mais clarifier).
  - Input: `url` (obligatoire, http/https).
  - Output: 200 image/* buffer, 204/404 si introuvable.
  - Fallback chain: HTML parse (rel icon/apple-touch/mask + og:image + manifest icons + base href + chemins communs) -> favicon.ico -> Google S2 -> Clearbit.
  - Cache: headers public max-age=86400 + cache mémoire courte (1h) pour éviter re-fetch.
  - Sécurité: blocage protocol/ports privés/hosts locaux comme déjà fait.
  - Migration: soit renommer /api/favicon -> /api/logo, soit garder /api/favicon comme alias vers la logique unifiée. Supprimer/archiver `logo-from-url.ts` ou le fusionner.
  - Call-sites: FaviconAvatar/Favicon restent mais pointeront vers le nouvel endpoint (via getLogoUrl).

## 7. Plan de tests (logo obligatoire si le site a un logo)
- Cas apple-touch-icon: site avec <link rel="apple-touch-icon"> → doit renvoyer 200 image.
- Cas og:image sans favicon: site avec og:image seul → doit renvoyer 200.
- Cas favicon.svg: site exposant /favicon.svg → 200 image/svg+xml.
- Cas favicon.ico uniquement: 200 image/x-icon.
- Cas manifest icons: manifest avec icônes → 200.
- Cas site bloque bots/403: doit tomber sur fallback Google S2 ou Clearbit (200 image).
- Cas URL sans scheme: `studiofief.com` → normalisation https + 200 (assets/fief-logo.svg attendu).
- Cas SSRF: url localhost/10.x/192.168/172.16-31/::1 → 403/400.
- Cas timeout: site lent → fallback sur sources alternatives; max durée ~ quelques secondes; pas de crash.
