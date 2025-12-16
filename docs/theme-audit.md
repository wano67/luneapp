# Theme Audit (Lune App)

## Source of truth actuelle
- Thème appliqué via `data-theme` sur `<html>` (vars dans `globals.css`).
- Toggle unique `src/components/ThemeToggle.tsx` : lit/écrit `localStorage.theme`, applique `data-theme` en client, sans tenir compte du cookie.
- Pas de provider global ; les pages marketing et l’app interne utilisent le même root layout sans initialisation serveur.
- Cookies `pref_theme`/`pref_language` introduits côté `/api/account/preferences` (ne pilotaient pas encore l’UI).
- Logo (icon.svg / LogoMark) ne suit pas `currentColor` (pas d’inversion automatique).

## Problème
- Double source : `localStorage.theme` vs cookie `pref_theme`.
- Pas d’application serveur (FOUC possible) et pas de suivi `prefers-color-scheme` quand `system`.
- ThemeToggle présent dans AppShell alors que les préférences sont côté compte.
- Logo non lié aux tokens → pas d’inversion dark/light.

## Plan de migration
1) Introduire un module thème unique (`src/lib/theme.ts`) avec `ThemePref` (`light|dark|system`) + helpers cookies + `applyThemePref()` qui gère `data-theme` et `prefers-color-scheme`.
2) Ajouter un `ThemeProvider` client global, monté dans `src/app/layout.tsx`, qui lit le cookie (`pref_theme`) et applique le thème dès le mount.
3) Supprimer ThemeToggle des headers (marketing + AppShell) et piloter le thème via `/api/account/preferences` (cookie `pref_theme`).
4) Faire suivre la préférence “system” en live via matchMedia; appliquer immédiatement après PATCH préférences.
5) Mettre le logo en `currentColor` pour inversion automatique; ajuster légèrement la palette (light plus crème, dark plus noir).
