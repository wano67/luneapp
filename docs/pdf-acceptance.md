# Acceptance PDF devis/factures (2026-03-01)

## Génération des fixtures
Commande:

```bash
pnpm generate-samples
```

Fichiers attendus dans `tmp/pdf-samples/`:
- `case-1-quote-short.pdf`
- `case-2-quote-long-descriptions.pdf`
- `case-3-quote-cgv-mentions-multipage.pdf`
- `case-4-invoice-extreme-fields-vat-partial.pdf`

## Checklist manuelle

### Rendu global
- [ ] Aucun chevauchement de texte (header, table, totaux, sections légales).
- [ ] Hiérarchie lisible: titre document, sections, corps, texte secondaire.
- [ ] Pas de couleurs agressives (palette neutre noir/gris + séparateurs légers).

### Pagination et flux
- [ ] Pas de pages "vides" ou quasi vides (< 6 lignes), sauf justification explicite.
- [ ] Pas de widow/orphan visible sur les paragraphes longs (min 3 lignes lors des splits).
- [ ] Les blocs `totaux` restent groupés et ne sont pas cassés en deux pages.
- [ ] En devis, le bloc signature reste groupé.

### Table des lignes
- [ ] Entête de table répété après saut de page.
- [ ] Chaque ligne calcule sa hauteur (titre + description) sans overlap.
- [ ] Les descriptions très longues sont tronquées dans le tableau avec annexe "Détail lignes".

### Mentions/CGV
- [ ] Les sections longues (CGV/mentions) se déploient proprement sur plusieurs pages.
- [ ] Les titres de section sont correctement rendus et espacés.
- [ ] La page CGV conserve l’entête/pied avec pagination.

### Header / Footer
- [ ] Header répété sur chaque page (entreprise + type doc + numéro + dates).
- [ ] Footer répété avec `Page X/Y` et identifiants légaux (SIRET/TVA si disponibles).

## Validation technique
Commandes obligatoires:

```bash
npx tsc --noEmit
npx eslint .
npm run build
```

Critère de validation: les 3 commandes doivent terminer sans erreur.
