# Checklist responsive (430px)

- Matériel: iPhone 14 Pro Max (430px large), zoom 100%, Safari/Chrome.
- Pages à vérifier: `/app/pro/[businessId]/agenda`, `/app/pro/[businessId]/clients/[clientId]`, `/app/pro/[businessId]/prospects/[prospectId]`, `/app/pro/[businessId]` (Studio).
- Critères:
  - `document.documentElement.scrollWidth === window.innerWidth` (aucune barre horizontale).
  - Header: back link lisible, titre non coupé, actions stack `w-full` si besoin, menu accessible.
  - Tabs: wraps sur 2 lignes max, pas de scroll horizontal, focus visible.
  - KPI cercles: 2x2 ou 3 compressés sans scroll ni coupure, texte lisible.
  - Cards/listes: pas de colonne cassée, padding cohérent, aucun bouton hors écran.
- Debug rapide: ouvrir console mobile, exécuter `document.documentElement.scrollWidth > window.innerWidth` (doit retourner `false`) sur chaque page.
