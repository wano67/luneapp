# Design System – Audit (état actuel)

## Tokens (globals.css)
- Couleurs (light) : `--background #f5f5f4`, `--background-alt #e5e7eb`, `--surface #f3f4f6`, `--surface-hover #e5e7eb`, `--text-primary #111827`, `--text-secondary #6b7280`, `--border #d4d4d8`, `--accent #3b82f6`.  
- Couleurs (dark) : `--background #050608`, `--background-alt #0b0c10`, `--surface #111112`, `--surface-hover #0b0c10`, `--text-primary #e5e7eb`, `--text-secondary #9ca3af`, `--border #1e1f23`, `--accent #4f9acb`.  
- Typo : vars `--font-sans`, `--font-mono` via Inter / JetBrains Mono; body antialiased.  
- Pas de scale radius/shadow/taille définie en tokens; nombreux hardcodes (border-radius 2xl/rounded-full, couleurs slate/blue/emerald/rose).  
- Mode dark activé via `data-theme="dark"` ou classe `.dark`; pas de gestion auto par media query.

## Composants UI (src/components/ui)
- Button : variantes `primary|outline|ghost`, tailles `sm|md|lg`; styles en classes utilitaires, focus-visible outline bleu, disabled opacity 60%. Pas d’icônes intégrés ni de state loading.  
- Input : label optionnel, error string; classe unique (bg slate-950/border slate-800), focus ring bleu ou rose si erreur. Pas de textarea dédié.  
- Card : simple conteneur radius 2xl, border slate-800, bg slate-900/40.  
- Badge : variantes `neutral|pro|personal|performance` couleur codée, uppercase.  
- Modal : overlay clickable, scroll lock, close on Escape; **pas de focus trap**, pas d’`aria-modal`, ferme via bouton X; animations absentes.  
- Icons : set SVG personnalisés (Home/Wallet/Studio/Focus/Sun/Moon/User/Settings).  
- ThemeToggle : stocke `theme` dans localStorage, applique data-theme.

## Incohérences / points faibles
- Couleurs hardcodées (slate/red/blue/emerald/rose) non liées aux tokens → difficile de basculer de thème ou de faire évoluer la palette.  
- Pas de tokens pour radius/shadow/spacing/typography scale.  
- Focus states variables : Button focus-visible ok, mais selects/inputs natifs ont styles bruts; menus/dock n’ont pas de gestion focus.  
- Modal sans focus trap ni aria-modal; navigation clavier non assurée.  
- Ombres absentes ou ad hoc (shadow-2xl dans AppShell, pas en tokens).  
- Aucune animation déclarée à l’échelle du DS (juste transitions locales).  
- Composants complexes (CsvImportModal, AppShell) réutilisent directement des couleurs/spacing sans passer par tokens.

## Quick wins (petits patchs)
- Introduire tokens CSS supplémentaires : radius (8/12/16), shadow (xs/s/m), spacing (8/12/16/24), typographie (h1-h4, body, small), états (success/warn/danger).  
- Centraliser l’usage de `var(--background/*)` dans Button/Input/Card/Modal pour réduire les hardcodes slate/blue.  
- Ajouter focus visible cohérent : `outline-offset`, `:focus-visible` sur liens/nav/buttons custom.  
- Modal : ajouter `aria-modal="true"`, `role="dialog"`, focus initial sur heading ou premier bouton, trap simple (loop tab).  
- Créer utilitaires `Text` ou classes typographiques pour titres/paragraphes au lieu de multiples tailles ad hoc.  
