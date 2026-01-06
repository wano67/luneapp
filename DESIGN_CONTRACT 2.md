# DESIGN_CONTRACT — PRO/CRM (Studio-aligned)

## Surfaces & tokens
- Fond: `bg-[var(--surface)]`, hover: `bg-[var(--surface-hover)]`.
- Bordure: `border border-[var(--border)]` (sauf état actif/inactif coloré).
- Texte: primaire `text-[var(--text-primary)]`, secondaire `text-[var(--text-secondary)]`.
- Rayon: cards et blocs principaux `rounded-2xl` (KPI container `rounded-3xl` possible).
- Ombre: `shadow-sm` + hover `hover:shadow-md`, lift `hover:-translate-y-[1px]`.
- Aucune couleur bleue; accents neutres ou emerald/rose pastels pour état.

## KPI Block (Studio)
- Conteneur: `rounded-3xl bg-[var(--surface)] p-6 sm:p-7` (pas de border).
- Grille 3 colonnes: `grid gap-6 sm:grid-cols-3`.
- Cercle: `aspect-square w-32 rounded-full bg-[var(--surface-hover)] flex items-center justify-center flex-col gap-1 text-center`.
- Valeur: `text-2xl font-semibold leading-tight text-[var(--text-primary)]`.
- Label: `text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]`.

## Cards Contact (Agenda/Clients/Prospects)
- Wrapper: `card-interactive block rounded-2xl border bg-[var(--surface)] p-5 pb-14 shadow-sm transition`.
- Hover: `hover:-translate-y-[1px] hover:shadow-md`.
- Bordure état: 
  - Actif `border-emerald-300/60`
  - Inactif `border-rose-300/60`
  - Prospect `border-[var(--border)]`
- Header: flex, LogoAvatar size 48 square, name bold `text-sm font-semibold`, email/company `text-[12px] text-[var(--text-secondary)]` truncated.
- Metrics: grid 2x2, labels secondary, values `font-medium text-[var(--text-primary)]`.
- CTA arrow: single `ArrowRight` bottom-right `absolute bottom-5 right-5 pointer-events-none`, `strokeWidth≈2.75`, hover translate-x-1 via group.
- Padding bottom >= `pb-14` to avoid overlap with arrow.

## Status (no badge text)
- Etat communiqué par bordure seulement sur cards.
- Detail pages: mini text/indicator allowed but no pills; keep inline and non-overflowing.

## Tabs
- Buttons: `rounded-full px-3 py-1 text-xs font-semibold cursor-pointer`.
- Active: `border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm`.
- Inactive: `text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]`.
- aria-pressed/selected required.

## LogoAvatar
- Source unique `/api/logo?url=...`.
- Normalize URL before use.
- Container square, optional padding (p-2) + `object-contain`.
- Fond doux; fallback initials uppercase.
- No favicon, no banner crop; allow letterboxing if wide.

## Detail pages (Client/Prospect)
- Back link: `← Retour à l’agenda` muted.
- Header: LogoAvatar + identity, status inline (text/pastille) non-floating.
- KPIs row: single surface block, 3–4 mini tiles (same language as cards/kpi).
- Tabs: same style as above.
- Forms: Inputs minimal, borders standard, save CTA neutral (bg-neutral-900 or border).

## Interactions
- cursor-pointer on tabs, CTA, cards.
- Focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]`.
- Links/menus: remove blue hover; use text-inherit + hover:bg-[var(--surface-hover)] when needed.
