# Audit layout PDF devis/factures (2026-03-01)

## Périmètre audité
- `src/server/pdf/quotePdf.ts`
- `src/server/pdf/invoicePdf.ts`
- Helpers existants liés:
  - `wrapText`, `splitParagraphs`, `drawParagraph`, `ensureSpace` (implémentés localement dans les 2 fichiers)
  - nouveaux utilitaires en cours: `src/server/pdf/layoutFlow.ts`, `src/server/pdf/textStructure.ts`, `src/server/pdf/pdfValidation.ts`

## Constats techniques (causes racines)

### 1) Positionnement absolu manuel partout
- Les blocs sont rendus en `drawText` + `y -= ...` local, sans moteur de flux global.
- Les sections (header, client, table, totaux, CGV) gèrent chacune leur propre logique de hauteur.
- Effet: comportement non déterministe quand les textes deviennent longs, car chaque section estime ses hauteurs différemment.

### 2) Calcul de hauteur partiel / approximatif
- `wrapText` fonctionne mot par mot mais sans vraie mesure centralisée de paragraphe avant rendu.
- Certaines hauteurs sont calculées avec des formules simplifiées (`lineCount * lineHeight + constantes`), pas via un renderer unique.
- Les sauts `\n`/paragraphes/listes ne sont pas normalisés dans un modèle de texte structuré.

### 3) Pagination fragile
- `ensureSpace(height)` décide seulement "ça tient / nouvelle page".
- Pas de règles robustes `keepTogether` globales ni de gestion widows/orphans.
- Cas observé: création de pages très faibles en contenu ("pages 3 lignes") surtout sur sections légales/CGV.

### 4) Chevauchement possible identifié
- Dans `quotePdf.ts` (`drawHeader`), les lignes de métadonnées droite sont dessinées avec `drawRightText(...)` qui lit `y` global, alors que `rightY` est incrémenté séparément. Résultat: superposition potentielle des lignes de date dans l’entête.
- Dans plusieurs zones, du texte multilignes est dessiné sans pré-calcul strict unifié (`measure -> draw`) appliqué partout.

### 5) Table des lignes partiellement sécurisée
- Hauteur des rows évaluée localement (label + description), mais sans moteur commun imposant les mêmes règles de split et de répétition.
- Le header de table est répété en page suivante via callback, mais la décision de pagination reste locale.

### 6) Footer non piloté par un layout manager
- Le footer est ajouté en post-traitement (pagination OK), mais sans méta de densité de contenu par page.
- Aucune règle anti-page orpheline n’est appliquée après composition.

## Plan de correction

1. **Moteur de flow déterministe**
- Introduire/finir `FlowLayout` comme seule source de vérité pour:
  - dimensions de page,
  - curseur `Y`,
  - mesure paragraphes,
  - rendu paragraphes.

2. **Renderer texte unique**
- Passage systématique par:
  - `measureParagraph(text, style, width)`
  - `drawMeasuredParagraph(lines, ...)`
- Interdiction de dessiner du multilignes directement.

3. **Pagination robuste**
- `keepTogether` pour blocs critiques (titre+intro, totaux, signature).
- Règle `minLinesOnSplit = 3` pour limiter widows/orphans.
- Règle `minLinesPerPage = 6` + mécanisme de prévention de page trop légère sur sections longues.

4. **Structure textuelle explicite**
- Normaliser les mentions/CGV via `TextSection` / `TextParagraph` (+ parser markdown subset sûr).
- Layout par paragraphes/listes/titres, avec spacing contrôlé.

5. **Validation et limites**
- Centraliser les limites de champs et la troncature côté backend PDF.
- Garantir la stabilité même avec CGV/mentions multi-pages.

6. **Refactor quote/invoice vers noyau commun**
- Partager architecture, styles, pagination et rendu de table.
- Conserver strictement les calculs métier existants (totaux, TVA, acomptes, solde).

## Critères de sortie
- Plus de chevauchement texte.
- Plus de page "orpheline" < 6 lignes (hors cas explicitement justifié).
- Table items paginée proprement avec entête répété.
- CGV/mentions longues sur plusieurs pages, sans cassure anarchique.
