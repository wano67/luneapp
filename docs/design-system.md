# Design System – Propositions (tokens-first)

## Palette (light/dark)
- Neutres : `--bg-0 #0b0c10` / `#f7f7f8`, `--bg-1 #111218` / `#f0f1f3`, `--bg-2 #161822` / `#e7e9ed`, `--border #232635` / `#d8dbe3`.  
- Texte : `--text-primary #f5f7fb` / `#0f172a`, `--text-secondary #c7cede` / `#4b5563`, `--text-muted #9ca3af` / `#6b7280`.  
- Primaires : `--primary #4f9acb` (light: #0f172a on primary-soft #e5f1fb) ; Success `#22c55e`, Warning `#f59e0b`, Danger `#ef4444`.  
- Surfaces : `--surface #151926` (light #ffffff), `--surface-muted #0f111a` / `#f5f7fb`.  
- Gradients optionnels : primary-soft `linear-gradient(120deg,#5fb2e5,#3b82f6)` pour accents.

## Typographie
- Police : Inter (sans), JetBrains Mono (code).  
- Échelle :  
  - Display: 32/38, H1: 28/34, H2: 22/28, H3: 18/24, Body: 15/22, Small: 13/20, Mono small: 12/18.  
- Poids : 600 pour titres, 500 pour sous-titres, 400 pour body.

## Radius
- `--radius-xs: 6px`, `--radius-sm: 10px`, `--radius-md: 14px`, `--radius-lg: 18px`, `--radius-pill: 999px`.

## Shadows
- `--shadow-1: 0 4px 12px -4px rgba(0,0,0,0.25)`  
- `--shadow-2: 0 10px 28px -12px rgba(0,0,0,0.35)`  
- `--shadow-3: 0 18px 48px -18px rgba(0,0,0,0.45)`

## Motion
- Durées : 120ms (hover), 180ms (focus/press), 240ms (dialog).  
- Easing : `cubic-bezier(0.22, 0.65, 0.36, 1)`; respecter `prefers-reduced-motion` (désactiver translations).  
- States : hover → légère translation/ombre, focus → ring 2px primary, press → scale 0.98.

## Règles d’usage
- Contraste minimum AA : texte secondaire sur surface ≥ 4.5:1; bannir `text-slate-400` sur surfaces sombres sans ajustement.  
- Hiérarchie : spacing 8/12/16/24 pour blocs; cards min 16px padding; sections séparées par `border` tokenisé.  
- Inputs : labels explicites reliés via `htmlFor`; erreurs avec `role="alert"` et couleur Danger.  
- Thème : appliquer tokens via `:root` + `[data-theme="dark"]`; éviter hardcodes slate/emerald/rose, privilégier `var()` partout.

## Exemples d’usage
- Button primary : fond `--primary`, texte `--on-primary (white)`, radius `--radius-md`, shadow `--shadow-1`, focus ring primary 2px.  
- Card : bg `--surface`, border `--border`, radius `--radius-lg`, shadow `--shadow-1` optionnel, padding 16/20.  
- Modal : overlay `rgba(0,0,0,0.45)`, panel bg `--surface`, border `--border`, radius `--radius-lg`, shadow `--shadow-3`, transition 240ms.  
- Text : `<Text variant="h2">`, `<Text variant="body">` appliquant la scale ci-dessus.

## Do / Don’t
- Do : utiliser `var(--surface)` / `var(--text-primary)` plutôt que couleurs Tailwind codées; partager radius/shadow tokens.  
- Do : offrir focus visible uniforme et support clavier pour tous les contrôles.  
- Don’t : multiplier les couleurs accent (emerald/rose/blue) sans tokens; éviter gradients au hasard; pas d’ombres par défaut sans scale définie.  
- Don’t : laisser les modales sans trap focus ni aria-modal; éviter les transitions non respectueuses de `prefers-reduced-motion`.
